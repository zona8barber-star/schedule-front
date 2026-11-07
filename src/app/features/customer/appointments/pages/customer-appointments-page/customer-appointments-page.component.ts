import { Component, DestroyRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NgTemplateOutlet } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import {
  APPOINTMENT_STATUS,
  AppointmentResponse,
  AppointmentStatus,
} from '../../../../../core/models/appointment.models';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../../../../../core/models/paged-result.models';
import { PublicAvailabilitySlotResponse } from '../../../../../core/models/availability.models';
import {
  CustomerReviewResponse,
  REVIEW_STARS_VALUES,
  ReviewStars,
} from '../../../../../core/models/review.models';
import { CustomerAppointmentsApiService } from '../../../../../core/services/customer-appointments-api.service';
import { CustomerReviewsApiService } from '../../../../../core/services/customer-reviews-api.service';
import { ToastService } from '../../../../../core/services/toast.service';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';
import {
  QueryValue,
  readDateParam,
  readOptionParam,
  readPageParam,
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
} from '../../../../../core/utils/appointment-labels.utils';
import { BOGOTA_TIME_ZONE, bogotaDateKey, bogotaToday } from '../../../../../core/utils/bogota-date.utils';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';
import { PageStateComponent } from '../../../../../shared/components/page-state/page-state.component';
import { PaginatorComponent } from '../../../../../shared/components/paginator/paginator.component';
import { SlotPickerComponent } from '../../../../../shared/components/slot-picker/slot-picker.component';
import { PullToRefreshDirective } from '../../../../../shared/directives/pull-to-refresh.directive';

/** Ventana de calificación desde que terminó la cita: 7 días en ms */
const REVIEW_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

type AppointmentTab = 'upcoming' | 'pending-review' | 'history';

const TABS: readonly AppointmentTab[] = ['upcoming', 'pending-review', 'history'];
const STATUSES: readonly AppointmentStatus[] = Object.values(APPOINTMENT_STATUS);
/** Days back that can still hold an appointment to review (the window is 7 days from its end). */
const REVIEW_LOOKBACK_DAYS = 8;

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
    SlotPickerComponent,
    PaginatorComponent,
  ],
  templateUrl: './customer-appointments-page.component.html',
  styleUrl: './customer-appointments-page.component.scss',
})
export class CustomerAppointmentsPageComponent implements OnInit {
  private readonly customerAppointmentsApiService = inject(CustomerAppointmentsApiService);
  private readonly customerReviewsApiService = inject(CustomerReviewsApiService);
  private readonly toastService = inject(ToastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private loadSequence = 0;

  private readonly dateFormatter = new Intl.DateTimeFormat('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: BOGOTA_TIME_ZONE,
  });

