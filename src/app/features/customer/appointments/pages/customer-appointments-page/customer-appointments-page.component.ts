import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import {
  APPOINTMENT_STATUS,
  AppointmentResponse,
} from '../../../../../core/models/appointment.models';
import {
  CustomerReviewResponse,
  REVIEW_STARS_VALUES,
  ReviewStars,
} from '../../../../../core/models/review.models';
import { CustomerAppointmentsApiService } from '../../../../../core/services/customer-appointments-api.service';
import { CustomerReviewsApiService } from '../../../../../core/services/customer-reviews-api.service';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';
import { PageStateComponent } from '../../../../../shared/components/page-state/page-state.component';
import { PullToRefreshDirective } from '../../../../../shared/directives/pull-to-refresh.directive';

/** Ventana de calificación desde que terminó la cita: 7 días en ms */
const REVIEW_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

type AppointmentTab = 'upcoming' | 'pending-review' | 'history';

type ReviewFormGroup = FormGroup<{
  stars: FormControl<ReviewStars | null>;
  comment: FormControl<string>;
}>;

@Component({
  selector: 'app-customer-appointments-page',
  imports: [
    ReactiveFormsModule,
    ApiFeedbackComponent,
    PageStateComponent,
    RouterLink,
    NgTemplateOutlet,
    PullToRefreshDirective,
  ],
  templateUrl: './customer-appointments-page.component.html',
  styleUrl: './customer-appointments-page.component.scss',
})
export class CustomerAppointmentsPageComponent implements OnInit {
  private readonly customerAppointmentsApiService = inject(CustomerAppointmentsApiService);
  private readonly customerReviewsApiService = inject(CustomerReviewsApiService);

