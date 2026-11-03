import { DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, EventEmitter, Input, OnInit, Output, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { firstValueFrom, map, startWith } from 'rxjs';

import {
  SERVICE_RECORD_OPERATION_LABELS,
  ServiceRecordCustomerOption,
  ServiceRecordOperationType,
  ServiceRecordOptionsView,
  ServiceRecordRelatedView,
  ServiceRecordView,
} from '../../../../../core/models/service-record.models';
import { ServiceRecordsApiService } from '../../../../../core/services/service-records-api.service';
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

/** Confirms (with corrections) or rejects one pending service record. */
@Component({
  selector: 'app-admin-service-record-review-modal',
  imports: [DecimalPipe, ReactiveFormsModule, ApiFeedbackComponent, AdminCustomerFormModalComponent],
  templateUrl: './admin-service-record-review-modal.component.html',
  styleUrl: './admin-service-record-review-modal.component.scss',
})
export class AdminServiceRecordReviewModalComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly api = inject(ServiceRecordsApiService);

  @Input({ required: true }) record!: ServiceRecordView;
  @Input({ required: true }) options!: ServiceRecordOptionsView;
  @Output() readonly reviewed = new EventEmitter<ServiceRecordView>();
  @Output() readonly cancelled = new EventEmitter<void>();
  /** The record changed or was reviewed by someone else: the inbox should reload. */
  @Output() readonly staleDetected = new EventEmitter<void>();

  readonly operationLabels = SERVICE_RECORD_OPERATION_LABELS;
  readonly selectableOperations: ServiceRecordOperationType[] = ['Paid', 'MembershipConsumption', 'Courtesy'];
  readonly today = bogotaToday();

  readonly isSaving = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly hasConflict = signal(false);
  readonly submitted = signal(false);
  readonly rejecting = signal(false);
  readonly customer = signal<ServiceRecordCustomerOption | null>(null);
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
    serviceId: ['', [Validators.required]],
    staffProfileId: ['', [Validators.required]],
    performedOn: ['', [Validators.required]],
    chargedAmount: this.formBuilder.control<number | null>(null, [integerOrNullValidator]),
    customerMembershipId: [''],
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
    if (this.form.controls.performedOn.value > this.today) {
      problems.push('La fecha del servicio no puede ser futura.');
    }
    return problems;
  });

  async ngOnInit(): Promise<void> {
    const service = this.options.services.find((candidate) => candidate.id === this.record.serviceId);
    this.form.patchValue({
      serviceId: this.record.serviceId,
      staffProfileId: this.record.staffProfileId,
      performedOn: this.record.performedOn,
      chargedAmount: service?.basePrice ?? null,
    });
    // The form-level stream, not the controls': it emits after the form value (and so pointsBlocker) is updated.
    this.form.valueChanges.subscribe(() => this.applyPointsRule());
    void this.loadRelated();

    if (this.record.customerId) {
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
    this.customerResults.set([]);
    this.form.controls.customerMembershipId.setValue(option.memberships.length === 1 ? option.memberships[0].id : '');
    this.applyPointsRule();
  }

  openCreateCustomer(): void {
    this.creatingCustomer.set(true);
  }

  onCustomerCreated(created: CreatedCustomerSummary & { phoneHint?: string }): void {
    this.creatingCustomer.set(false);
    // A new profile has no account and no memberships; it is never linked to an account automatically.
    this.selectCustomer({ id: created.id, fullName: created.fullName, phoneHint: created.phoneHint ?? '', memberships: [] });
  }

  clearCustomer(): void {
    this.customer.set(null);
    this.form.controls.customerMembershipId.setValue('');
    this.applyPointsRule();
  }

  async approve(): Promise<void> {
    this.submitted.set(true);
    if (this.form.invalid || this.problems().length > 0) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const operation = value.operationType;
    await this.run(() =>
      this.api.approve(this.record.id, {
        version: this.record.version,
        operationType: operation,
        serviceId: value.serviceId,
        staffProfileId: value.staffProfileId,
        customerId: this.customer()?.id ?? null,
        performedOn: value.performedOn,
        chargedAmount: operation === 'Paid' ? value.chargedAmount : null,
        customerMembershipId: operation === 'MembershipConsumption' ? value.customerMembershipId || null : null,
        accruesLoyaltyPoints: operation === 'Paid' && !this.pointsBlocker() && value.accruesLoyaltyPoints,
        notes: value.notes.trim() || null,
      }),
    );
  }

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
          ? 'Ya no tienes permiso para aprobar servicios realizados.'
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

  private async searchSilently(query: string): Promise<ServiceRecordCustomerOption[]> {
    this.isSearching.set(true);
    try {
      return await firstValueFrom(this.api.customerOptions(query));
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
      return [];
    } finally {
      this.isSearching.set(false);
    }
  }
}