  private readonly timeFormatter = new Intl.DateTimeFormat('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: BOGOTA_TIME_ZONE,
  });

  private readonly reschedulePicker = viewChild(SlotPickerComponent);

  readonly APPOINTMENT_STATUS = APPOINTMENT_STATUS;
  readonly reviewStarsValues = REVIEW_STARS_VALUES;

  // ADR-0016 B7: "Próximas" and "Historial" are paginated on the server (the page and the history status live in the
  // URL). "Por calificar" reads the appointments of the review window only, which is short, in one request.
  readonly upcoming = signal<AppointmentResponse[]>([]);
  readonly upcomingTotal = signal(0);
  readonly reviewCandidates = signal<AppointmentResponse[]>([]);
  readonly history = signal<AppointmentResponse[]>([]);
  readonly historyTotal = signal(0);
  readonly page = signal(1);
  readonly pageSize = DEFAULT_PAGE_SIZE;
  readonly statuses = STATUSES;
  readonly historyStatus = signal<AppointmentStatus | ''>('');
  readonly historyFrom = signal('');
  readonly historyTo = signal('');
  readonly rangeHint = HISTORY_RANGE_HINT;
  /** The window the history queries: the last 30 days by default, at most 30 days, any period. */
  readonly historyRange = computed<HistoryRange>(() =>
    resolveHistoryRange(this.historyFrom(), this.historyTo(), bogotaToday()),
  );
  readonly rangeError = computed(() => historyRangeError(this.historyRange().from, this.historyRange().to));
  /** False only when the customer has never booked (drives the first-booking empty state). */
  // The history only covers one window, so once the customer opens it (or filters it) its controls stay visible even
  // when that window is empty.
  readonly hasAnyAppointment = computed(
    () =>
      this.upcomingTotal() > 0 ||
      this.historyTotal() > 0 ||
      !!this.historyStatus() ||
      !!this.historyFrom() ||
      !!this.historyTo() ||
      this.activeTab() === 'history',
  );
  readonly reviewsByAppointmentId = signal<Record<string, CustomerReviewResponse>>({});
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  readonly activeTab = signal<AppointmentTab>('upcoming');

  readonly pendingCancelId = signal<string | null>(null);
  readonly pendingReviewId = signal<string | null>(null);

  /** Cita en el diálogo "¿Cancelar tu cita?" */
  readonly cancelDialogAppointment = signal<AppointmentResponse | null>(null);

  /** Cita que se está reprogramando y la nueva hora elegida (pendiente de confirmar). */
  readonly rescheduleAppointment = signal<AppointmentResponse | null>(null);
  readonly rescheduleSlot = signal<PublicAvailabilitySlotResponse | null>(null);
  readonly isRescheduling = signal(false);
  readonly rescheduleError = signal<string | null>(null);

  /** Cita actualmente abierta en el modal de calificación */
  readonly reviewModalAppointment = signal<AppointmentResponse | null>(null);
  readonly reviewSubmitted = signal(false);

  readonly reviewForm: ReviewFormGroup = new FormGroup({
    stars: new FormControl<ReviewStars | null>(null, { validators: [Validators.required] }),
    comment: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(2000)] }),
  });

  /** Tab 1: pendientes/confirmadas con fecha futura, orden ascendente (lo ordena el servidor) */
  readonly upcomingAppointments = computed(() => this.upcoming());

  /** Tab 2: citas que cumplen la lógica de calificación pendiente */
  readonly pendingReviewAppointments = computed(() =>
    this.reviewCandidates()
      .filter((a) => this.canReview(a))
      .sort((a, b) => b.endsAtUtc.localeCompare(a.endsAtUtc)),
  );

  /** Tab 3: todas las citas pasadas, canceladas o no asistidas, de la más reciente a la más antigua (paginado) */
  readonly historyAppointments = computed(() => this.history());

  readonly pendingReviewCount = computed(() => this.pendingReviewAppointments().length);

  setTab(tab: AppointmentTab): void {
    this.navigate({ tab: tab === 'upcoming' ? null : tab, page: 1 });
  }

  onHistoryStatusChange(status: string): void {
    this.navigate({ status, page: 1 });
  }

  onHistoryFromChange(value: string): void {
    this.navigate({ ...rangeWithFrom(value, this.historyRange()), page: 1 });
  }

  onHistoryToChange(value: string): void {
    this.navigate({ ...rangeWithTo(value, this.historyRange()), page: 1 });
  }

  onPageChange(page: number): void {
    this.navigate({ page });
  }

  ngOnInit(): void {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.applyQuery(params);
      void this.loadAppointments();
    });
  }

  private applyQuery(params: ParamMap): void {
    this.activeTab.set(readOptionParam(params, 'tab', TABS) || 'upcoming');
    this.historyStatus.set(readOptionParam(params, 'status', STATUSES));
    this.historyFrom.set(readDateParam(params, 'from'));
    this.historyTo.set(readDateParam(params, 'to'));
    this.page.set(readPageParam(params));
  }

  private navigate(patch: Record<string, QueryValue>): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: toQueryParams(patch), queryParamsHandling: 'merge' });
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

  askCancel(appointment: AppointmentResponse): void {
    if (!this.canCancel(appointment)) return;
    this.cancelDialogAppointment.set(appointment);
  }

  closeCancelDialog(): void {
    if (this.pendingCancelId()) return;
    this.cancelDialogAppointment.set(null);
  }

  /** Desde el diálogo de cancelar: mejor moverla a otra hora. */
  switchToReschedule(appointment: AppointmentResponse): void {
    this.cancelDialogAppointment.set(null);
    this.openReschedule(appointment);
  }

  async cancelAppointment(appointment: AppointmentResponse): Promise<void> {
    if (!this.canCancel(appointment)) return;

    this.pendingCancelId.set(appointment.id);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    try {
      await firstValueFrom(this.customerAppointmentsApiService.cancel(appointment.id));
      this.cancelDialogAppointment.set(null);
      this.toastService.success('Tu cita fue cancelada.');
      await this.loadAppointments();
    } catch (error) {
      this.cancelDialogAppointment.set(null);
      this.errorMessage.set(getApiErrorMessage(error));
    } finally {
      this.pendingCancelId.set(null);
    }
  }

  // ── Reprogramación ───────────────────────────────────────────────────────

  /** Día en que abre el selector: el de la cita actual. */
  rescheduleInitialDate(appointment: AppointmentResponse): string {
    return bogotaDateKey(appointment.startsAtUtc);
  }

  /** Rescheduling keeps the service and duration: free times are computed for that duration. */
  rescheduleDurationMinutes(appointment: AppointmentResponse): number {
    return getAppointmentDurationMinutes(appointment);
  }

  serviceLabel(appointment: AppointmentResponse): string | null {
    return getAppointmentServiceLabel(appointment);
  }

  openReschedule(appointment: AppointmentResponse): void {
    if (!this.canCancel(appointment)) return;
    this.rescheduleSlot.set(null);
    this.rescheduleError.set(null);
    this.rescheduleAppointment.set(appointment);
  }

  closeReschedule(): void {
    if (this.isRescheduling()) return;
    this.rescheduleAppointment.set(null);
    this.rescheduleSlot.set(null);
    this.rescheduleError.set(null);
  }

  onRescheduleSlot(slot: PublicAvailabilitySlotResponse): void {
    this.rescheduleError.set(null);
    this.rescheduleSlot.set(slot);
  }

  async confirmReschedule(): Promise<void> {
    const appointment = this.rescheduleAppointment();
    const slot = this.rescheduleSlot();
    if (!appointment || !slot || this.isRescheduling()) return;

    this.isRescheduling.set(true);
    this.rescheduleError.set(null);

    try {
      const updated = await firstValueFrom(
        this.customerAppointmentsApiService.reschedule(appointment.id, {
          startsAtUtc: slot.startAtUtc,
        }),
      );

      const needsConfirmation =
        appointment.status === APPOINTMENT_STATUS.confirmed &&
        updated.status === APPOINTMENT_STATUS.pending;

      this.isRescheduling.set(false);
      this.closeReschedule();
      this.toastService.success(
        `Tu cita quedó para el ${this.formatDate(updated.startsAtUtc).toLowerCase()} a las ${this.formatTime(updated.startsAtUtc)}.` +
          (needsConfirmation ? ' Tu barbero confirmará el nuevo horario.' : ''),
      );
      await this.loadAppointments();
    } catch (error) {
      if (isHttpStatus(error, 409)) {
        this.rescheduleError.set('Esa hora se acaba de ocupar. Elige otra.');
        this.rescheduleSlot.set(null);
        await this.reschedulePicker()?.reload();
      } else {
        this.rescheduleError.set(getApiErrorMessage(error));
      }
    } finally {
      this.isRescheduling.set(false);
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
    const sequence = ++this.loadSequence;
    this.isLoading.set(true);
    this.errorMessage.set(null);

    let reviews: CustomerReviewResponse[] = [];

    try {
      const tab = this.activeTab();
      const [upcoming, recentPast, history] = await Promise.all([
        firstValueFrom(
          this.customerAppointmentsApiService.list({
            scope: 'Upcoming',
            page: tab === 'upcoming' ? this.page() : 1,
            pageSize: this.pageSize,
          }),
        ),
        firstValueFrom(
          this.customerAppointmentsApiService.list({
            scope: 'Past',
            from: bogotaDateKey(new Date(Date.now() - REVIEW_LOOKBACK_DAYS * 24 * 60 * 60 * 1000)),
            pageSize: MAX_PAGE_SIZE,
          }),
        ),
        // An invalid range (only possible by editing the URL) is explained instead of asking the API (it would 422).
        this.rangeError()
          ? Promise.resolve({ items: [], page: 1, pageSize: this.pageSize, totalCount: 0 })
          : firstValueFrom(
              this.customerAppointmentsApiService.list({
                scope: 'Past',
                ...this.historyRange(),
                status: this.historyStatus() || null,
                page: tab === 'history' ? this.page() : 1,
                pageSize: this.pageSize,
              }),
            ),
      ]);
      if (sequence !== this.loadSequence) {
        return;
      }

      try {
        reviews = await firstValueFrom(this.customerReviewsApiService.list());
      } catch {
        reviews = [];
      }

      this.upcoming.set(upcoming.items);
      this.upcomingTotal.set(upcoming.totalCount);
      this.reviewCandidates.set(recentPast.items);
      this.history.set(history.items);
      this.historyTotal.set(history.totalCount);
      this.reviewsByAppointmentId.set(indexReviewsByAppointmentId(reviews));
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
      this.upcoming.set([]);
      this.upcomingTotal.set(0);
      this.reviewCandidates.set([]);
      this.history.set([]);
      this.historyTotal.set(0);
      this.reviewsByAppointmentId.set({});
    } finally {
      this.isLoading.set(false);
    }
  }
}

// ── Helpers de módulo ───────────────────────────────────────────────────────

function indexReviewsByAppointmentId(
  reviews: CustomerReviewResponse[],
): Record<string, CustomerReviewResponse> {
  return reviews.reduce<Record<string, CustomerReviewResponse>>((acc, review) => {
    acc[review.appointmentId] = review;
    return acc;
  }, {});
}

function getReviewSubmissionErrorMessage(error: unknown): string {
  if (isHttpStatus(error, 409)) return 'Ya enviaste una reseña para esta cita.';
  return getApiErrorMessage(error);
}

function isHttpStatus(error: unknown, status: number): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    Number((error as { status?: unknown }).status) === status
  );
}
