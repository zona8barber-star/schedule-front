import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import {
  APPOINTMENT_DURATION_RANGE,
  APPOINTMENT_STATUS,
  AdminAppointmentsListFilters,
  AdminManualAppointmentCreateRequest,
  AppointmentResponse,
  AppointmentServiceOption,
  AppointmentStatus,
  AppointmentUpdateRequest,
} from '../../../../../core/models/appointment.models';
import { DEFAULT_PAGE_SIZE } from '../../../../../core/models/paged-result.models';
import { GeneralServiceView } from '../../../../../core/models/service-catalog.models';
import { StaffListItem } from '../../../../../core/models/staff.models';
import { AdminAppointmentsApiService } from '../../../../../core/services/admin-appointments-api.service';
import { AdminServiceCatalogApiService } from '../../../../../core/services/admin-service-catalog-api.service';
import { AdminStaffApiService } from '../../../../../core/services/admin-staff-api.service';
import {
  getAppointmentDurationMinutes,
  getAppointmentServiceLabel,
  getAppointmentSourceLabel,
  getAppointmentStatusLabel,
} from '../../../../../core/utils/appointment-labels.utils';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';
import {
  QueryValue,
  readDateParam,
  readOptionParam,
  readPageParam,
  readPageSizeParam,
  readTextParam,
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
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';
import { PageStateComponent } from '../../../../../shared/components/page-state/page-state.component';
import { PaginatorComponent } from '../../../../../shared/components/paginator/paginator.component';

type AppointmentsTab = 'today' | 'upcoming' | 'past';

const TABS: readonly AppointmentsTab[] = ['today', 'upcoming', 'past'];
const STATUSES: readonly AppointmentStatus[] = Object.values(APPOINTMENT_STATUS);

/**
 * The whole agenda (ADR-0016 B7): today, upcoming (soonest first) and past (newest first), each paginated on the server
 * with professional, status, general service, customer and date range filters kept in the URL.
 */

@Component({
  selector: 'app-admin-appointments-page',
  imports: [ReactiveFormsModule, ApiFeedbackComponent, PageStateComponent, PaginatorComponent],
  templateUrl: './admin-appointments-page.component.html',
  styleUrl: './admin-appointments-page.component.scss',
})
export class AdminAppointmentsPageComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly adminAppointmentsApiService = inject(AdminAppointmentsApiService);
  private readonly adminStaffApiService = inject(AdminStaffApiService);
  private readonly catalogApi = inject(AdminServiceCatalogApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private loadSequence = 0;
  private readonly dateFormatter = new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium' });
  private readonly timeFormatter = new Intl.DateTimeFormat('es-AR', { timeStyle: 'short' });
  private readonly todayStr = toLocalDateStr(new Date());
  readonly rangeHint = HISTORY_RANGE_HINT;
  /** Set when the history range in the URL cannot be queried (reversed or over 30 days); nothing is requested then. */
  readonly rangeError = signal<string | null>(null);
  /** Dates shown in the inputs: the history always shows the window it queries (the last 30 days by default). */
  readonly shownFrom = computed(() => (this.activeTab() === 'past' ? this.pastRange().from : this.dateFrom()));
  readonly shownTo = computed(() => (this.activeTab() === 'past' ? this.pastRange().to : this.dateTo()));

  readonly appointments = signal<AppointmentResponse[]>([]);
  readonly staffMembers = signal<StaffListItem[]>([]);
  readonly isLoading = signal(true);
  readonly isCreating = signal(false);
  readonly isSavingEdit = signal(false);
  readonly editingAppointmentId = signal<string | null>(null);
  readonly busyActionKey = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly createSubmitted = signal(false);
  readonly editSubmitted = signal(false);
  readonly activeTab = signal<AppointmentsTab>('today');
  readonly showCreateForm = signal(false);
  readonly dateFrom = signal('');
  readonly dateTo = signal('');
  readonly statuses = STATUSES;
  readonly statusFilter = signal<AppointmentStatus | ''>('');
  readonly generalServiceFilter = signal('');
  readonly customerFilter = signal('');
  readonly page = signal(1);
  readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  readonly totalCount = signal(0);
  readonly generalServices = signal<GeneralServiceView[]>([]);
  readonly durationRange = APPOINTMENT_DURATION_RANGE;
  /** Bookable offerings of the professional selected in the create form (ADR-0016 B3). */
  readonly createServiceOptions = signal<AppointmentServiceOption[]>([]);
  /** Bookable offerings of the professional of the appointment being edited. */
  readonly editServiceOptions = signal<AppointmentServiceOption[]>([]);
  readonly serviceOptionsError = signal<string | null>(null);

  readonly staffById = computed(() =>
    this.staffMembers().reduce<Record<string, StaffListItem>>((acc, s) => {
      acc[s.staffProfileId] = s;
      return acc;
    }, {}),
  );

  readonly editingAppointment = computed(() => {
    const id = this.editingAppointmentId();
    return id ? (this.appointments().find(a => a.id === id) ?? null) : null;
  });

  /** The current page of the active tab (the server applies the tab window, the filters and the order). */
  readonly activeAppointments = computed(() => this.appointments());

  readonly filterForm = this.formBuilder.nonNullable.group({
    staffProfileId: [''],
  });

  readonly createForm = this.formBuilder.nonNullable.group({
    staffProfileId: ['', [Validators.required]],
    startsAt: ['', [Validators.required]],
    generalServiceId: ['', [Validators.required]],
    /** Prefilled from the offering; the admin may override it. */
    durationMinutes: [
      null as number | null,
      [Validators.required, Validators.min(APPOINTMENT_DURATION_RANGE.min), Validators.max(APPOINTMENT_DURATION_RANGE.max)],
    ],
    customerName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    customerEmail: ['', [Validators.email, Validators.maxLength(256)]],
    customerPhone: ['', [Validators.maxLength(40)]],
    notes: ['', [Validators.maxLength(2000)]],
  });

  readonly editForm = this.formBuilder.nonNullable.group({
    startsAt: ['', [Validators.required]],
    /** '' keeps the current service (appointments booked before services existed). */
    generalServiceId: [''],
    durationMinutes: [
      null as number | null,
      [Validators.required, Validators.min(APPOINTMENT_DURATION_RANGE.min), Validators.max(APPOINTMENT_DURATION_RANGE.max)],
    ],
    customerName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    customerEmail: ['', [Validators.email, Validators.maxLength(256)]],
    customerPhone: ['', [Validators.maxLength(40)]],
    notes: ['', [Validators.maxLength(2000)]],
  });

  constructor() {
    // Another professional offers other services: reload them and drop the chosen one.
    this.createForm.controls.staffProfileId.valueChanges.pipe(takeUntilDestroyed()).subscribe((staffProfileId) => {
      this.createForm.patchValue({ generalServiceId: '', durationMinutes: null }, { emitEvent: false });
      void this.loadCreateServiceOptions(staffProfileId);
    });

    this.createForm.controls.generalServiceId.valueChanges.pipe(takeUntilDestroyed()).subscribe((generalServiceId) => {
      const option = this.createServiceOptions().find((o) => o.generalServiceId === generalServiceId);
      this.createForm.controls.durationMinutes.setValue(option?.durationMinutes ?? null);
    });

    this.editForm.controls.generalServiceId.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      const appointment = this.editingAppointment();
      if (appointment) {
        this.editForm.controls.durationMinutes.setValue(this.defaultEditDuration(appointment));
      }
    });
  }

  ngOnInit(): void {
    void this.bootstrap();
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.editingAppointmentId() && !this.isSavingEdit()) {
      this.cancelEdit();
    } else if (this.showCreateForm() && !this.isCreating()) {
      this.closeCreateForm();
    }
  }

  setTab(tab: AppointmentsTab): void {
    this.navigate({ tab: tab === 'today' ? null : tab, from: null, to: null, page: 1 });
  }

  setDateFrom(value: string): void {
    if (this.activeTab() === 'past') {
      this.navigate({ ...rangeWithFrom(value, this.pastRange(), this.yesterday()), page: 1 });
      return;
    }
    this.navigate({ from: value, page: 1 });
  }

  setDateTo(value: string): void {
    if (this.activeTab() === 'past') {
      this.navigate({ ...rangeWithTo(value, this.pastRange()), page: 1 });
      return;
    }
    this.navigate({ to: value, page: 1 });
  }

  /**
   * The history window ("Pasadas"): what the URL says, completed like the API does, ending yesterday at the latest;
   * the last 30 days up to yesterday by default.
   */
  private pastRange(): HistoryRange {
    const yesterday = this.yesterday();
    const resolved = resolveHistoryRange(this.dateFrom(), this.dateTo(), yesterday);
    return { from: resolved.from, to: minDate(yesterday, resolved.to) };
  }

  private yesterday(): string {
    return addDays(this.todayStr, -1);
  }

  onFilterChange(patch: Record<string, QueryValue>): void {
    this.navigate({ ...patch, page: 1 });
  }

  onPageChange(page: number): void {
    this.navigate({ page });
  }

  openCreateForm(): void {
    this.showCreateForm.set(true);
    const staffProfileId = this.createForm.controls.staffProfileId.value;
    if (staffProfileId && !this.createServiceOptions().length) {
      void this.loadCreateServiceOptions(staffProfileId);
    }
  }

  closeCreateForm(): void {
    this.showCreateForm.set(false);
    this.resetCreateForm();
  }

  applyFilter(): void {
    this.navigate({ staffProfileId: this.filterForm.controls.staffProfileId.value, page: 1 });
  }

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

    const offering = this.createServiceOptions().find((o) => o.generalServiceId === value.generalServiceId);
    const request: AdminManualAppointmentCreateRequest = {
      staffProfileId: value.staffProfileId,
      startsAtUtc: toUtcIsoString(value.startsAt),
      generalServiceId: value.generalServiceId,
      customerName: value.customerName.trim(),
      customerEmail: normalizeOptionalText(value.customerEmail),
      customerPhone: normalizeOptionalText(value.customerPhone),
      notes: normalizeOptionalText(value.notes),
      // Only an override is sent; otherwise the backend uses the offering's duration.
      durationMinutes: value.durationMinutes !== offering?.durationMinutes ? value.durationMinutes : null,
    };

    try {
      await firstValueFrom(this.adminAppointmentsApiService.createManual(request));
      await this.loadAppointments();
      this.closeCreateForm();
      this.successMessage.set('La cita manual fue creada correctamente.');
    } catch (error) {
      this.errorMessage.set(getAdminAppointmentErrorMessage(error, 'create'));
    } finally {
      this.isCreating.set(false);
    }
  }

  startEdit(appointment: AppointmentResponse): void {
    this.editingAppointmentId.set(appointment.id);
    this.editSubmitted.set(false);
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.editServiceOptions.set([]);
    this.editForm.patchValue(
      {
        startsAt: formatDateTimeLocal(appointment.startsAtUtc),
        generalServiceId: appointment.generalServiceId ?? '',
        durationMinutes: getAppointmentDurationMinutes(appointment),
        customerName: appointment.customerName,
        customerEmail: appointment.customerEmail ?? '',
        customerPhone: appointment.customerPhone ?? '',
        notes: appointment.notes ?? '',
      },
      { emitEvent: false },
    );
    void this.loadEditServiceOptions(appointment.staffProfileId);
  }

  cancelEdit(): void {
    this.editingAppointmentId.set(null);
    this.editSubmitted.set(false);
    this.editForm.reset(
      {
        startsAt: '',
        generalServiceId: '',
        durationMinutes: null,
        customerName: '',
        customerEmail: '',
        customerPhone: '',
        notes: '',
      },
      { emitEvent: false },
    );
  }

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

    const current = this.editingAppointment();
    const changedServiceId =
      value.generalServiceId && value.generalServiceId !== current?.generalServiceId
        ? value.generalServiceId
        : null;
    const defaultDuration = current ? this.defaultEditDuration(current) : null;
    const request: AppointmentUpdateRequest = {
      startsAtUtc: toUtcIsoString(value.startsAt),
      customerName: value.customerName.trim(),
      customerEmail: normalizeOptionalText(value.customerEmail),
      customerPhone: normalizeOptionalText(value.customerPhone),
      notes: normalizeOptionalText(value.notes),
      // null keeps the current service / the reserved (or new offering's) duration.
      generalServiceId: changedServiceId,
      durationMinutes: value.durationMinutes !== defaultDuration ? value.durationMinutes : null,
    };

    try {
      await firstValueFrom(this.adminAppointmentsApiService.update(appointmentId, request));
      await this.loadAppointments();
      this.cancelEdit();
      this.successMessage.set('La cita fue actualizada correctamente.');
    } catch (error) {
      this.errorMessage.set(getAdminAppointmentErrorMessage(error, 'update'));
    } finally {
      this.isSavingEdit.set(false);
    }
  }

  async markCompleted(appointment: AppointmentResponse): Promise<void> {
    await this.executeStatusAction(
      appointment,
      'complete',
      () => this.adminAppointmentsApiService.markCompleted(appointment.id),
      'Cita marcada como completada.',
    );
  }

  async cancelAppointment(appointment: AppointmentResponse): Promise<void> {
    await this.executeStatusAction(
      appointment,
      'cancel',
      () => this.adminAppointmentsApiService.cancel(appointment.id),
      'Cita cancelada correctamente.',
    );
  }

  async markNoShow(appointment: AppointmentResponse): Promise<void> {
    await this.executeStatusAction(
      appointment,
      'no-show',
      () => this.adminAppointmentsApiService.markNoShow(appointment.id),
      'Cita marcada como no-show.',
    );
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

  showCreateError(
    controlName:
      | 'staffProfileId'
      | 'startsAt'
      | 'generalServiceId'
      | 'durationMinutes'
      | 'customerName'
      | 'customerEmail'
      | 'customerPhone'
      | 'notes',
    errorName: string,
  ): boolean {
    const control = this.createForm.controls[controlName];
    return control.hasError(errorName) && (control.touched || this.createSubmitted());
  }

  showEditError(
    controlName: 'startsAt' | 'durationMinutes' | 'customerName' | 'customerEmail' | 'customerPhone' | 'notes',
    errorName: string,
  ): boolean {
    const control = this.editForm.controls[controlName];
    return control.hasError(errorName) && (control.touched || this.editSubmitted());
  }

  formatServiceOption(option: AppointmentServiceOption): string {
    return `${option.name} · ${option.durationMinutes} min`;
  }

  serviceLabel(appointment: AppointmentResponse): string | null {
    return getAppointmentServiceLabel(appointment);
  }

  /** Bookable offerings plus the appointment's current service when it is no longer bookable. */
  editServiceChoices(appointment: AppointmentResponse): AppointmentServiceOption[] {
    const options = this.editServiceOptions();
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

  statusLabel(status: AppointmentResponse['status']): string {
    return getAppointmentStatusLabel(status);
  }

  sourceLabel(source: AppointmentResponse['source']): string {
    return getAppointmentSourceLabel(source);
  }

  staffName(staffProfileId: string): string {
    const s = this.staffById()[staffProfileId];
    return s ? s.displayName : staffProfileId;
  }

  staffDisplayLabel(staffMember: StaffListItem): string {
    return `${staffMember.displayName} (${staffMember.fullName})`;
  }

  formatDate(value: string): string {
    return this.dateFormatter.format(new Date(value));
  }

  formatTime(value: string): string {
    return this.timeFormatter.format(new Date(value));
  }

  formatDateTimeRange(startsAtUtc: string, endsAtUtc: string): string {
    return `${this.formatDate(startsAtUtc)} ${this.formatTime(startsAtUtc)} – ${this.formatTime(endsAtUtc)}`;
  }

  private resetCreateForm(): void {
    this.createSubmitted.set(false);
    this.createForm.reset(undefined, { emitEvent: false });
    if (this.staffMembers().length > 0) {
      this.createForm.patchValue({ staffProfileId: this.staffMembers()[0].staffProfileId });
    }
  }

  /** Duration kept when nothing is overridden: the reserved one, or the new offering's when the service changes. */
  private defaultEditDuration(appointment: AppointmentResponse): number {
    const selectedId = this.editForm.controls.generalServiceId.value;
    if (!selectedId || selectedId === appointment.generalServiceId) {
      return getAppointmentDurationMinutes(appointment);
    }

    const option = this.editServiceOptions().find((o) => o.generalServiceId === selectedId);
    return option?.durationMinutes ?? getAppointmentDurationMinutes(appointment);
  }

  private async loadCreateServiceOptions(staffProfileId: string): Promise<void> {
    this.createServiceOptions.set([]);
    this.serviceOptionsError.set(null);
    if (!staffProfileId) {
      return;
    }

    try {
      const options = await firstValueFrom(this.adminAppointmentsApiService.serviceOptions(staffProfileId));
      // The professional may have changed while loading.
      if (this.createForm.controls.staffProfileId.value === staffProfileId) {
        this.createServiceOptions.set(options);
      }
    } catch (error) {
      this.serviceOptionsError.set(getApiErrorMessage(error, 'No pudimos cargar los servicios del profesional.'));
    }
  }

  private async loadEditServiceOptions(staffProfileId: string): Promise<void> {
    this.serviceOptionsError.set(null);
    try {
      const options = await firstValueFrom(this.adminAppointmentsApiService.serviceOptions(staffProfileId));
      if (this.editingAppointment()?.staffProfileId === staffProfileId) {
        this.editServiceOptions.set(options);
      }
    } catch (error) {
      this.serviceOptionsError.set(getApiErrorMessage(error, 'No pudimos cargar los servicios del profesional.'));
    }
  }

  private async bootstrap(): Promise<void> {
    try {
      this.staffMembers.set(await firstValueFrom(this.adminStaffApiService.list()));
      if (this.staffMembers().length > 0) {
        this.createForm.patchValue({ staffProfileId: this.staffMembers()[0].staffProfileId });
      }
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
    }
    void firstValueFrom(this.catalogApi.listGeneralServices())
      .then((services) => this.generalServices.set(services))
      .catch(() => this.generalServices.set([]));

    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.applyQuery(params);
      void this.loadAppointments();
    });
  }

  private applyQuery(params: ParamMap): void {
    this.activeTab.set(readOptionParam(params, 'tab', TABS) || 'today');
    this.dateFrom.set(readDateParam(params, 'from'));
    this.dateTo.set(readDateParam(params, 'to'));
    this.filterForm.controls.staffProfileId.setValue(readTextParam(params, 'staffProfileId'), { emitEvent: false });
    this.statusFilter.set(readOptionParam(params, 'status', STATUSES));
    this.generalServiceFilter.set(readTextParam(params, 'generalServiceId'));
    this.customerFilter.set(readTextParam(params, 'customer'));
    this.page.set(readPageParam(params));
    this.pageSize.set(readPageSizeParam(params));
  }

  private navigate(patch: Record<string, QueryValue>): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: toQueryParams(patch), queryParamsHandling: 'merge' });
  }

  private async loadAppointments(): Promise<void> {
    const sequence = ++this.loadSequence;
    const past = this.activeTab() === 'past' ? this.pastRange() : null;
    this.rangeError.set(past ? historyRangeError(past.from, past.to) : null);
    if (this.rangeError()) {
      // The API would reject it too (422); explain it instead of a generic error.
      this.appointments.set([]);
      this.totalCount.set(0);
      this.isLoading.set(false);
      return;
    }
    this.isLoading.set(true);
    try {
      const result = await firstValueFrom(this.adminAppointmentsApiService.list(this.getFilters()));
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

  /**
   * The tab sets the date window, the order and the scope: today and upcoming are the agenda (no length limit), past
   * is the history (a window of at most 30 days, validated again by the API).
   */
  private getFilters(): AdminAppointmentsListFilters {
    const today = this.todayStr;
    const from = this.dateFrom();
    const to = this.dateTo();
    const tab = this.activeTab();
    const window: Pick<AdminAppointmentsListFilters, 'from' | 'to' | 'sort' | 'scope'> =
      tab === 'today'
        ? { from: today, to: today, sort: 'Asc', scope: 'Agenda' }
        : tab === 'upcoming'
          ? { from: maxDate(addDays(today, 1), from), to: to || null, sort: 'Asc', scope: 'Agenda' }
          : { ...this.pastRange(), sort: 'Desc', scope: 'History' };
    return {
      ...window,
      staffProfileId: this.filterForm.controls.staffProfileId.value || null,
      status: this.statusFilter() || null,
      generalServiceId: this.generalServiceFilter() || null,
      customer: this.customerFilter() || null,
      page: this.page(),
      pageSize: this.pageSize(),
    };
  }

  private async executeStatusAction(
    appointment: AppointmentResponse,
    action: string,
    requestFactory: () => ReturnType<AdminAppointmentsApiService['markCompleted']>,
    successMessage: string,
  ): Promise<void> {
    if (!this.canTransition(appointment)) return;
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.busyActionKey.set(this.actionKey(appointment.id, action));
    try {
      await firstValueFrom(requestFactory());
      await this.loadAppointments();
      this.cancelEdit();
      this.successMessage.set(successMessage);
    } catch (error) {
      this.errorMessage.set(getAdminAppointmentErrorMessage(error, 'status'));
    } finally {
      this.busyActionKey.set(null);
    }
  }

  private actionKey(appointmentId: string, action: string): string {
    return `${appointmentId}:${action}`;
  }
}

function toLocalDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  return toLocalDateStr(new Date(year, month - 1, day + days));
}

