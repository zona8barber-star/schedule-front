import { DatePipe, LowerCasePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
import { DEFAULT_PAGE_SIZE } from '../../../../../core/models/paged-result.models';
import { ServiceRecordsApiService } from '../../../../../core/services/service-records-api.service';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';
import { bogotaToday } from '../../../../../core/utils/bogota-date.utils';
import { PaginatorComponent } from '../../../../../shared/components/paginator/paginator.component';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';
import { PageStateComponent } from '../../../../../shared/components/page-state/page-state.component';

type RegistrationMode = 'appointment' | 'walkIn';

export interface ServiceRecordCatalogGroup {
  categoryId: string;
  categoryName: string;
  services: ServiceRecordCatalogItem[];
}

import { SingleFlight } from '../../../../../core/utils/single-flight';

@Component({
  selector: 'app-staff-service-records-page',
  imports: [DatePipe, LowerCasePipe, ReactiveFormsModule, ApiFeedbackComponent, PageStateComponent, PaginatorComponent],
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
  /** General services the professional can register (ADR-0016 B4), in the order the API returns them. */
  readonly catalog = signal<ServiceRecordCatalogItem[]>([]);
  readonly catalogGroups = computed<ServiceRecordCatalogGroup[]>(() => {
    const groups: ServiceRecordCatalogGroup[] = [];
    for (const service of this.catalog()) {
      let group = groups.find((item) => item.categoryId === service.categoryId);
      if (!group) {
        group = { categoryId: service.categoryId, categoryName: service.categoryName, services: [] };
        groups.push(group);
      }
      group.services.push(service);
    }
    return groups;
  });
  /** Own recent appointments (completed included), from the service records routes: no Staff role needed. */
  readonly appointments = signal<ServiceRecordAppointmentOption[]>([]);
  /** False when the user has the permission but no active professional profile. */
  readonly hasStaffProfile = signal(true);
  readonly records = signal<ServiceRecordView[]>([]);
  /** Own records are paginated on the server (pending first), so every record stays reachable. */
  readonly recordsTotal = signal(0);
  readonly recordsPage = signal(1);
  readonly recordsPageSize = DEFAULT_PAGE_SIZE;
  readonly recordsLoading = signal(false);
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

  constructor() {
    // Choosing an appointment preselects the service booked with it, unless it is already registered there.
    this.form.controls.appointmentId.valueChanges.pipe(takeUntilDestroyed()).subscribe((appointmentId) => {
      this.prefillFromAppointment(appointmentId);
    });
  }

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

      const [catalog, appointments] = await Promise.all([
        firstValueFrom(this.serviceRecordsApi.catalog()),
        firstValueFrom(this.serviceRecordsApi.appointments()),
        this.loadRecords(),
      ]);
      this.catalog.set(catalog);
      this.appointments.set(appointments);

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
    this.successMessage.set(null);
  }

  /** A service already registered (and not rejected) in the chosen appointment cannot be registered again there. */
  isAlreadyRegistered(serviceId: string): boolean {
    if (this.mode() !== 'appointment') {
      return false;
    }
    const appointment = this.appointments().find((item) => item.id === this.form.controls.appointmentId.value);
    return appointment?.registeredGeneralServiceIds.includes(serviceId) ?? false;
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

  @SingleFlight()
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
          generalServiceIds: this.selectedServiceIds(),
          notes: value.notes.trim() || null,
          idempotencyKey: this.idempotencyKey,
        }),
      );
      // New records are pending, so they belong at the top of the first page: reload it from the server.
      this.recordsPage.set(1);
      await this.loadRecords().catch(() => {
        this.records.update((list) => [...created, ...list.filter((record) => !created.some((item) => item.id === record.id))]);
      });
      this.appointments.update((list) =>
        list.map((appointment) =>
          appointment.id === value.appointmentId && fromAppointment
            ? {
                ...appointment,
                registeredGeneralServiceIds: [
                  ...appointment.registeredGeneralServiceIds,
                  ...created.map((record) => record.generalServiceId).filter((id): id is string => !!id),
                ],
              }
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

  private prefillFromAppointment(appointmentId: string): void {
    const appointment = this.appointments().find((item) => item.id === appointmentId);
    const booked = appointment?.generalServiceId;
    const canPrefill =
      !!booked &&
      !appointment.registeredGeneralServiceIds.includes(booked) &&
      this.catalog().some((service) => service.id === booked);
    this.selectedServiceIds.set(canPrefill ? [booked] : []);
  }

  private resetForm(): void {
    this.idempotencyKey = crypto.randomUUID();
    this.selectedServiceIds.set([]);
    this.submitted.set(false);
    this.form.reset({ appointmentId: '', performedOn: this.today, customerName: '', notes: '' });
  }


  async onRecordsPageChange(page: number): Promise<void> {
    this.recordsPage.set(page);
    this.recordsLoading.set(true);
    try {
      await this.loadRecords();
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
    } finally {
      this.recordsLoading.set(false);
    }
  }

  private async loadRecords(): Promise<void> {
    const result = await firstValueFrom(
      this.serviceRecordsApi.mine({ page: this.recordsPage(), pageSize: this.recordsPageSize }),
    );
    this.records.set(result.items);
    this.recordsTotal.set(result.totalCount);
  }
}
