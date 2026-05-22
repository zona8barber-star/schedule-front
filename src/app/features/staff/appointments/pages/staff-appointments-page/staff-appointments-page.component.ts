import { NgClass } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import {
  APPOINTMENT_STATUS,
  AppointmentResponse,
  AppointmentUpdateRequest,
  StaffManualAppointmentCreateRequest,
} from '../../../../../core/models/appointment.models';
import { ConfirmModalService } from '../../../../../core/services/confirm-modal.service';
import { StaffAppointmentsApiService } from '../../../../../core/services/staff-appointments-api.service';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';
import {
  getAppointmentSourceLabel,
  getAppointmentStatusLabel,
} from '../../../../../core/utils/appointment-labels.utils';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';
import { PageStateComponent } from '../../../../../shared/components/page-state/page-state.component';

@Component({
  selector: 'app-staff-appointments-page',
  imports: [NgClass, ReactiveFormsModule, ApiFeedbackComponent, PageStateComponent],
  templateUrl: './staff-appointments-page.component.html',
  styleUrl: './staff-appointments-page.component.scss',
})
export class StaffAppointmentsPageComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly staffAppointmentsApiService = inject(StaffAppointmentsApiService);
  private readonly confirmModal = inject(ConfirmModalService);
  private readonly dateFormatter = new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium' });
  private readonly timeFormatter = new Intl.DateTimeFormat('es-AR', { timeStyle: 'short' });
  private readonly dateTimeFormatter = new Intl.DateTimeFormat('es-AR', {
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
  readonly activeTab = signal<'today' | 'upcoming'>('today');
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly createSubmitted = signal(false);
  readonly editSubmitted = signal(false);

  // ── Computed ───────────────────────────────────────────────────────────
  readonly sortedAppointments = computed(() =>
    [...this.appointments()].sort((a, b) => a.startsAtUtc.localeCompare(b.startsAtUtc)),
  );

  readonly todayAppointments = computed(() => {
    const todayStr = localDateStr(new Date());
    return this.sortedAppointments().filter(
      (a) => localDateStr(new Date(a.startsAtUtc)) === todayStr && isActiveStatus(a.status),
    );
  });

  readonly upcomingAppointments = computed(() => {
    const todayStr = localDateStr(new Date());
    return this.sortedAppointments().filter(
      (a) => localDateStr(new Date(a.startsAtUtc)) > todayStr && isActiveStatus(a.status),
    );
  });

  readonly activeAppointments = computed(() =>
    this.activeTab() === 'today' ? this.todayAppointments() : this.upcomingAppointments(),
  );

  // ── Forms ──────────────────────────────────────────────────────────────
  readonly createForm = this.formBuilder.nonNullable.group({
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

  // ── Lifecycle ──────────────────────────────────────────────────────────
  ngOnInit(): void {
    void this.loadAppointments();
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
      customerName: '',
      customerEmail: '',
      customerPhone: '',
      notes: '',
    });
    this.showCreateModal.set(true);
  }

  closeCreateModal(): void {
    this.showCreateModal.set(false);
    this.createSubmitted.set(false);
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
    const request: StaffManualAppointmentCreateRequest = {
      // The backend uses the staff's default duration to calculate endsAtUtc.
      // A 409 Conflict response means the slot overlaps an existing appointment
      // or falls outside the configured availability rules.
      startsAtUtc: toUtcIsoString(value.startsAt),
      endsAtUtc: null,
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
    this.editForm.reset({
      startsAt: '',
      endsAt: '',
      customerName: '',
      customerEmail: '',
      customerPhone: '',
      notes: '',
    });
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
  async markCompleted(appointment: AppointmentResponse): Promise<void> {
    await this.executeStatusAction(
      appointment,
      'complete',
      () => this.staffAppointmentsApiService.markCompleted(appointment.id),
      'Cita marcada como completada.',
    );
  }

  async markNoShow(appointment: AppointmentResponse): Promise<void> {
    await this.executeStatusAction(
      appointment,
      'no-show',
      () => this.staffAppointmentsApiService.markNoShow(appointment.id),
      'Cita marcada como no-show.',
    );
  }

  // ── Delete (cancel in system) ──────────────────────────────────────────
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

  // ── Error display ──────────────────────────────────────────────────────
  showCreateError(
    controlName: 'startsAt' | 'customerName' | 'customerEmail' | 'customerPhone' | 'notes',
    errorName: string,
  ): boolean {
    const control = this.createForm.controls[controlName];
    return control.hasError(errorName) && (control.touched || this.createSubmitted());
  }

  showEditError(
    controlName:
      | 'startsAt'
      | 'endsAt'
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
  private async loadAppointments(): Promise<void> {
    this.isLoading.set(true);
    try {
      const appointments = await firstValueFrom(this.staffAppointmentsApiService.list());
      this.appointments.set(appointments);
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
      this.appointments.set([]);
    } finally {
      this.isLoading.set(false);
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

function toUtcIsoString(value: string): string {
  return new Date(value).toISOString();
}

function formatDateTimeLocal(value: string): string {
  const date = new Date(value);
  const offsetInMinutes = date.getTimezoneOffset();
  return new Date(date.getTime() - offsetInMinutes * 60_000).toISOString().slice(0, 16);
}

function localDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getStaffAppointmentErrorMessage(
  error: unknown,
  action: 'create' | 'update' | 'status',
): string {
  if (isHttpConflict(error)) {
    if (action === 'create') {
      return 'El horario seleccionado no está disponible. Puede estar ocupado o fuera de tu configuracion de disponibilidad. Elige otro turno.';
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

function isActiveStatus(status: AppointmentResponse['status']): boolean {
  return status === APPOINTMENT_STATUS.pending || status === APPOINTMENT_STATUS.confirmed;
}