function maxDate(base: string, other: string): string {
  return other && other > base ? other : base;
}

function minDate(base: string, other: string): string {
  return other && other < base ? other : base;
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const v = value?.trim() ?? '';
  return v || null;
}

function getAdminAppointmentErrorMessage(error: unknown, action: 'create' | 'update' | 'status'): string {
  if (isHttpConflict(error)) {
    if (action === 'create') return 'No se pudo crear la cita porque el horario ya no está disponible.';
    if (action === 'update') return 'No se pudo actualizar la cita porque el horario entra en conflicto.';
    return 'No se pudo cambiar el estado por un conflicto con la cita actual.';
  }

  let fallback = 'No se pudo actualizar el estado de la cita. Intenta nuevamente.';
  if (action === 'create') fallback = 'No se pudo crear la cita manual. Verifica los datos e intenta nuevamente.';
  if (action === 'update') fallback = 'No se pudo actualizar la cita. Verifica los datos e intenta nuevamente.';
  return getApiErrorMessage(error, fallback);
}

function isHttpConflict(error: unknown): boolean {
  return error instanceof HttpErrorResponse && error.status === 409;
}

function toUtcIsoString(value: string): string {
  return new Date(value).toISOString();
}

function formatDateTimeLocal(value: string): string {
  const date = new Date(value);
  const offsetInMinutes = date.getTimezoneOffset();
  return new Date(date.getTime() - offsetInMinutes * 60_000).toISOString().slice(0, 16);
}
