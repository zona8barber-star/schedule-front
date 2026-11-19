import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import {
  BILL_EFFECT_LABELS,
  BILL_LINE_TYPE_LABELS,
  BILL_STATUS_LABELS,
  BillApprovalPreviewView,
  BillEventView,
  BillLineRequest,
  BillLineType,
  BillLineView,
  BillMembershipOption,
  BillOptionsView,
  BillRedemptionOption,
  BillView,
  TIP_PAYMENT_MODE_LABELS,
  TipPaymentMode,
} from '../../../../core/models/bill.models';
import { newIdempotencyKey } from '../../../../core/models/loyalty-redemption.models';
import { BillsApiService } from '../../../../core/services/bills-api.service';
import { MoneyConfirmationService, formatCop } from '../../../../core/services/money-confirmation.service';
import { getApiErrorMessage } from '../../../../core/utils/api-error.utils';
import { bogotaDateTimeFormat } from '../../../../core/utils/bogota-date.utils';
import { trimmedMinLength, trimmedRequired } from '../../../../core/utils/form-validators';
import { SingleFlight } from '../../../../core/utils/single-flight';
import { ApiFeedbackComponent } from '../../../../shared/components/api-feedback/api-feedback.component';
import { FormA11yDirective } from '../../../../shared/directives/form-a11y.directive';
import { ModalDialogDirective } from '../../../../shared/directives/modal-dialog.directive';

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_TIME = bogotaDateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
export const BILL_MAX_AMOUNT = 100_000_000;

type BillModal = 'void' | 'detach' | 'approve' | 'unapprove' | 'paymentMethod';

const EVENT_LABELS: Record<string, string> = {
  Opened: 'Abrió la cuenta',
  LineAdded: 'Agregó una línea',
  LineChanged: 'Cambió una línea',
  LineRemoved: 'Quitó una línea',
  HeaderChanged: 'Cambió el cliente o la fecha',
  Closed: 'Cerró y cobró',
  PaymentMethodChanged: 'Cambió el método de pago',
  Approved: 'Aprobó',
  Voided: 'Anuló',
  AppointmentDetached: 'Desvinculó la cuenta de su cita',
  Unapproved: 'Desaprobó',
};

/**
 * One bill (ADR-0020): build it (lines of each type, prices from the catalog), close and charge it in one step (Q16) with
 * the money confirmation, and, for the approver, review the audited corrections and approve it with its postings.
 * What each user can do comes from the API (`actions`), which checks it again on every request.
 */
