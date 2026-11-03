import { DatePipe, LowerCasePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { getAppointmentStatusLabel } from '../../../../../core/utils/appointment-labels.utils';
import {
  SERVICE_RECORD_MAX_SERVICES,
  SERVICE_RECORD_OPERATION_LABELS,
  SERVICE_RECORD_STATUS_LABELS,
  ServiceRecordAppointmentOption,
  ServiceRecordCatalogItem,
  ServiceRecordView,
} from '../../../../../core/models/service-record.models';
import { ServiceRecordsApiService } from '../../../../../core/services/service-records-api.service';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';
import { bogotaToday } from '../../../../../core/utils/bogota-date.utils';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';
import { PageStateComponent } from '../../../../../shared/components/page-state/page-state.component';

type RegistrationMode = 'appointment' | 'walkIn';

@Component({
  selector: 'app-staff-service-records-page',
  imports: [DatePipe, LowerCasePipe, ReactiveFormsModule, ApiFeedbackComponent, PageStateComponent],
  templateUrl: './staff-service-records-page.component.html',
  styleUrl: './staff-service-records-page.component.scss',
})
export class StaffServiceRecordsPageComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly serviceRecordsApi = inject(ServiceRecordsApiService);

  readonly statusLabels = SERVICE_RECORD_STATUS_LABELS;
  readonly operationLabels = SERVICE_RECORD_OPERATION_LABELS;
  readonly maxServices = SERVICE_RECORD_MAX_SERVICES;
  readonly today = bogotaToday();

  readonly isLoading = signal(true);
  readonly isSubmitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly mode = signal<RegistrationMode>('walkIn');
  readonly catalog = signal<ServiceRecordCatalogItem[]>([]);
  /** Own recent appointments (completed included), from the service records routes: no Staff role needed. */
  readonly appointments = signal<ServiceRecordAppointmentOption[]>([]);
  /** False when the user has the permission but no active professional profile. */
  readonly hasStaffProfile = signal(true);
  readonly records = signal<ServiceRecordView[]>([]);
  readonly selectedServiceIds = signal<string[]>([]);
  readonly submitted = signal(false);

  /** Generated once per intended registration, so a retried submit is not stored twice. */
  private idempotencyKey = crypto.randomUUID();

  readonly form = this.formBuilder.nonNullable.group({
    appointmentId: [''],
    performedOn: [this.today, [Validators.required]],
    customerName: ['', [Validators.maxLength(120)]],
    notes: ['', [Validators.maxLength(500)]],
  });

  readonly selectionProblem = computed(() => {
    const count = this.selectedServiceIds().length;
    if (count === 0) {
      return 'Elige al menos un servicio.';
    }
    return count > this.maxServices ? `Registra como máximo ${this.maxServices} servicios a la vez.` : null;
  });

  async ngOnInit(): Promise<void> {
    try {
      const eligibility = await firstValueFrom(this.serviceRecordsApi.eligibility());
      this.hasStaffProfile.set(eligibility.hasStaffProfile);
      if (!eligibility.hasStaffProfile) {
        return;
      }

      const [catalog, appointments, records] = await Promise.all([
        firstValueFrom(this.serviceRecordsApi.catalog()),
        firstValueFrom(this.serviceRecordsApi.appointments()),
        firstValueFrom(this.serviceRecordsApi.mine()),
      ]);
      this.catalog.set(catalog);
      this.appointments.set(appointments);
      this.records.set(records);

      const requested = this.route.snapshot.queryParamMap.get('appointmentId');
      if (requested && this.appointments().some((appointment) => appointment.id === requested)) {
        this.setMode('appointment');
        this.form.controls.appointmentId.setValue(requested);
      }
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
    } finally {
      this.isLoading.set(false);
    }
  }

  setMode(mode: RegistrationMode): void {
    this.mode.set(mode);
    const appointmentControl = this.form.controls.appointmentId;
    const dateControl = this.form.controls.performedOn;
    if (mode === 'appointment') {
      appointmentControl.setValidators([Validators.required]);
      dateControl.clearValidators();
    } else {
      appointmentControl.clearValidators();
      dateControl.setValidators([Validators.required]);
    }
    appointmentControl.updateValueAndValidity();
    dateControl.updateValueAndValidity();
  }

  /** Starts a registration from one of the recent appointments, completed ones included. */
  registerFrom(appointmentId: string): void {
    this.setMode('appointment');
    this.form.controls.appointmentId.setValue(appointmentId);
    this.selectedServiceIds.set([]);
    this.successMessage.set(null);
  }

  /** A service already registered (and not rejected) in the chosen appointment cannot be registered again there. */
  isAlreadyRegistered(serviceId: string): boolean {
    if (this.mode() !== 'appointment') {
      return false;
    }
    const appointment = this.appointments().find((item) => item.id === this.form.controls.appointmentId.value);
    return appointment?.registeredServiceIds.includes(serviceId) ?? false;
  }

  statusLabel(status: string): string {
    return getAppointmentStatusLabel(status as Parameters<typeof getAppointmentStatusLabel>[0]);
  }

  isSelected(serviceId: string): boolean {
    return this.selectedServiceIds().includes(serviceId);
  }

  toggleService(serviceId: string): void {
    if (this.isAlreadyRegistered(serviceId)) {
      return;
    }
    this.selectedServiceIds.update((ids) =>
      ids.includes(serviceId) ? ids.filter((id) => id !== serviceId) : [...ids, serviceId],
    );
  }

  appointmentLabel(appointment: ServiceRecordAppointmentOption): string {
    const when = new Date(appointment.startsAt).toLocaleString('es-CO', {
      timeZone: 'America/Bogota',
      dateStyle: 'medium',
      timeStyle: 'short',
    });
    return `${when} · ${appointment.customerName}`;
  }

  async submit(): Promise<void> {
    this.submitted.set(true);
    this.successMessage.set(null);
    const futureDate = this.mode() === 'walkIn' && this.form.controls.performedOn.value > this.today;
    if (this.form.invalid || this.selectionProblem() || futureDate) {
      this.form.markAllAsTouched();
      if (futureDate) {
        this.errorMessage.set('La fecha del servicio no puede ser futura.');
      }
      return;
    }

    this.errorMessage.set(null);
    this.isSubmitting.set(true);
    const value = this.form.getRawValue();
    const fromAppointment = this.mode() === 'appointment';
    try {
      const created = await firstValueFrom(
        this.serviceRecordsApi.register({
          appointmentId: fromAppointment ? value.appointmentId : null,
          performedOn: fromAppointment ? null : value.performedOn,
          customerName: fromAppointment ? null : value.customerName.trim() || null,
          serviceIds: this.selectedServiceIds(),
          notes: value.notes.trim() || null,
          idempotencyKey: this.idempotencyKey,
        }),
      );
      this.records.update((list) => [...created, ...list.filter((record) => !created.some((item) => item.id === record.id))]);
      this.appointments.update((list) =>
        list.map((appointment) =>
          appointment.id === value.appointmentId && fromAppointment
            ? { ...appointment, registeredServiceIds: [...appointment.registeredServiceIds, ...created.map((record) => record.serviceId)] }
            : appointment,
        ),
      );
      this.successMessage.set(
        created.length === 1
          ? 'Servicio registrado. Queda pendiente de validación administrativa.'
          : `${created.length} servicios registrados. Quedan pendientes de validación administrativa.`,
      );
      this.resetForm();
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
    } finally {
      this.isSubmitting.set(false);
    }
  }

  private resetForm(): void {
    this.idempotencyKey = crypto.randomUUID();
    this.selectedServiceIds.set([]);
    this.submitted.set(false);
    this.form.reset({ appointmentId: '', performedOn: this.today, customerName: '', notes: '' });
  }

}
