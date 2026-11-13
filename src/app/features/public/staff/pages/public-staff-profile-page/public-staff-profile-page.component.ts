import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { PublicAvailabilitySlotResponse } from '../../../../../core/models/availability.models';
import {
  PublicStaffProfileResponse,
  PublicStaffServiceResponse,
} from '../../../../../core/models/content.models';
import {
  PublicStaffReviewResponse,
  StaffReviewSummaryResponse,
} from '../../../../../core/models/review.models';
import { PublicStaffApiService } from '../../../../../core/services/public-staff-api.service';
import { PublicStaffReviewsApiService } from '../../../../../core/services/public-staff-reviews-api.service';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';
import { PageStateComponent } from '../../../../../shared/components/page-state/page-state.component';
import { LoadErrorComponent } from '../../../../../shared/components/load-error/load-error.component';
import { NotFoundStateComponent } from '../../../../../shared/components/not-found-state/not-found-state.component';
import { isGuid } from '../../../../../core/utils/route-id.utils';
import { PhotoPlaceholderComponent } from '../../../../../shared/components/photo-placeholder/photo-placeholder.component';
import { SlotPickerComponent } from '../../../../../shared/components/slot-picker/slot-picker.component';
import {
  BOGOTA_TIME_ZONE,
  addDaysToDateKey,
  bogotaToday,
  dateKeyToUtcNoon,
  isDateKey,
} from '../../../../../core/utils/bogota-date.utils';
import { whatsAppUrl } from '../../../../../core/utils/whatsapp-link.utils';
import { safeHttpUrl } from '../../../../../core/utils/safe-url.utils';

/** Days offered as quick buttons in the first booking step (today included); others through "Otra fecha". */
const BOOKING_DAY_OPTIONS = 14;
const weekdayFormatter = new Intl.DateTimeFormat('es-CO', { weekday: 'short', timeZone: BOGOTA_TIME_ZONE });
const dayMonthFormatter = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', timeZone: BOGOTA_TIME_ZONE });
const longDateFormatter = new Intl.DateTimeFormat('es-CO', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: BOGOTA_TIME_ZONE,
});

export interface BookingDayOption {
  date: string;
  topLabel: string;
  bottomLabel: string;
}

function trimDot(value: string): string {
  return value.replace(/\.$/, '');
}

@Component({
  selector: 'app-public-staff-profile-page',
  imports: [
    RouterLink,
    ApiFeedbackComponent,
    PageStateComponent,
    LoadErrorComponent,
    NotFoundStateComponent,
    PhotoPlaceholderComponent,
    SlotPickerComponent,
  ],
  templateUrl: './public-staff-profile-page.component.html',
  styleUrl: './public-staff-profile-page.component.scss',
})
export class PublicStaffProfilePageComponent implements OnInit {
  /** Social links are shown only when they are http(s) (SONDA BUG-047). */
  readonly safeUrl = safeHttpUrl;

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly publicStaffApiService = inject(PublicStaffApiService);
  private readonly publicStaffReviewsApiService = inject(PublicStaffReviewsApiService);