@Component({
  selector: 'app-bill-detail-page',
  imports: [FormA11yDirective, ModalDialogDirective, ReactiveFormsModule, RouterLink, ApiFeedbackComponent],
  templateUrl: './bill-detail-page.component.html',
  styleUrls: ['../../../admin/service-catalog/catalog-page.scss', '../../bills.scss'],
})
export class BillDetailPageComponent implements OnInit {
  private readonly api = inject(BillsApiService);
  private readonly moneyConfirmation = inject(MoneyConfirmationService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private approveKey = newIdempotencyKey();
  private unapproveKey = newIdempotencyKey();

  readonly statusLabels = BILL_STATUS_LABELS;
  readonly lineTypeLabels = BILL_LINE_TYPE_LABELS;
  readonly tipModeLabels = TIP_PAYMENT_MODE_LABELS;
  readonly effectLabels = BILL_EFFECT_LABELS;
  readonly formatCop = formatCop;
  readonly lineTypes: BillLineType[] = ['Service', 'Product', 'MembershipConsumption', 'Redemption', 'Discount', 'Tip'];

  readonly isLoading = signal(true);
  readonly notFound = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly bill = signal<BillView | null>(null);
  readonly options = signal<BillOptionsView | null>(null);
  readonly memberships = signal<BillMembershipOption[]>([]);
  readonly redemptions = signal<BillRedemptionOption[]>([]);
  readonly events = signal<BillEventView[] | null>(null);
  readonly isSaving = signal(false);
  readonly lineError = signal<string | null>(null);
  readonly paymentMethodId = signal('');
  readonly modal = signal<BillModal | null>(null);
  readonly modalError = signal<string | null>(null);
  readonly preview = signal<BillApprovalPreviewView | null>(null);
  readonly noPoints = signal<ReadonlySet<string>>(new Set());

  readonly editable = computed(() => this.bill()?.actions.canEdit ?? false);
  readonly chargeableLines = computed(() =>
    (this.bill()?.lines ?? []).filter((line) => line.type === 'Product' || (line.type === 'Service' && !line.isCourtesy)),
  );
  readonly activeStaff = computed(() => (this.options()?.staff ?? []).filter((staff) => staff.isActive));
  /** ADR-0021 L1: without bills.assign-other-staff, services and tips go only on one's own name (products are free). */
  readonly canAssignOtherStaff = computed(() => this.options()?.canAssignOtherStaff ?? false);
  readonly lineType = signal<BillLineType>('Service');
  readonly lineStaffOptions = computed(() => {
    const own = this.options()?.ownStaffProfileId ?? null;
    return this.canAssignOtherStaff() || this.lineType() === 'Product'
      ? this.activeStaff()
      : this.activeStaff().filter((staff) => staff.id === own);
  });

  readonly lineForm = this.formBuilder.nonNullable.group({
    type: ['Service' as BillLineType],
    staffProfileId: [''],
    generalServiceId: [''],
    serviceId: [''],
    productId: [''],
    quantity: [1, [Validators.min(1), Validators.max(1000)]],
    membership: [''],
    loyaltyRedemptionId: [''],
    amount: [null as number | null, [Validators.min(1), Validators.max(BILL_MAX_AMOUNT)]],
    reason: ['', [Validators.maxLength(500)]],
    appliesToLineId: [''],
    tipPaymentMode: ['WithBill' as TipPaymentMode],
    isCourtesy: [false],
  });

  readonly reasonForm = this.formBuilder.nonNullable.group({
    reason: ['', [trimmedRequired, trimmedMinLength(3), Validators.maxLength(500)]],
  });

  readonly approveNotes = this.formBuilder.nonNullable.control('', [Validators.maxLength(500)]);

  ngOnInit(): void {
    const billId = this.route.snapshot.paramMap.get('billId') ?? '';
    if (!GUID.test(billId)) {
      this.notFound.set(true);
      this.isLoading.set(false);
      return;
    }

    void this.load(billId);
  }

  formatDateTime(value: string | null): string {
    return value ? DATE_TIME.format(new Date(value)) : '';
  }

  eventLabel(type: string): string {
    return EVENT_LABELS[type] ?? type;
  }

  rateOptions(generalServiceId: string | null): { id: string; name: string; price: number }[] {
    return this.options()?.services.find((service) => service.id === generalServiceId)?.rates ?? [];
  }

  lineValue(line: BillLineView): string {
    if (line.type === 'Tip' && line.tipPaymentMode === 'Direct') {
      return `${formatCop(line.unitPrice)} (aparte)`;
    }
    return formatCop(line.amount);
  }

  onTypeChange(): void {
    this.lineError.set(null);
    const type = this.lineForm.controls.type.value;
    this.lineType.set(type);
    const own = this.options()?.ownStaffProfileId ?? '';
    if (type !== 'Product' && !this.canAssignOtherStaff() && this.lineForm.controls.staffProfileId.value !== own) {
      this.lineForm.patchValue({ staffProfileId: own });
    }
    const bill = this.bill();
    if (!bill) return;
    if (type === 'MembershipConsumption') {
      void this.loadMemberships(bill.id);
    } else if (type === 'Redemption') {
      void this.loadRedemptions(bill.id);
    }
  }

  @SingleFlight()
  async addLine(): Promise<void> {
    const bill = this.bill();
    if (!bill) return;
    const value = this.lineForm.getRawValue();
    const request: BillLineRequest = { version: bill.version, type: value.type };
    const staffProfileId = value.staffProfileId || null;
    switch (value.type) {
      case 'Service':
        Object.assign(request, {
          staffProfileId,
          generalServiceId: value.generalServiceId || null,
          serviceId: value.serviceId || null,
          isCourtesy: value.isCourtesy,
          reason: value.isCourtesy ? value.reason.trim() : null,
        });
        break;
      case 'Product':
        Object.assign(request, { productId: value.productId || null, quantity: Math.trunc(value.quantity || 0), staffProfileId });
        break;
      case 'MembershipConsumption': {
        const [membershipId, serviceId] = value.membership.split('|');
        Object.assign(request, { staffProfileId, customerMembershipId: membershipId || null, serviceId: serviceId || null });
        break;
      }
      case 'Redemption':
        Object.assign(request, { loyaltyRedemptionId: value.loyaltyRedemptionId || null, staffProfileId });
        break;
      case 'Discount':
        Object.assign(request, {
          amount: value.amount === null ? null : Math.trunc(value.amount),
          reason: value.reason.trim(),
          appliesToLineId: value.appliesToLineId || null,
        });
        break;
      case 'Tip':
        Object.assign(request, {
          staffProfileId,
          amount: value.amount === null ? null : Math.trunc(value.amount),
          tipPaymentMode: value.tipPaymentMode,
        });
        break;
    }

    // Lote C2 / ADR-0021 L6: every amount typed by hand is confirmed before it is saved.
    if ((value.type === 'Discount' || value.type === 'Tip') && value.amount !== null && value.amount > 0) {
      const confirmed = await this.moneyConfirmation.confirm({
        action: value.type === 'Discount' ? 'Agregar el descuento' : 'Agregar la propina',
        amount: Math.trunc(value.amount),
        detail: value.type === 'Discount' ? value.reason.trim() || undefined : TIP_PAYMENT_MODE_LABELS[value.tipPaymentMode],
      });
      if (!confirmed) return;
    }

    const saved = await this.mutate(() => this.api.addLine(bill.id, request), `${BILL_LINE_TYPE_LABELS[value.type]} agregado a la cuenta.`);
    if (saved) {
      this.lineForm.patchValue({ serviceId: '', productId: '', quantity: 1, amount: null, reason: '', membership: '', loyaltyRedemptionId: '', isCourtesy: false });
      if (value.type === 'Redemption') {
        void this.loadRedemptions(bill.id);
      }
    }
  }

  @SingleFlight()
  async chooseRate(line: BillLineView, serviceId: string): Promise<void> {
    const bill = this.bill();
    if (!bill || !serviceId) return;
    await this.mutate(
      () => this.api.updateLine(bill.id, line.id, { version: bill.version, serviceId, generalServiceId: line.generalServiceId }),
      'Tarifa elegida.',
    );
  }

  @SingleFlight()
  async removeLine(line: BillLineView): Promise<void> {
    const bill = this.bill();
    if (!bill) return;
    await this.mutate(() => this.api.removeLine(bill.id, line.id, bill.version), `Se quitó «${line.name}».`);
  }

  @SingleFlight()
  async closeBill(): Promise<void> {
    const bill = this.bill();
    if (!bill) return;
    const methodId = bill.total > 0 ? this.paymentMethodId() : null;
    if (bill.total > 0) {
      if (!methodId) {
        this.errorMessage.set('Elige el método de pago antes de cerrar la cuenta.');
        return;
      }
      const methodName = this.options()?.paymentMethods.find((method) => method.id === methodId)?.name ?? '';
      const confirmed = await this.moneyConfirmation.confirm({
        action: 'Cerrar y cobrar la cuenta',
        amount: bill.total,
        detail: `${bill.customerName} · ${methodName}`,
      });
      if (!confirmed) return;
    }

    await this.mutate(() => this.api.close(bill.id, bill.version, methodId), 'Cuenta cerrada y cobrada.');
  }

  /** ADR-0021 L11 (SONDA BUG-172): the correction asks for its reason; the receipt and the cash closing follow it. */
  changePaymentMethod(): void {
    const bill = this.bill();
    if (!bill || !this.paymentMethodId() || this.paymentMethodId() === bill.paymentMethodId) return;
    this.openModal('paymentMethod');
  }

  paymentMethodName(id: string): string {
    return this.options()?.paymentMethods.find((method) => method.id === id)?.name ?? '';
  }

  openModal(kind: BillModal): void {
    this.modalError.set(null);
    this.reasonForm.reset({ reason: '' });
    this.modal.set(kind);
    if (kind === 'unapprove') {
      this.unapproveKey = newIdempotencyKey();
    }
    if (kind === 'approve') {
      this.approveKey = newIdempotencyKey();
      this.approveNotes.setValue('');
      this.preview.set(null);
      this.noPoints.set(new Set());
      void this.loadPreview();
    }
  }

  closeModal(): void {
    if (!this.isSaving()) {
      this.modal.set(null);
    }
  }

  togglePoints(lineId: string, checked: boolean): void {
    const next = new Set(this.noPoints());
    if (checked) {
      next.delete(lineId);
    } else {
      next.add(lineId);
    }
    this.noPoints.set(next);
  }

  @SingleFlight()
  async submitReason(): Promise<void> {
    const bill = this.bill();
    const kind = this.modal();
    if (!bill || (kind !== 'void' && kind !== 'detach' && kind !== 'unapprove' && kind !== 'paymentMethod')) return;
    if (this.reasonForm.invalid) {
      this.reasonForm.markAllAsTouched();
      return;
    }
    const reason = this.reasonForm.controls.reason.value.trim();
    const saved = await this.mutate(
      () =>
        kind === 'void'
          ? this.api.void(bill.id, bill.version, reason)
          : kind === 'unapprove'
            ? this.api.unapprove(bill.id, { version: bill.version, idempotencyKey: this.unapproveKey, reason })
            : kind === 'paymentMethod'
              ? this.api.changePaymentMethod(bill.id, bill.version, this.paymentMethodId(), reason)
              : this.api.detachAppointment(bill.id, bill.version, reason),
      kind === 'void'
        ? 'Cuenta anulada.'
        : kind === 'unapprove'
          ? 'Cuenta desaprobada: sus ingresos, consumos, puntos, canjes e inventario se revirtieron. Corrígela y apruébala de nuevo.'
          : kind === 'paymentMethod'
            ? 'Método de pago corregido: el recibo y el cierre de caja ya muestran el nuevo.'
            : 'La cuenta quedó desvinculada de su cita.',
      true,
    );
    if (saved) {
      this.modal.set(null);
    }
  }

  @SingleFlight()
  async approve(): Promise<void> {
    const bill = this.bill();
    if (!bill) return;
    // ADR-0021 L6: approving posts the money of the bill, so its total is confirmed like any other amount.
    if (bill.total > 0) {
      const confirmed = await this.moneyConfirmation.confirm({
        action: 'Aprobar la cuenta',
        amount: bill.total,
        detail: `${bill.customerName}${bill.paymentMethodName ? ' · ' + bill.paymentMethodName : ''}`,
      });
      if (!confirmed) return;
    }
    const saved = await this.mutate(
      () =>
        this.api.approve(bill.id, {
          version: bill.version,
          idempotencyKey: this.approveKey,
          noPointsLineIds: [...this.noPoints()],
          notes: this.approveNotes.value.trim() || null,
        }),
      'Cuenta aprobada. Sus ingresos, consumos, canjes, puntos e inventario quedaron registrados.',
      true,
    );
    if (saved) {
      this.modal.set(null);
    }
  }

  @SingleFlight()
  async toggleEvents(): Promise<void> {
    const bill = this.bill();
    if (!bill) return;
    if (this.events()) {
      this.events.set(null);
      return;
    }
    try {
      this.events.set(await firstValueFrom(this.api.events(bill.id)));
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
    }
  }

  private async mutate(request: () => ReturnType<BillsApiService['get']>, success: string, inModal = false): Promise<boolean> {
    this.isSaving.set(true);
    this.lineError.set(null);
    this.modalError.set(null);
    this.errorMessage.set(null);
    this.successMessage.set(null);
    try {
      const bill = await firstValueFrom(request());
      this.bill.set(bill);
      this.paymentMethodId.set(bill.paymentMethodId ?? '');
      this.events.set(null);
      this.successMessage.set(success);
      return true;
    } catch (error) {
      const message = getApiErrorMessage(error);
      if (inModal) {
        this.modalError.set(message);
      } else {
        this.lineError.set(message);
      }
      return false;
    } finally {
      this.isSaving.set(false);
    }
  }

  private async loadPreview(): Promise<void> {
    const bill = this.bill();
    if (!bill) return;
    try {
      this.preview.set(await firstValueFrom(this.api.approvalPreview(bill.id)));
    } catch (error) {
      this.modalError.set(getApiErrorMessage(error));
    }
  }

  private async loadMemberships(billId: string): Promise<void> {
    try {
      this.memberships.set(await firstValueFrom(this.api.membershipOptions(billId)));
    } catch (error) {
      this.lineError.set(getApiErrorMessage(error));
    }
  }

  private async loadRedemptions(billId: string): Promise<void> {
    try {
      this.redemptions.set(await firstValueFrom(this.api.redemptionOptions(billId)));
    } catch (error) {
      this.lineError.set(getApiErrorMessage(error));
    }
  }

  private async load(billId: string): Promise<void> {
    this.isLoading.set(true);
    try {
      const [bill, options] = await Promise.all([firstValueFrom(this.api.get(billId)), firstValueFrom(this.api.options())]);
      this.bill.set(bill);
      this.options.set(options);
      this.paymentMethodId.set(bill.paymentMethodId ?? '');
      // ADR-0021 L1: without the permission the default is always one's own name.
      this.lineForm.patchValue({
        staffProfileId: options.canAssignOtherStaff ? (bill.staffProfileId ?? options.ownStaffProfileId ?? '') : (options.ownStaffProfileId ?? ''),
      });
    } catch (error) {
      if ((error as { status?: number }).status === 404) {
        this.notFound.set(true);
      } else {
        this.errorMessage.set(getApiErrorMessage(error));
      }
    } finally {
      this.isLoading.set(false);
    }
  }
}