  private readonly dateFormatter = new Intl.DateTimeFormat('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  private readonly timeFormatter = new Intl.DateTimeFormat('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  readonly APPOINTMENT_STATUS = APPOINTMENT_STATUS;
  readonly reviewStarsValues = REVIEW_STARS_VALUES;

  readonly appointments = signal<AppointmentResponse[]>([]);
  readonly reviewsByAppointmentId = signal<Record<string, CustomerReviewResponse>>({});
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  readonly activeTab = signal<AppointmentTab>('upcoming');

  readonly pendingCancelId = signal<string | null>(null);
  readonly pendingReviewId = signal<string | null>(null);

  /** Cita actualmente abierta en el modal de calificación */
  readonly reviewModalAppointment = signal<AppointmentResponse | null>(null);
  readonly reviewSubmitted = signal(false);

  readonly reviewForm: ReviewFormGroup = new FormGroup({
    stars: new FormControl<ReviewStars | null>(null, { validators: [Validators.required] }),
    comment: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(2000)] }),
  });

  /** Tab 1: pendientes/confirmadas con fecha futura, orden ascendente */
  readonly upcomingAppointments = computed(() =>
    this.appointments()
      .filter(isUpcoming)
      .sort((a, b) => a.startsAtUtc.localeCompare(b.startsAtUtc)),
  );

  /** Tab 2: citas que cumplen la lógica de calificación pendiente */
  readonly pendingReviewAppointments = computed(() =>
    this.appointments()
      .filter((a) => this.canReview(a))
      .sort((a, b) => b.endsAtUtc.localeCompare(a.endsAtUtc)),
  );

  /** Tab 3: todo lo que no está en las primeras dos tabs, orden descendente */
  readonly historyAppointments = computed(() =>
    this.appointments()
      .filter((a) => !isUpcoming(a) && !this.canReview(a))
      .sort((a, b) => b.startsAtUtc.localeCompare(a.startsAtUtc)),
  );

  readonly pendingReviewCount = computed(() => this.pendingReviewAppointments().length);

  setTab(tab: AppointmentTab): void {
    this.activeTab.set(tab);
  }

  ngOnInit(): void {
    void this.loadAppointments();
  }

  /** Formatea la fecha: "Lunes 19 de mayo de 2026" */
  formatDate(utcString: string): string {
    const raw = this.dateFormatter.format(new Date(utcString));
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }

  /** Formatea la hora: "10:00" */
  formatTime(utcString: string): string {
    return this.timeFormatter.format(new Date(utcString));
  }

  statusLabel(status: AppointmentResponse['status']): string {
    const labels: Record<string, string> = {
      Pending: 'Pendiente',
      Confirmed: 'Confirmada',
      Completed: 'Realizada',
      Cancelled: 'Cancelada',
      NoShow: 'No asistió',
    };
    return labels[status] ?? status;
  }

  /** Renderiza estrellas como caracteres ★ */
  renderStars(stars: number): string {
    return '★'.repeat(Math.max(1, Math.min(5, Math.round(stars))));
  }

  // ── Cancelación ──────────────────────────────────────────────────────────

  canCancel(appointment: AppointmentResponse): boolean {
    const cancelable =
      appointment.status === APPOINTMENT_STATUS.pending ||
      appointment.status === APPOINTMENT_STATUS.confirmed;
    return cancelable && Date.parse(appointment.startsAtUtc) > Date.now();
  }

  async cancelAppointment(appointment: AppointmentResponse): Promise<void> {
    if (!this.canCancel(appointment)) return;

    this.pendingCancelId.set(appointment.id);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    try {
      await firstValueFrom(this.customerAppointmentsApiService.cancel(appointment.id));
      await this.loadAppointments();
      this.successMessage.set('La cita fue cancelada correctamente.');
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
    } finally {
      this.pendingCancelId.set(null);
    }
  }

  // ── Calificación ─────────────────────────────────────────────────────────

  /**
   * Puede calificar si la cita ya terminó, no fue cancelada/no asistió,
   * aún no tiene reseña y no han pasado más de 7 días desde que terminó.
   */
  canReview(appointment: AppointmentResponse): boolean {
    if (this.isReviewed(appointment)) return false;

    if (
      appointment.status === APPOINTMENT_STATUS.cancelled ||
      appointment.status === APPOINTMENT_STATUS.noShow
    ) {
      return false;
    }

    const now = Date.now();
    const endsAt = Date.parse(appointment.endsAtUtc);

    return now >= endsAt && now - endsAt <= REVIEW_WINDOW_MS;
  }

  isReviewed(appointment: AppointmentResponse): boolean {
    return this.getAppointmentReview(appointment) !== null;
  }

  getAppointmentReview(
    appointment: AppointmentResponse,
  ): { stars: number; comment: string | null } | null {
    return appointment.review ?? this.reviewsByAppointmentId()[appointment.id] ?? null;
  }

  openReviewModal(appointment: AppointmentResponse): void {
    if (!this.canReview(appointment)) return;
    this.reviewForm.reset({ stars: null, comment: '' });
    this.reviewSubmitted.set(false);
    this.reviewModalAppointment.set(appointment);
  }

  closeReviewModal(): void {
    this.reviewModalAppointment.set(null);
    this.reviewSubmitted.set(false);
  }

  setReviewStars(stars: ReviewStars): void {
    this.reviewForm.controls.stars.setValue(stars);
    this.reviewForm.controls.stars.markAsTouched();
  }

  showStarsError(): boolean {
    const c = this.reviewForm.controls.stars;
    return c.hasError('required') && (c.touched || this.reviewSubmitted());
  }

  showCommentError(): boolean {
    const c = this.reviewForm.controls.comment;
    return c.hasError('maxlength') && (c.touched || this.reviewSubmitted());
  }

  reviewCommentLength(): number {
    return this.reviewForm.controls.comment.value.length;
  }

  async submitReview(): Promise<void> {
    const appointment = this.reviewModalAppointment();
    if (!appointment || !this.canReview(appointment)) return;

    this.reviewSubmitted.set(true);

    if (this.reviewForm.invalid) {
      this.reviewForm.markAllAsTouched();
      return;
    }

    const stars = this.reviewForm.controls.stars.value;
    if (stars === null) return;

    const comment = this.reviewForm.controls.comment.value.trim();

    this.pendingReviewId.set(appointment.id);
    this.errorMessage.set(null);

    try {
      const createdReview = await firstValueFrom(
        this.customerReviewsApiService.create(appointment.id, {
          stars,
          comment: comment.length ? comment : null,
        }),
      );

      this.reviewsByAppointmentId.update((current) => ({
        ...current,
        [appointment.id]: createdReview,
      }));

      this.closeReviewModal();
      this.successMessage.set('¡Gracias! Tu reseña fue enviada correctamente.');
    } catch (error) {
      this.errorMessage.set(getReviewSubmissionErrorMessage(error));
    } finally {
      this.pendingReviewId.set(null);
    }
  }

  // ── Carga ─────────────────────────────────────────────────────────────────

  async loadAppointments(): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    let reviews: CustomerReviewResponse[] = [];

    try {
      const appointments = await firstValueFrom(this.customerAppointmentsApiService.list());

      try {
        reviews = await firstValueFrom(this.customerReviewsApiService.list());
      } catch {
        reviews = [];
      }

      this.appointments.set(appointments);
      this.reviewsByAppointmentId.set(indexReviewsByAppointmentId(reviews));
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
      this.appointments.set([]);
      this.reviewsByAppointmentId.set({});
    } finally {
      this.isLoading.set(false);
    }
  }
}

// ── Helpers de módulo ───────────────────────────────────────────────────────

function isUpcoming(appointment: AppointmentResponse): boolean {
  const activeStatus =
    appointment.status === APPOINTMENT_STATUS.pending ||
    appointment.status === APPOINTMENT_STATUS.confirmed;
  return activeStatus && Date.parse(appointment.startsAtUtc) > Date.now();
}

function indexReviewsByAppointmentId(
  reviews: CustomerReviewResponse[],
): Record<string, CustomerReviewResponse> {
  return reviews.reduce<Record<string, CustomerReviewResponse>>((acc, review) => {
    acc[review.appointmentId] = review;
    return acc;
  }, {});
}

function getReviewSubmissionErrorMessage(error: unknown): string {
  const status =
    typeof error === 'object' && error !== null && 'status' in error
      ? Number((error as { status?: unknown }).status)
      : null;

  if (status === 409) return 'Ya enviaste una reseña para esta cita.';
  return getApiErrorMessage(error);
}
