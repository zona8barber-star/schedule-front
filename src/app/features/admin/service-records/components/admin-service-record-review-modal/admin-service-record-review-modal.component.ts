import { DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, EventEmitter, Input, OnInit, Output, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { firstValueFrom, map, startWith } from 'rxjs';

import { PERMISSION_CODES } from '../../../../../core/models/auth.models';
import {
  SERVICE_RECORD_OPERATION_LABELS,
  ServiceRecordCustomerOption,
  ServiceRecordOperationType,
  ServiceRecordOptionsView,
  ServiceRecordRedemptionOption,
  ServiceRecordRelatedView,
  ServiceRecordServiceOption,
  ServiceRecordView,
} from '../../../../../core/models/service-record.models';
import { AuthService } from '../../../../../core/services/auth.service';
import { ServiceRecordsApiService } from '../../../../../core/services/service-records-api.service';
import { MoneyConfirmationService } from '../../../../../core/services/money-confirmation.service';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';
import { bogotaToday } from '../../../../../core/utils/bogota-date.utils';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';
import {
  AdminCustomerFormModalComponent,
  CreatedCustomerSummary,
  CustomerCreationSource,
} from '../../../customers/components/admin-customer-form-modal/admin-customer-form-modal.component';

function integerOrNullValidator(control: AbstractControl): ValidationErrors | null {
  return control.value === null || control.value === '' || Number.isInteger(control.value) ? null : { integer: true };
}

function ratesOf(services: ServiceRecordServiceOption[], generalServiceId: string): ServiceRecordServiceOption[] {
  return generalServiceId ? services.filter((service) => service.generalServiceId === generalServiceId) : [];
}

function singleActiveRate(services: ServiceRecordServiceOption[], generalServiceId: string): ServiceRecordServiceOption | null {
  const active = ratesOf(services, generalServiceId).filter((service) => service.isActive);
  return active.length === 1 ? active[0] : null;
}

/** Confirms (with corrections) or rejects one pending service record. */
import { ModalDialogDirective } from '../../../../../shared/directives/modal-dialog.directive';

import { SingleFlight } from '../../../../../core/utils/single-flight';

@Component({
  selector: 'app-admin-service-record-review-modal',
  imports: [ModalDialogDirective, DecimalPipe, ReactiveFormsModule, ApiFeedbackComponent, AdminCustomerFormModalComponent],
  templateUrl: './admin-service-record-review-modal.component.html',
  styleUrl: './admin-service-record-review-modal.component.scss',
})
export class AdminServiceRecordReviewModalComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly moneyConfirmation = inject(MoneyConfirmationService);
  private readonly api = inject(ServiceRecordsApiService);
  private readonly authService = inject(AuthService);

  @Input({ required: true }) record!: ServiceRecordView;
  @Input({ required: true }) options!: ServiceRecordOptionsView;
  @Output() readonly reviewed = new EventEmitter<ServiceRecordView>();
  @Output() readonly cancelled = new EventEmitter<void>();
  /** The record changed or was reviewed by someone else: the inbox should reload. */
  @Output() readonly staleDetected = new EventEmitter<void>();

  readonly operationLabels = SERVICE_RECORD_OPERATION_LABELS;
  /** Confirming a reward delivers a redemption: it also needs loyalty.redemptions.deliver (checked again by the API). */
  readonly canDeliverRewards = this.authService.hasPermission(PERMISSION_CODES.loyaltyRedemptionsDeliver);
  readonly selectableOperations: ServiceRecordOperationType[] = this.canDeliverRewards
    ? ['Paid', 'MembershipConsumption', 'Courtesy', 'LoyaltyReward']
    : ['Paid', 'MembershipConsumption', 'Courtesy'];
  /** Approved service redemptions of the selected customer and service; null while not applicable or loading. */
  readonly redemptionOptions = signal<ServiceRecordRedemptionOption[] | null>(null);
  private redemptionOptionsKey: string | null = null;
  readonly today = bogotaToday();

  readonly isSaving = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly hasConflict = signal(false);
  readonly submitted = signal(false);
  readonly rejecting = signal(false);
  readonly customer = signal<ServiceRecordCustomerOption | null>(null);
  /** Name of the live profile when the registered one was merged into it (SONDA BUG-105); null otherwise. */
  readonly mergedInto = signal<string | null>(null);
  readonly customerResults = signal<ServiceRecordCustomerOption[]>([]);
  readonly isSearching = signal(false);
  readonly creatingCustomer = signal(false);
  /** Possible duplicates (warnings only); null while loading or if they could not be read. */
  readonly related = signal<ServiceRecordRelatedView | null>(null);

  /** New customers are created with the same backend logic as the customers module, through the review's own routes. */
  readonly customerSource: CustomerCreationSource = {
    create: (request) => this.api.createCustomer(request),
    // The form shows candidates as name, email and phone: here they are hints, and accounts have no id.
    findDuplicates: (email, phone) =>
      this.api.findCustomerDuplicates(email, phone).pipe(
        map((found) =>
          found.map((candidate, index) => ({
            kind: candidate.kind,
            id: candidate.customerId ?? `account-${index}`,
            fullName: candidate.fullName,
            email: candidate.emailHint ?? '',
            phone: candidate.phoneHint,
            matchedOn: candidate.matchedOn,
            isLinked: false,
          })),
        ),
      ),
  };

  readonly hasRelated = computed(() => {
    const related = this.related();
    return (
      !!related &&
      (related.manualIncomes.length > 0 ||
        related.otherRecords.length > 0 ||
        related.membershipConsumptions.length > 0 ||
        related.appointmentStatus === 'Cancelled' ||
        related.appointmentStatus === 'NoShow')
    );
  });

  readonly form = this.formBuilder.nonNullable.group({
    operationType: this.formBuilder.nonNullable.control<ServiceRecordOperationType>('Paid'),
    /** General service performed (ADR-0016 B4); the rate must belong to it. */
    generalServiceId: ['', [Validators.required]],
    /** Settlement rate ("Tarifa"). */
    serviceId: ['', [Validators.required]],
    staffProfileId: ['', [Validators.required]],
    performedOn: ['', [Validators.required]],
    chargedAmount: this.formBuilder.control<number | null>(null, [integerOrNullValidator]),
    customerMembershipId: [''],
    loyaltyRedemptionId: [''],
    accruesLoyaltyPoints: [false],
    notes: ['', [Validators.maxLength(500)]],
    customerQuery: [''],
    rejectionReason: ['', [Validators.maxLength(500)]],
  });

  private readonly formValue = toSignal(this.form.valueChanges.pipe(startWith(this.form.getRawValue())));

  readonly operation = computed(() => (this.formValue()?.operationType ?? 'Paid') as ServiceRecordOperationType);

  readonly selectedService = computed(() => {
    const serviceId = this.formValue()?.serviceId;
    return this.options.services.find((service) => service.id === serviceId) ?? null;
  });

  /** General services to choose from: active ones, plus the current one even if it is inactive. */
  readonly generalServiceOptions = computed(() => {
    const currentId = this.formValue()?.generalServiceId;
    return (this.options.generalServices ?? []).filter((service) => service.isActive || service.id === currentId);
  });

  /** Rates of the chosen general service, plus the current rate even if it is inactive. */
  readonly rateOptions = computed(() => {
    const value = this.formValue();
    return ratesOf(this.options.services, value?.generalServiceId ?? '').filter(
      (service) => service.isActive || service.id === value?.serviceId,
    );
  });

  /** Why the points checkbox is unavailable, or null when the service may accrue. */
  readonly pointsBlocker = computed(() => {
    if (this.operation() !== 'Paid') {
      return 'Solo un servicio pagado acumula puntos.';
    }
    if (!this.options.loyaltyProgramEnabled) {
      return 'El programa de fidelización está deshabilitado.';
    }
    if (!this.customer()) {
      return 'Identifica al cliente para que pueda acumular puntos.';
    }
    if (!this.selectedService()?.loyaltyPoints) {
      return 'El servicio no tiene puntos configurados.';
    }
    return null;
  });

  readonly problems = computed(() => {
    this.formValue();
    const problems: string[] = [];
    if (!this.form.controls.generalServiceId.value || !this.form.controls.serviceId.value) {
      problems.push('Elige el servicio general y la tarifa con la que se liquida.');
    }
    const amount = this.form.controls.chargedAmount.value;
    if (this.operation() === 'Paid' && !(typeof amount === 'number' && amount > 0 && Number.isInteger(amount))) {
      problems.push('Indica el valor cobrado: un número entero mayor que cero. Si no se cobró, elige Cortesía.');
    }
    if (this.operation() === 'MembershipConsumption') {
      if (!this.customer()) {
        problems.push('Elige el cliente dueño de la membresía.');
      } else if (!this.form.controls.customerMembershipId.value) {
        problems.push('Elige la membresía de la que se descuenta el servicio.');
      }
    }
    if (this.operation() === 'LoyaltyReward') {
      if (!this.customer()) {
        problems.push('Elige el cliente que canjeó la recompensa.');
      } else if (!this.form.controls.loyaltyRedemptionId.value) {
        problems.push('Elige el canje aprobado que se entrega con este servicio.');
      }
    }
    if (this.form.controls.performedOn.value > this.today) {
      problems.push('La fecha del servicio no puede ser futura.');
    }
    return problems;
  });

  async ngOnInit(): Promise<void> {
    const registeredRate = this.options.services.find((candidate) => candidate.id === this.record.serviceId);
    const generalServiceId = this.record.generalServiceId ?? registeredRate?.generalServiceId ?? '';
    const service =
      registeredRate && registeredRate.generalServiceId === generalServiceId
        ? registeredRate
        : singleActiveRate(this.options.services, generalServiceId);
    this.form.patchValue({
      generalServiceId,
      serviceId: service?.id ?? '',
      staffProfileId: this.record.staffProfileId,
      performedOn: this.record.performedOn,
      chargedAmount: service?.basePrice ?? null,
    });
    // Another general service: keep the rate only if it belongs to it; pick the rate when there is a single one.
    this.form.controls.generalServiceId.valueChanges.subscribe((selected) => this.syncRate(selected));
    // The form-level stream, not the controls': it emits after the form value (and so pointsBlocker) is updated.
    this.form.valueChanges.subscribe(() => {
      this.applyPointsRule();
      void this.refreshRedemptionOptions();
    });
    void this.loadRelated();

    // SONDA BUG-085: the memberships offered must be valid on the service date; a new date refreshes them.
    this.form.controls.performedOn.valueChanges.subscribe(() => void this.refreshCustomerMemberships());

    if (this.record.customerId && this.record.suggestedCustomerId) {
      // SONDA BUG-105: the registered profile was merged; the live one (MergedIntoCustomerId) is preselected and said.
      const results = await this.searchSilently(this.record.suggestedCustomerName ?? '');
      this.mergedInto.set(this.record.suggestedCustomerName ?? 'otro perfil');
      this.customer.set(results.find((option) => option.id === this.record.suggestedCustomerId) ?? {
        id: this.record.suggestedCustomerId,
        fullName: this.record.suggestedCustomerName ?? 'Cliente',
        phoneHint: '',
        memberships: [],
      });
    } else if (this.record.customerId) {
      // Preselect the customer the registration already identified (from the appointment).
      const results = await this.searchSilently(this.record.customerName ?? '');
      this.customer.set(results.find((option) => option.id === this.record.customerId) ?? {
        id: this.record.customerId,
        fullName: this.record.customerName ?? 'Cliente',
        phoneHint: '',
        memberships: [],
      });
    } else if (this.record.customerName) {
      this.form.controls.customerQuery.setValue(this.record.customerName);
    }
    this.applyPointsRule();
  }

  async searchCustomers(): Promise<void> {
    this.customerResults.set(await this.searchSilently(this.form.controls.customerQuery.value));
  }

  selectCustomer(option: ServiceRecordCustomerOption): void {
    this.customer.set(option);
    this.mergedInto.set(null);
    this.customerResults.set([]);
    this.form.controls.customerMembershipId.setValue(option.memberships.length === 1 ? option.memberships[0].id : '');
    this.applyPointsRule();
    void this.refreshRedemptionOptions();
  }

  openCreateCustomer(): void {
    this.creatingCustomer.set(true);
  }

  onCustomerCreated(created: CreatedCustomerSummary & { phoneHint?: string }): void {
    this.creatingCustomer.set(false);
    // A new profile has no account and no memberships; it is never linked to an account automatically.
    this.selectCustomer({ id: created.id, fullName: created.fullName, phoneHint: created.phoneHint ?? '', memberships: [] });
  }

  /** The profile of the account that booked the appointment, linked after the registration; the reviewer decides. */
  useSuggestedCustomer(): void {
    const id = this.record.suggestedCustomerId;
    if (id) {
      this.selectCustomer({ id, fullName: this.record.suggestedCustomerName ?? 'Cliente', phoneHint: '', memberships: [] });
    }
  }

  clearCustomer(): void {
    this.customer.set(null);
    this.mergedInto.set(null);
    this.form.controls.customerMembershipId.setValue('');
    this.applyPointsRule();
    void this.refreshRedemptionOptions();
  }

  @SingleFlight()
  async approve(): Promise<void> {
    this.submitted.set(true);
    if (this.form.invalid || this.problems().length > 0) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const operation = value.operationType;
    // Only a paid service carries a charged value; the other operations have no amount to confirm.
    if (operation === 'Paid' && typeof value.chargedAmount === 'number') {
      const confirmed = await this.moneyConfirmation.confirm({
        action: 'Aprobar el servicio con un valor cobrado',
        amount: value.chargedAmount,
      });
      if (!confirmed) return;
    }

    await this.run(() =>
      this.api.approve(this.record.id, {
        version: this.record.version,
        operationType: operation,
        generalServiceId: value.generalServiceId,
        serviceId: value.serviceId,
        staffProfileId: value.staffProfileId,
        customerId: this.customer()?.id ?? null,
        performedOn: value.performedOn,
        chargedAmount: operation === 'Paid' ? value.chargedAmount : null,
        customerMembershipId: operation === 'MembershipConsumption' ? value.customerMembershipId || null : null,
        accruesLoyaltyPoints: operation === 'Paid' && !this.pointsBlocker() && value.accruesLoyaltyPoints,
        notes: value.notes.trim() || null,
        ...(operation === 'LoyaltyReward' ? { loyaltyRedemptionId: value.loyaltyRedemptionId || null } : {}),
      }),
    );
  }

  @SingleFlight()
  async reject(): Promise<void> {
    const reason = this.form.controls.rejectionReason.value.trim();
    if (reason.length < 3) {
      this.errorMessage.set('Escribe el motivo del rechazo (al menos 3 caracteres).');
      return;
    }
    await this.run(() => this.api.reject(this.record.id, { version: this.record.version, reason }));
  }

  cancel(): void {
    if (!this.isSaving()) {
      this.cancelled.emit();
    }
  }

  reloadInbox(): void {
    this.staleDetected.emit();
  }

  private async run(action: () => ReturnType<ServiceRecordsApiService['approve']>): Promise<void> {
    this.isSaving.set(true);
    this.errorMessage.set(null);
    this.hasConflict.set(false);
    try {
      this.reviewed.emit(await firstValueFrom(action()));
    } catch (error) {
      this.hasConflict.set(error instanceof HttpErrorResponse && error.status === 409);
      this.errorMessage.set(
        error instanceof HttpErrorResponse && error.status === 403
          ? 'Ya no tienes permiso para aprobar servicios realizados o para entregar recompensas.'
          : getApiErrorMessage(error),
      );
    } finally {
      this.isSaving.set(false);
    }
  }

  private async loadRelated(): Promise<void> {
    try {
      this.related.set(await firstValueFrom(this.api.related(this.record.id)));
    } catch {
      // Warnings are a help, not a requirement: the review works without them.
      this.related.set(null);
    }
  }

  /** Loads the approved redemptions of the customer for the confirmed service when the operation is a reward. */
  private async refreshRedemptionOptions(): Promise<void> {
    const customerId = this.customer()?.id;
    const serviceId = this.form.controls.serviceId.value;
    const key = this.operation() === 'LoyaltyReward' && customerId ? `${customerId}|${serviceId}` : null;
    if (key === this.redemptionOptionsKey) {
      return;
    }

    this.redemptionOptionsKey = key;
    this.redemptionOptions.set(null);
    // Emitted, so `problems` (computed from the form value) sees it; re-entering here returns at once (same key).
    this.form.controls.loyaltyRedemptionId.setValue('');
    if (!key || !customerId) {
      return;
    }

    try {
      const options = await firstValueFrom(this.api.getRedemptionOptions(customerId, serviceId || null));
      if (this.redemptionOptionsKey === key) {
        this.redemptionOptions.set(options);
        const usable = options.filter((option) => !option.isPastDeadline);
        if (usable.length === 1) {
          this.form.controls.loyaltyRedemptionId.setValue(usable[0].id);
        }
      }
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
      this.redemptionOptions.set([]);
    }
  }

  /** "Servicio general · Tarifa". */
  rateLabel(service: ServiceRecordServiceOption): string {
    const label = service.generalServiceName ? `${service.generalServiceName} · ${service.name}` : service.name;
    return service.isActive ? label : `${label} (inactiva)`;
  }

  private syncRate(generalServiceId: string): void {
    const current = this.options.services.find((service) => service.id === this.form.controls.serviceId.value);
    if (current && current.generalServiceId === generalServiceId) {
      return;
    }

    const single = singleActiveRate(this.options.services, generalServiceId);
    this.form.controls.serviceId.setValue(single?.id ?? '');
    if (single && this.form.controls.chargedAmount.value === null) {
      this.form.controls.chargedAmount.setValue(single.basePrice);
    }
  }

  /** The points checkbox only stays checked while the record is eligible. */
  private applyPointsRule(): void {
    const control = this.form.controls.accruesLoyaltyPoints;
    if (this.pointsBlocker()) {
      control.setValue(false, { emitEvent: false });
      control.disable({ emitEvent: false });
    } else {
      control.enable({ emitEvent: false });
    }
  }

  /** Re-reads the selected customer's memberships for the current service date (SONDA BUG-085). */
  private async refreshCustomerMemberships(): Promise<void> {
    const selected = this.customer();
    if (!selected) return;
    const results = await this.searchSilently(selected.fullName);
    const fresh = results.find((option) => option.id === selected.id);
    const memberships = fresh?.memberships ?? [];
    this.customer.set({ ...selected, memberships });
    const chosen = this.form.controls.customerMembershipId.value;
    if (chosen && !memberships.some((membership) => membership.id === chosen)) {
      this.form.controls.customerMembershipId.setValue(memberships.length === 1 ? memberships[0].id : '');
    }
  }

  private async searchSilently(query: string): Promise<ServiceRecordCustomerOption[]> {
    this.isSearching.set(true);
    try {
      return await firstValueFrom(this.api.customerOptions(query, this.form.controls.performedOn.value || null));
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
      return [];
    } finally {
      this.isSearching.set(false);
    }
  }
}
