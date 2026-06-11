import { HttpErrorResponse } from '@angular/common/http';
import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import {
  APPOINTMENT_STATUS,
  AdminAppointmentsListFilters,
  AdminManualAppointmentCreateRequest,
  AppointmentResponse,
  AppointmentUpdateRequest,
} from '../../../../../core/models/appointment.models';
import { StaffListItem } from '../../../../../core/models/staff.models';
import { AdminAppointmentsApiService } from '../../../../../core/services/admin-appointments-api.service';
import { AdminStaffApiService } from '../../../../../core/services/admin-staff-api.service';
import {
  getAppointmentSourceLabel,
  getAppointmentStatusLabel,
} from '../../../../../core/utils/appointment-labels.utils';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';
import { PageStateComponent } from '../../../../../shared/components/page-state/page-state.component';

type AppointmentsTab = 'today' | 'upcoming' | 'past';

@Component({
  selector: 'app-admin-appointments-page',
  imports: [ReactiveFormsModule, ApiFeedbackComponent, PageStateComponent],
  templateUrl: './admin-appointments-page.component.html',
  styleUrl: './admin-appointments-page.component.scss',
})
export class AdminAppointmentsPageComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly adminAppointmentsApiService = inject(AdminAppointmentsApiService);
  private readonly adminStaffApiService = inject(AdminStaffApiService);
  private readonly dateFormatter = new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium' });
  private readonly timeFormatter = new Intl.DateTimeFormat('es-AR', { timeStyle: 'short' });
  private readonly todayStr = toLocalDateStr(new Date());

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

  readonly staffById = computed(() =>
    this.staffMembers().reduce<Record<string, StaffListItem>>((acc, s) => {
      acc[s.staffProfileId] = s;
      return acc;
    }, {}),
  );

  readonly todayAppointments = computed(() =>
    this.appointments().filter(a => appointmentLocalDate(a.startsAtUtc) === this.todayStr),
  );

  readonly upcomingAppointments = computed(() => {
    const from = this.dateFrom();
    const to = this.dateTo();
    return this.appointments().filter(a => {
      const date = appointmentLocalDate(a.startsAtUtc);
      if (date <= this.todayStr) return false;
      if (from && date < from) return false;
      if (to && date > to) return false;
      return true;
    });
  });

  readonly pastAppointments = computed(() => {
    const from = this.dateFrom();
    const to = this.dateTo();
    return this.appointments().filter(a => {
      const date = appointmentLocalDate(a.startsAtUtc);
      if (date >= this.todayStr) return false;
      if (from && date < from) return false;
      if (to && date > to) return false;
      return true;
    });
  });

  readonly editingAppointment = computed(() => {
    const id = this.editingAppointmentId();
    return id ? (this.appointments().find(a => a.id === id) ?? null) : null;
  });

  readonly activeAppointments = computed(() => {
    switch (this.activeTab()) {
      case 'today': return this.todayAppointments();
      case 'upcoming': return this.upcomingAppointments();
      case 'past': return this.pastAppointments();
    }
  });

  readonly filterForm = this.formBuilder.nonNullable.group({
    staffProfileId: [''],
  });

  readonly createForm = this.formBuilder.nonNullable.group({
    staffProfileId: ['', [Validators.required]],
    startsAt: ['', [Validators.required]],
    customerName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    customerEmail: ['', [Validators.email, Validators.maxLength(256)]],
    customerPhone: ['', [Validators.maxLength(40)]],
    notes: ['', [Validators.maxLength(2000)]],
  });

  readonly editForm = this.formBuilder.nonNullable.group({
    startsAt: ['', [Validators.required]],
    endsAt: ['', [Validators.required]],
    customerName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    customerEmail: ['', [Validators.email, Validators.maxLength(256)]],
    customerPhone: ['', [Validators.maxLength(40)]],
    notes: ['', [Validators.maxLength(2000)]],
  });

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
    this.activeTab.set(tab);
    this.dateFrom.set('');
    this.dateTo.set('');
  }

  setDateFrom(value: string): void {
    this.dateFrom.set(value);
  }

  setDateTo(value: string): void {
    this.dateTo.set(value);
  }

  openCreateForm(): void {
    this.showCreateForm.set(true);
  }

  closeCreateForm(): void {
    this.showCreateForm.set(false);
    this.resetCreateForm();
  }

  async applyFilter(): Promise<void> {
    await this.loadAppointments();
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

    const request: AdminManualAppointmentCreateRequest = {
      staffProfileId: value.staffProfileId,
      startsAtUtc: toUtcIsoString(value.startsAt),
      endsAtUtc: null,
      customerName: value.customerName.trim(),
      customerEmail: normalizeOptionalText(value.customerEmail),
      customerPhone: normalizeOptionalText(value.customerPhone),
      notes: normalizeOptionalText(value.notes),
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
    this.editForm.patchValue({
      startsAt: formatDateTimeLocal(appointment.startsAtUtc),
      endsAt: formatDateTimeLocal(appointment.endsAtUtc),
      customerName: appointment.customerName,
      customerEmail: appointment.customerEmail ?? '',
      customerPhone: appointment.customerPhone ?? '',
      notes: appointment.notes ?? '',
    });
  }

  cancelEdit(): void {
    this.editingAppointmentId.set(null);
    this.editSubmitted.set(false);
    this.editForm.reset({ startsAt: '', endsAt: '', customerName: '', customerEmail: '', customerPhone: '', notes: '' });
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

    const request: AppointmentUpdateRequest = {
      startsAtUtc: toUtcIsoString(value.startsAt),
      endsAtUtc: toUtcIsoString(value.endsAt),
      customerName: value.customerName.trim(),
      customerEmail: normalizeOptionalText(value.customerEmail),
      customerPhone: normalizeOptionalText(value.customerPhone),
      notes: normalizeOptionalText(value.notes),
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
    controlName: 'staffProfileId' | 'startsAt' | 'customerName' | 'customerEmail' | 'customerPhone' | 'notes',
    errorName: string,
  ): boolean {
    const control = this.createForm.controls[controlName];
    return control.hasError(errorName) && (control.touched || this.createSubmitted());
  }

  showEditError(
    controlName: 'startsAt' | 'endsAt' | 'customerName' | 'customerEmail' | 'customerPhone' | 'notes',
    errorName: string,
  ): boolean {
    const control = this.editForm.controls[controlName];
    return control.hasError(errorName) && (control.touched || this.editSubmitted());
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
    this.createForm.reset();
    if (this.staffMembers().length > 0) {
      this.createForm.patchValue({ staffProfileId: this.staffMembers()[0].staffProfileId });
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
    await this.loadAppointments();
  }

  private async loadAppointments(): Promise<void> {
    this.isLoading.set(true);
    try {
      const filters = this.getFilters();
      const appointments = await firstValueFrom(this.adminAppointmentsApiService.list(filters));
      this.appointments.set(
        [...appointments].sort((a, b) => a.startsAtUtc.localeCompare(b.startsAtUtc)),
      );
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
      this.appointments.set([]);
    } finally {
      this.isLoading.set(false);
    }
  }

  private getFilters(): AdminAppointmentsListFilters | undefined {
    const staffProfileId = this.filterForm.controls.staffProfileId.value;
    return staffProfileId ? { staffProfileId } : undefined;
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

function appointmentLocalDate(utcIso: string): string {
  return toLocalDateStr(new Date(utcIso));
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
