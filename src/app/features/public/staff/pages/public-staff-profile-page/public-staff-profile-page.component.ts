import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { PublicAvailabilitySlotResponse } from '../../../../../core/models/availability.models';
import { PublicStaffProfileResponse } from '../../../../../core/models/content.models';
import {
  PublicStaffReviewResponse,
  StaffReviewSummaryResponse,
} from '../../../../../core/models/review.models';
import { PublicStaffApiService } from '../../../../../core/services/public-staff-api.service';
import { PublicStaffReviewsApiService } from '../../../../../core/services/public-staff-reviews-api.service';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';
import { PageStateComponent } from '../../../../../shared/components/page-state/page-state.component';
import { PhotoPlaceholderComponent } from '../../../../../shared/components/photo-placeholder/photo-placeholder.component';
import { SlotPickerComponent } from '../../../../../shared/components/slot-picker/slot-picker.component';
import { isDateKey } from '../../../../../core/utils/bogota-date.utils';

@Component({
  selector: 'app-public-staff-profile-page',
  imports: [
    RouterLink,
    ApiFeedbackComponent,
    PageStateComponent,
    PhotoPlaceholderComponent,
    SlotPickerComponent,
  ],
  templateUrl: './public-staff-profile-page.component.html',
  styleUrl: './public-staff-profile-page.component.scss',
})
export class PublicStaffProfilePageComponent implements OnInit {
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
  readonly reviewsErrorMessage = signal<string | null>(null);

  // Booking modal. "?reservar=1&fecha=YYYY-MM-DD" opens it on that day (used by "Cambiar fecha u hora").
  readonly showBookingModal = signal(this.route.snapshot.queryParamMap.has('reservar'));
  readonly bookingDate = signal<string | null>(
    readDateParam(this.route.snapshot.queryParamMap.get('fecha')),
  );

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

  formatRating(value: number): string {
    return value.toFixed(1);
  }

  formatDate(value: string): string {
    return this.dateFormatter.format(new Date(value));
  }

  openBookingModal(): void {
    this.showBookingModal.set(true);
  }

  closeBookingModal(): void {
    this.showBookingModal.set(false);
    this.bookingDate.set(null);

    // Coming from "Cambiar fecha u hora": drop the params so a refresh does not reopen it.
    if (this.route.snapshot.queryParamMap.has('reservar')) {
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { reservar: null, fecha: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }
  }

  selectSlot(slot: PublicAvailabilitySlotResponse): void {
    void this.router.navigate(['/booking/confirm'], {
      queryParams: {
        staffProfileId: this.staffProfileId(),
        startsAt: slot.startAtUtc,
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

function readDateParam(value: string | null): string | null {
  return isDateKey(value) ? value : null;
}
