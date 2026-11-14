import { NgClass } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import {
  APPOINTMENT_STATUS,
  AppointmentResponse,
  AppointmentServiceOption,
  AppointmentStatus,
  AppointmentUpdateRequest,
  StaffAppointmentsListFilters,
  StaffManualAppointmentCreateRequest,
} from '../../../../../core/models/appointment.models';
import { DEFAULT_PAGE_SIZE } from '../../../../../core/models/paged-result.models';
import { ServiceRecordEligibilityService } from '../../../../../core/services/service-record-eligibility.service';
import { ConfirmModalService } from '../../../../../core/services/confirm-modal.service';
import { StaffAppointmentsApiService } from '../../../../../core/services/staff-appointments-api.service';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';
import { formatDateTimeLocal, toUtcIsoString } from '../../../../../core/utils/availability-form.utils';
import { addDaysToDateKey, bogotaDateTimeFormat, bogotaToday } from '../../../../../core/utils/bogota-date.utils';
import {
  QueryValue,
  readDateParam,
  readOptionParam,
  readPageParam,
  readPageSizeParam,
  toQueryParams,
} from '../../../../../core/utils/list-query.utils';
import {
  HISTORY_RANGE_HINT,
  HistoryRange,
  historyRangeError,
  rangeWithFrom,
  rangeWithTo,
  resolveHistoryRange,
} from '../../../../../core/utils/history-range.utils';
import {
  getAppointmentDurationMinutes,
  getAppointmentServiceLabel,
  getAppointmentSourceLabel,
  getAppointmentStatusLabel,
} from '../../../../../core/utils/appointment-labels.utils';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';
import { PageStateComponent } from '../../../../../shared/components/page-state/page-state.component';
import { PaginatorComponent } from '../../../../../shared/components/paginator/paginator.component';
import { PullToRefreshDirective } from '../../../../../shared/directives/pull-to-refresh.directive';
import { trimmedMinLength, trimmedRequired } from '../../../../../core/utils/form-validators';

type AgendaTab = 'today' | 'upcoming' | 'history';

const TABS: readonly AgendaTab[] = ['today', 'upcoming', 'history'];
const STATUSES: readonly AppointmentStatus[] = Object.values(APPOINTMENT_STATUS);
/** Today and upcoming only list what can still be attended. */
const ACTIVE_STATUSES = `${APPOINTMENT_STATUS.pending},${APPOINTMENT_STATUS.confirmed}`;

/**
 * The professional's agenda (ADR-0016 B7): today and upcoming (active appointments, soonest first) and the history
 * (date range and status, newest first), each paginated on the server; the tab and the filters live in the URL.
 */
import { FieldErrorComponent } from '../../../../../shared/components/field-error/field-error.component';

import { ModalDialogDirective } from '../../../../../shared/directives/modal-dialog.directive';

import { FormA11yDirective } from '../../../../../shared/directives/form-a11y.directive';

import { SingleFlight } from '../../../../../core/utils/single-flight';

