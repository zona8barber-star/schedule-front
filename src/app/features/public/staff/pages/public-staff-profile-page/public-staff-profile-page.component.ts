import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { PublicAvailabilitySlotResponse } from '../../../../../core/models/availability.models';
import { PublicStaffProfileResponse } from '../../../../../core/models/content.models';
import {
  PublicStaffReviewResponse,
  StaffReviewSummaryResponse,
} from '../../../../../core/models/review.models';
import { PublicAvailabilityApiService } from '../../../../../core/services/public-availability-api.service';
import { PublicStaffApiService } from '../../../../../core/services/public-staff-api.service';
import { PublicStaffReviewsApiService } from '../../../../../core/services/public-staff-reviews-api.service';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';
import { PageStateComponent } from '../../../../../shared/components/page-state/page-state.component';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

@Component({
  selector: 'app-public-staff-profile-page',
  imports: [RouterLink, ApiFeedbackComponent, PageStateComponent],
  templateUrl: './public-staff-profile-page.component.html',
  styleUrl: './public-staff-profile-page.component.scss',
})
export class PublicStaffProfilePageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly publicStaffApiService = inject(PublicStaffApiService);
  private readonly publicStaffReviewsApiService = inject(PublicStaffReviewsApiService);
  private readonly publicAvailabilityApiService = inject(PublicAvailabilityApiService);

  private readonly timeFormatter = new Intl.DateTimeFormat('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
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
  readonly reviewsErrorMessage = signal<string | null>(null);

  // Booking modal
  readonly showBookingModal = signal(false);
  readonly selectedDate = signal(todayIso());
  readonly slots = signal<PublicAvailabilitySlotResponse[]>([]);
  readonly slotsLoading = signal(false);
  readonly slotsError = signal<string | null>(null);
  readonly slotsLoaded = signal(false);

  readonly displayAverageRating = computed(
    () => this.reviewsSummary()?.averageStars ?? this.staffProfile()?.averageRating ?? 0,
  );
  readonly displayReviewCount = computed(
    () => this.reviewsSummary()?.totalReviews ?? this.staffProfile()?.reviewCount ?? 0,
  );
  readonly whatsappHref = computed(() => {
    const phone = this.staffProfile()?.phoneNumber;
    if (!phone) return null;
    const digits = phone.replace(/\D/g, '');
    const number = digits.startsWith('57') ? digits : `57${digits}`;
    return `https://wa.me/${number}`;
  });

  async ngOnInit(): Promise<void> {
    await this.loadProfile();
    await this.loadReviews();
  }

  todayDate(): string {
    return todayIso();
  }

  formatRating(value: number): string {
    return value.toFixed(1);
  }

  formatSlotTime(utc: string): string {
    return this.timeFormatter.format(new Date(utc));
  }

  formatDate(value: string): string {
    return this.dateFormatter.format(new Date(value));
  }

  openBookingModal(): void {
    this.showBookingModal.set(true);
    if (!this.slotsLoaded()) {
      void this.loadSlots();
    }
  }

  closeBookingModal(): void {
    this.showBookingModal.set(false);
  }

  onDateChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (!value) return;
    this.selectedDate.set(value);
    this.slotsLoaded.set(false);
    void this.loadSlots();
  }

  selectSlot(slot: PublicAvailabilitySlotResponse): void {
    void this.router.navigate(['/booking/confirm'], {
      queryParams: {
        staffProfileId: this.staffProfileId(),
        startsAt: slot.startAtUtc,
      },
    });
  }

  private async loadSlots(): Promise<void> {
    const staffProfileId = this.staffProfileId();
    const date = this.selectedDate();
    if (!staffProfileId || !date) return;

    this.slotsLoading.set(true);
    this.slotsError.set(null);
    try {
      const response = await firstValueFrom(
        this.publicAvailabilityApiService.getSlots(staffProfileId, date, date),
      );
      this.slots.set(response.slots);
      this.slotsLoaded.set(true);
    } catch {
      this.slotsError.set('No pudimos cargar los horarios. Intenta de nuevo.');
      this.slots.set([]);
    } finally {
      this.slotsLoading.set(false);
    }
  }

  private async loadProfile(): Promise<void> {
    const staffProfileId = this.staffProfileId();
    if (!staffProfileId) {
      this.errorMessage.set('No se recibió el identificador del profesional.');
      this.isLoading.set(false);
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    try {
      this.staffProfile.set(
        await firstValueFrom(this.publicStaffApiService.getById(staffProfileId)),
      );
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
      this.staffProfile.set(null);
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