  private readonly dateFormatter = new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
  });

  readonly staffProfileId = signal<string | null>(
    this.route.snapshot.paramMap.get('staffProfileId'),
  );
  readonly staffProfile = signal<PublicStaffProfileResponse | null>(null);
  readonly reviewsSummary = signal<StaffReviewSummaryResponse | null>(null);
  readonly reviews = signal<PublicStaffReviewResponse[]>([]);
  readonly isLoading = signal(true);
  readonly reviewsLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  /** SONDA BUG-045: why the profile could not be loaded when it was not a 404 (no network, server down). */
  readonly loadError = signal<unknown>(null);
  readonly reviewsErrorMessage = signal<string | null>(null);

  // Booking modal. "?reservar=1&fecha=YYYY-MM-DD&servicio=<generalServiceId>" opens it on that day and
  // service (used by "Cambiar fecha u hora").
  readonly showBookingModal = signal(this.route.snapshot.queryParamMap.has('reservar'));
  readonly bookingDate = signal<string | null>(
    readDateParam(this.route.snapshot.queryParamMap.get('fecha')),
  );
  /** General service chosen in the booking modal (ADR-0016 B3): free times depend on its duration. */
  readonly selectedServiceId = signal<string | null>(this.route.snapshot.queryParamMap.get('servicio'));

  /** Booking order (ADR-0016 D8): professional → date → service → free times. */
  readonly today = signal(bogotaToday());
  readonly dayOptions = computed<BookingDayOption[]>(() => {
    const today = this.today();
    return Array.from({ length: BOOKING_DAY_OPTIONS }, (_, index) => {
      const date = addDaysToDateKey(today, index);
      const asDate = dateKeyToUtcNoon(date);
      const weekday = trimDot(weekdayFormatter.format(asDate));
      return {
        date,
        topLabel: index === 0 ? 'Hoy' : index === 1 ? 'Mañana' : weekday.charAt(0).toUpperCase() + weekday.slice(1),
        bottomLabel: trimDot(dayMonthFormatter.format(asDate)),
      };
    });
  });

  readonly bookableServices = computed(() => this.staffProfile()?.services ?? []);
  readonly selectedService = computed<PublicStaffServiceResponse | null>(() => {
    const services = this.bookableServices();
    const selectedId = this.selectedServiceId();
    const selected = services.find((service) => service.generalServiceId === selectedId);
    if (selected) {
      return selected;
    }

    // Nothing to choose from when the professional offers a single service.
    return services.length === 1 ? services[0] : null;
  });

  readonly displayAverageRating = computed(
    () => this.reviewsSummary()?.averageStars ?? this.staffProfile()?.averageRating ?? 0,
  );
  readonly displayReviewCount = computed(
    () => this.reviewsSummary()?.totalReviews ?? this.staffProfile()?.reviewCount ?? 0,
  );
  readonly whatsappHref = computed(() => whatsAppUrl(this.staffProfile()?.phoneNumber));

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  async reload(): Promise<void> {
    await this.loadProfile();
    if (this.staffProfile()) {
      await this.loadReviews();
    }
  }

  formatRating(value: number): string {
    return value.toFixed(1);
  }

  formatDate(value: string): string {
    return this.dateFormatter.format(new Date(value));
  }

  openBookingModal(): void {
    this.showBookingModal.set(true);
  }

  formatServiceOption(service: PublicStaffServiceResponse): string {
    return `${service.name} · ${service.durationMinutes} min`;
  }

  formatBookingDate(dateKey: string): string {
    const label = longDateFormatter.format(dateKeyToUtcNoon(dateKey));
    return label.charAt(0).toUpperCase() + label.slice(1);
  }

  selectDate(dateKey: string): void {
    if (isDateKey(dateKey) && dateKey >= this.today()) {
      this.bookingDate.set(dateKey);
    }
  }

  onOtherDate(event: Event): void {
    this.selectDate((event.target as HTMLInputElement).value);
  }

  changeDate(): void {
    this.bookingDate.set(null);
  }

  selectService(service: PublicStaffServiceResponse): void {
    this.selectedServiceId.set(service.generalServiceId);
  }

  changeService(): void {
    this.selectedServiceId.set(null);
  }

  closeBookingModal(): void {
    this.showBookingModal.set(false);
    this.bookingDate.set(null);
    this.selectedServiceId.set(null);

    // Coming from "Cambiar fecha u hora": drop the params so a refresh does not reopen it.
    if (this.route.snapshot.queryParamMap.has('reservar')) {
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { reservar: null, fecha: null, servicio: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }
  }

  selectSlot(slot: PublicAvailabilitySlotResponse): void {
    const service = this.selectedService();
    if (!service) {
      return;
    }

    void this.router.navigate(['/booking/confirm'], {
      queryParams: {
        staffProfileId: this.staffProfileId(),
        startsAt: slot.startAtUtc,
        generalServiceId: service.generalServiceId,
      },
    });
  }

  private async loadProfile(): Promise<void> {
    const staffProfileId = this.staffProfileId();
    if (!staffProfileId) {
      this.errorMessage.set('No se recibió el identificador del profesional.');
      this.isLoading.set(false);
      return;
    }

    // SONDA BUG-044: an id that is not a GUID cannot exist; no request is sent and the page says so.
    if (!isGuid(staffProfileId)) {
      this.staffProfile.set(null);
      this.loadError.set(null);
      this.isLoading.set(false);
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.loadError.set(null);

    try {
      this.staffProfile.set(
        await firstValueFrom(this.publicStaffApiService.getById(staffProfileId)),
      );
    } catch (error) {
      this.staffProfile.set(null);
      // Only a 404 means the profile does not exist; anything else (no network, server down) offers «Reintentar».
      if (!(error instanceof HttpErrorResponse && error.status === 404)) {
        this.loadError.set(error ?? new Error('load failed'));
      }
    } finally {
      this.isLoading.set(false);
    }
  }

  private async loadReviews(): Promise<void> {
    const staffProfileId = this.staffProfileId();
    if (!staffProfileId) return;

    this.reviewsLoading.set(true);
    this.reviewsErrorMessage.set(null);

    try {
      const [summary, reviews] = await Promise.all([
        firstValueFrom(
          this.publicStaffReviewsApiService.getSummaryByStaffProfileId(staffProfileId),
        ),
        firstValueFrom(this.publicStaffReviewsApiService.listByStaffProfileId(staffProfileId)),
      ]);

      this.reviewsSummary.set(summary);
      this.reviews.set(reviews);
    } catch (error) {
      this.reviewsErrorMessage.set(getApiErrorMessage(error));
      this.reviewsSummary.set(null);
      this.reviews.set([]);
    } finally {
      this.reviewsLoading.set(false);
    }
  }
}

function readDateParam(value: string | null): string | null {
  return isDateKey(value) ? value : null;
}