@Component({
  selector: 'app-staff-appointments-page',
  imports: [FormA11yDirective, ModalDialogDirective, FieldErrorComponent, 
    NgClass,
    ReactiveFormsModule,
    RouterLink,
    ApiFeedbackComponent,
    PageStateComponent,
    PaginatorComponent,
    PullToRefreshDirective,
  ],
  templateUrl: './staff-appointments-page.component.html',
  styleUrl: './staff-appointments-page.component.scss',
})
export class StaffAppointmentsPageComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly staffAppointmentsApiService = inject(StaffAppointmentsApiService);
  private readonly confirmModal = inject(ConfirmModalService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private loadSequence = 0;
  /** Permission plus an active professional profile; completed appointments are registered from that page. */
  readonly canRegisterServices = inject(ServiceRecordEligibilityService).canRegister;
  // Bogotá time whatever the device timezone (SONDA BUG-033).
  private readonly timeFormatter = bogotaDateTimeFormat('es-AR', { timeStyle: 'short' });
  private readonly dateTimeFormatter = bogotaDateTimeFormat('es-AR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  // ── State ──────────────────────────────────────────────────────────────
  readonly appointments = signal<AppointmentResponse[]>([]);
  readonly isLoading = signal(true);
  readonly isCreating = signal(false);
  readonly isSavingEdit = signal(false);
  readonly showCreateModal = signal(false);
  readonly editingAppointmentId = signal<string | null>(null);
  readonly busyActionKey = signal<string | null>(null);
  readonly activeTab = signal<AgendaTab>('today');
  readonly statuses = STATUSES;
  readonly historyFrom = signal('');
  readonly historyTo = signal('');
  readonly historyStatus = signal<AppointmentStatus | ''>('');
  readonly rangeHint = HISTORY_RANGE_HINT;
  /** Set when the history range in the URL cannot be queried (reversed or over 30 days); nothing is requested then. */
  readonly rangeError = signal<string | null>(null);
  /** The window the history queries: the last 30 days (today included) by default. */
  readonly historyRange = computed<HistoryRange>(() =>
    resolveHistoryRange(this.historyFrom(), this.historyTo(), bogotaToday()),
  );
  readonly page = signal(1);
  readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  readonly totalCount = signal(0);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly createSubmitted = signal(false);
  readonly editSubmitted = signal(false);
  /** Bookable offerings of this professional (ADR-0016 B3); loaded when a form opens. */
  readonly serviceOptions = signal<AppointmentServiceOption[]>([]);
  readonly serviceOptionsError = signal<string | null>(null);
  private serviceOptionsLoaded = false;

  // ── Computed ───────────────────────────────────────────────────────────
  /** The current page of the active tab, in the server's order. */
  readonly activeAppointments = computed(() => this.appointments());

  // ── Forms ──────────────────────────────────────────────────────────────
  readonly createForm = this.formBuilder.nonNullable.group({
    startsAt: ['', [Validators.required]],
    generalServiceId: ['', [Validators.required]],
    customerName: ['', [trimmedRequired, trimmedMinLength(2), Validators.maxLength(120)]],
    customerEmail: ['', [Validators.email, Validators.maxLength(256)]],
    customerPhone: ['', [Validators.maxLength(40)]],
    notes: ['', [Validators.maxLength(2000)]],
  });

  readonly editForm = this.formBuilder.nonNullable.group({
    startsAt: ['', [Validators.required]],
    /** '' keeps the current service (appointments booked before services existed). */
    generalServiceId: [''],
    customerName: ['', [trimmedRequired, trimmedMinLength(2), Validators.maxLength(120)]],
    customerEmail: ['', [Validators.email, Validators.maxLength(256)]],
    customerPhone: ['', [Validators.maxLength(40)]],
    notes: ['', [Validators.maxLength(2000)]],
  });

  // ── Lifecycle ──────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.applyQuery(params);
      void this.loadAppointments();
    });
  }

  setTab(tab: AgendaTab): void {
    this.navigate({ tab: tab === 'today' ? null : tab, from: null, to: null, status: null, page: 1 });
  }

  onHistoryFilterChange(patch: Record<string, QueryValue>): void {
    this.navigate({ ...patch, page: 1 });
  }

  /** Moving one end keeps the history window valid (at most 30 days). */
  onHistoryFromChange(value: string): void {
    this.navigate({ ...rangeWithFrom(value, this.historyRange()), page: 1 });
  }

  onHistoryToChange(value: string): void {
    this.navigate({ ...rangeWithTo(value, this.historyRange()), page: 1 });
  }

  onPageChange(page: number): void {
    this.navigate({ page });
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.showCreateModal()) {
      this.closeCreateModal();
    } else if (this.editingAppointmentId()) {
      this.cancelEdit();
    }
  }

  // ── Create modal ───────────────────────────────────────────────────────
  openCreateModal(): void {
    this.createSubmitted.set(false);
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.createForm.reset({
      startsAt: '',
      generalServiceId: '',
      customerName: '',
      customerEmail: '',
      customerPhone: '',
      notes: '',
    });
    this.showCreateModal.set(true);
    void this.ensureServiceOptions().then(() => {
      const options = this.serviceOptions();
      if (options.length === 1 && !this.createForm.controls.generalServiceId.value) {
        this.createForm.controls.generalServiceId.setValue(options[0].generalServiceId);
      }
    });
  }

  closeCreateModal(): void {
    this.showCreateModal.set(false);
    this.createSubmitted.set(false);
  }

  @SingleFlight()
  async submitCreate(): Promise<void> {
    this.createSubmitted.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }

    this.isCreating.set(true);

    const value = this.createForm.getRawValue();
    const request: StaffManualAppointmentCreateRequest = {
      // The duration comes from this professional's offering of the service; it cannot be changed here.
      // A 409 Conflict response means the slot overlaps an existing appointment
      // or falls outside the configured availability rules.
      startsAtUtc: toUtcIsoString(value.startsAt),
      generalServiceId: value.generalServiceId,
      customerName: value.customerName.trim(),
      customerEmail: normalizeOptionalText(value.customerEmail),
      customerPhone: normalizeOptionalText(value.customerPhone),
      notes: normalizeOptionalText(value.notes),
    };

    try {
      await firstValueFrom(this.staffAppointmentsApiService.createManual(request));
      await this.loadAppointments();
      this.closeCreateModal();
      this.successMessage.set('La cita manual fue creada correctamente.');
    } catch (error) {
      this.errorMessage.set(getStaffAppointmentErrorMessage(error, 'create'));
    } finally {
      this.isCreating.set(false);
    }
  }

  // ── Edit ───────────────────────────────────────────────────────────────
  startEdit(appointment: AppointmentResponse): void {
    void this.ensureServiceOptions();
    this.editingAppointmentId.set(appointment.id);
    this.editSubmitted.set(false);
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.editForm.patchValue({
      startsAt: formatDateTimeLocal(appointment.startsAtUtc),
      generalServiceId: appointment.generalServiceId ?? '',
      customerName: appointment.customerName,
      customerEmail: appointment.customerEmail ?? '',
      customerPhone: appointment.customerPhone ?? '',
      notes: appointment.notes ?? '',
    });
  }

  cancelEdit(): void {
    this.editingAppointmentId.set(null);
    this.editSubmitted.set(false);
    this.editForm.reset({
      startsAt: '',
      generalServiceId: '',
      customerName: '',
      customerEmail: '',
      customerPhone: '',
      notes: '',
    });
  }

  @SingleFlight()
  async submitEdit(): Promise<void> {
    this.editSubmitted.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    const appointmentId = this.editingAppointmentId();
    if (!appointmentId) return;

    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }

    this.isSavingEdit.set(true);
    const value = this.editForm.getRawValue();

    const current = this.appointments().find((appointment) => appointment.id === appointmentId);
    // Only a different service is sent; the duration is never sent (it follows the offering).
    const changedServiceId =
      value.generalServiceId && value.generalServiceId !== current?.generalServiceId
        ? value.generalServiceId
        : null;
    const request: AppointmentUpdateRequest = {
      startsAtUtc: toUtcIsoString(value.startsAt),
      customerName: value.customerName.trim(),
      customerEmail: normalizeOptionalText(value.customerEmail),
      customerPhone: normalizeOptionalText(value.customerPhone),
      notes: normalizeOptionalText(value.notes),
      generalServiceId: changedServiceId,
    };

    try {
      await firstValueFrom(this.staffAppointmentsApiService.update(appointmentId, request));
      await this.loadAppointments();
      this.cancelEdit();
      this.successMessage.set('La cita fue actualizada correctamente.');
    } catch (error) {
      this.errorMessage.set(getStaffAppointmentErrorMessage(error, 'update'));
    } finally {
      this.isSavingEdit.set(false);
    }
  }

  // ── Status actions ─────────────────────────────────────────────────────
  /** A pending booking is approved by the professional; only pending ones offer it (SONDA BUG-028). */
  canConfirm(appointment: AppointmentResponse): boolean {
    return appointment.status === APPOINTMENT_STATUS.pending;
  }

  @SingleFlight()
  async confirmAppointment(appointment: AppointmentResponse): Promise<void> {
    if (!this.canConfirm(appointment)) return;

    await this.executeStatusAction(
      appointment,
      'confirm',
      () => this.staffAppointmentsApiService.confirm(appointment.id),
      'Cita confirmada. Le avisamos al cliente.',
    );
  }

  @SingleFlight()
  async markCompleted(appointment: AppointmentResponse): Promise<void> {
    await this.executeStatusAction(
      appointment,
      'complete',
      () => this.staffAppointmentsApiService.markCompleted(appointment.id),
      'Cita marcada como completada.',
    );
  }

  @SingleFlight()
  async markNoShow(appointment: AppointmentResponse): Promise<void> {
    await this.executeStatusAction(
      appointment,
      'no-show',
      () => this.staffAppointmentsApiService.markNoShow(appointment.id),
      'Cita marcada como no-show.',
    );
  }

  // ── Delete (cancel in system) ──────────────────────────────────────────
  @SingleFlight()
  async deleteAppointment(appointment: AppointmentResponse): Promise<void> {
    const confirmed = await this.confirmModal.confirm({
      title: '¿Eliminar esta cita?',
      message: `${appointment.customerName} — ${this.formatDateTimeRange(appointment.startsAtUtc, appointment.endsAtUtc)}`,
    });
    if (!confirmed) return;

    // TODO: Definir si se notifica al cliente por algún medio (email, WhatsApp, etc.)
    // Por ahora solo se cancela en el sistema.
    await this.executeStatusAction(
      appointment,
      'delete',
      () => this.staffAppointmentsApiService.cancel(appointment.id),
      'La cita fue eliminada del sistema.',
    );
  }

  // ── Guards / helpers ───────────────────────────────────────────────────
  /** Services can be registered once the appointment started; registering never changes its status. */
  hasStarted(appointment: AppointmentResponse): boolean {
    return new Date(appointment.startsAtUtc).getTime() <= Date.now();
  }

  canTransition(appointment: AppointmentResponse): boolean {
    return (
      appointment.status === APPOINTMENT_STATUS.pending ||
      appointment.status === APPOINTMENT_STATUS.confirmed
    );
  }

  isBusyFor(appointmentId: string, action: string): boolean {
    return (
      this.busyActionKey() === this.actionKey(appointmentId, action) ||
      (action === 'edit' && this.isSavingEdit())
    );
  }

  isAnythingBusy(): boolean {
    return this.busyActionKey() !== null || this.isSavingEdit();
  }

  // ── Services (ADR-0016 B3) ─────────────────────────────────────────────
  formatServiceOption(option: AppointmentServiceOption): string {
    return `${option.name} · ${option.durationMinutes} min`;
  }

  serviceLabel(appointment: AppointmentResponse): string | null {
    return getAppointmentServiceLabel(appointment);
  }

  /** Read-only: the professional's duration for the chosen service. */
  createDurationMinutes(): number | null {
    return this.findServiceOption(this.createForm.controls.generalServiceId.value)?.durationMinutes ?? null;
  }

  /** Options for the edit form: the bookable ones plus the appointment's current service if it is not bookable. */
  editServiceOptions(appointment: AppointmentResponse): AppointmentServiceOption[] {
    const options = this.serviceOptions();
    if (!appointment.generalServiceId || options.some((o) => o.generalServiceId === appointment.generalServiceId)) {
      return options;
    }

    return [
      {
        generalServiceId: appointment.generalServiceId,
        name: appointment.generalServiceName ?? 'Servicio actual',
        categoryId: '',
        categoryName: '',
        durationMinutes: getAppointmentDurationMinutes(appointment),
      },
      ...options,
    ];
  }

  /** Read-only: the reserved duration is kept unless the service changes to another offering. */
  editDurationMinutes(appointment: AppointmentResponse): number {
    const selectedId = this.editForm.controls.generalServiceId.value;
    if (!selectedId || selectedId === appointment.generalServiceId) {
      return getAppointmentDurationMinutes(appointment);
    }

    return this.findServiceOption(selectedId)?.durationMinutes ?? getAppointmentDurationMinutes(appointment);
  }

  private findServiceOption(generalServiceId: string): AppointmentServiceOption | null {
    return this.serviceOptions().find((option) => option.generalServiceId === generalServiceId) ?? null;
  }

  private async ensureServiceOptions(): Promise<void> {
    if (this.serviceOptionsLoaded) {
      return;
    }

    this.serviceOptionsError.set(null);
    try {
      this.serviceOptions.set(await firstValueFrom(this.staffAppointmentsApiService.serviceOptions()));
      this.serviceOptionsLoaded = true;
    } catch (error) {
      this.serviceOptionsError.set(getApiErrorMessage(error, 'No pudimos cargar tus servicios.'));
    }
  }

  // ── Error display ──────────────────────────────────────────────────────
  showCreateError(
    controlName: 'startsAt' | 'generalServiceId' | 'customerName' | 'customerEmail' | 'customerPhone' | 'notes',
    errorName: string,
  ): boolean {
    const control = this.createForm.controls[controlName];
    return control.hasError(errorName) && (control.touched || this.createSubmitted());
  }

  showEditError(
    controlName:
      | 'startsAt'
      | 'customerName'
      | 'customerEmail'
      | 'customerPhone'
      | 'notes',
    errorName: string,
  ): boolean {
    const control = this.editForm.controls[controlName];
    return control.hasError(errorName) && (control.touched || this.editSubmitted());
  }

  // ── Formatting ─────────────────────────────────────────────────────────
  statusLabel(status: AppointmentResponse['status']): string {
    return getAppointmentStatusLabel(status);
  }

  sourceLabel(source: AppointmentResponse['source']): string {
    return getAppointmentSourceLabel(source);
  }

  formatDateTime(value: string): string {
    return this.dateTimeFormatter.format(new Date(value));
  }

  formatTime(value: string): string {
    return this.timeFormatter.format(new Date(value));
  }

  formatDateTimeRange(startsAtUtc: string, endsAtUtc: string): string {
    return `${this.formatDateTime(startsAtUtc)} — ${this.formatTime(endsAtUtc)}`;
  }

  statusClass(status: AppointmentResponse['status']): string {
    switch (status) {
      case APPOINTMENT_STATUS.pending:
        return 'appt-card__status--pending';
      case APPOINTMENT_STATUS.confirmed:
        return 'appt-card__status--confirmed';
      case APPOINTMENT_STATUS.completed:
        return 'appt-card__status--completed';
      case APPOINTMENT_STATUS.cancelled:
        return 'appt-card__status--cancelled';
      case APPOINTMENT_STATUS.noShow:
        return 'appt-card__status--noshow';
      default:
        return '';
    }
  }

  // ── Private ────────────────────────────────────────────────────────────
  async loadAppointments(): Promise<void> {
    const sequence = ++this.loadSequence;
    const range = this.activeTab() === 'history' ? this.historyRange() : null;
    this.rangeError.set(range ? historyRangeError(range.from, range.to) : null);
    if (this.rangeError()) {
      // The API would reject it too (422); explain it instead of a generic error.
      this.appointments.set([]);
      this.totalCount.set(0);
      this.isLoading.set(false);
      return;
    }
    this.isLoading.set(true);
    try {
      const result = await firstValueFrom(this.staffAppointmentsApiService.list(this.currentFilters()));
      if (sequence === this.loadSequence) {
        this.appointments.set(result.items);
        this.totalCount.set(result.totalCount);
      }
    } catch (error) {
      if (sequence === this.loadSequence) {
        this.errorMessage.set(getApiErrorMessage(error));
        this.appointments.set([]);
        this.totalCount.set(0);
      }
    } finally {
      if (sequence === this.loadSequence) {
        this.isLoading.set(false);
      }
    }
  }

  private applyQuery(params: ParamMap): void {
    this.activeTab.set(readOptionParam(params, 'tab', TABS) || 'today');
    this.historyFrom.set(readDateParam(params, 'from'));
    this.historyTo.set(readDateParam(params, 'to'));
    this.historyStatus.set(readOptionParam(params, 'status', STATUSES));
    this.page.set(readPageParam(params));
    this.pageSize.set(readPageSizeParam(params));
  }

  private navigate(patch: Record<string, QueryValue>): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: toQueryParams(patch), queryParamsHandling: 'merge' });
  }

  private currentFilters(): StaffAppointmentsListFilters {
    const today = bogotaToday();
    const paging = { page: this.page(), pageSize: this.pageSize() };
    switch (this.activeTab()) {
      case 'today':
        return { from: today, to: today, status: ACTIVE_STATUSES, sort: 'Asc', scope: 'Agenda', ...paging };
      case 'upcoming':
        return { from: addDaysToDateKey(today, 1), status: ACTIVE_STATUSES, sort: 'Asc', scope: 'Agenda', ...paging };
      case 'history':
        return {
          ...this.historyRange(),
          status: this.historyStatus() || null,
          sort: 'Desc',
          scope: 'History',
          ...paging,
        };
    }
  }

  private async executeStatusAction(
    appointment: AppointmentResponse,
    action: string,
    requestFactory: () => ReturnType<StaffAppointmentsApiService['markCompleted']>,
    successMessage: string,
  ): Promise<void> {
    if (action !== 'delete' && !this.canTransition(appointment)) return;

    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.busyActionKey.set(this.actionKey(appointment.id, action));

    try {
      await firstValueFrom(requestFactory());
      await this.loadAppointments();
      this.successMessage.set(successMessage);
    } catch (error) {
      this.errorMessage.set(getStaffAppointmentErrorMessage(error, 'status'));
    } finally {
      this.busyActionKey.set(null);
    }
  }

  private actionKey(appointmentId: string, action: string): string {
    return `${appointmentId}:${action}`;
  }
}

// ── Utilities ──────────────────────────────────────────────────────────────
function normalizeOptionalText(value: string | null | undefined): string | null {
  const v = value?.trim() ?? '';
  return v || null;
}

function getStaffAppointmentErrorMessage(
  error: unknown,
  action: 'create' | 'update' | 'status',
): string {
  if (isHttpConflict(error)) {
    if (action === 'create') {
      return 'El horario seleccionado no está disponible. Puede estar ocupado o fuera de tu configuración de disponibilidad. Elige otro turno.';
    }
    if (action === 'update') {
      return 'No se pudo actualizar la cita porque el nuevo horario entra en conflicto.';
    }
    return 'No se pudo cambiar el estado por un conflicto con la cita actual.';
  }

  let fallback = 'No se pudo actualizar el estado de la cita.';
  if (action === 'create')
    fallback = 'No se pudo crear la cita. Verifica los datos e intenta nuevamente.';
  if (action === 'update')
    fallback = 'No se pudo actualizar la cita. Verifica los datos e intenta nuevamente.';
  return getApiErrorMessage(error, fallback);
}

function isHttpConflict(error: unknown): boolean {
  return error instanceof HttpErrorResponse && error.status === 409;
}

