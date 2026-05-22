import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { CustomerReviewResponse } from '../../../../../core/models/review.models';
import { CustomerReviewsApiService } from '../../../../../core/services/customer-reviews-api.service';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';
import { PageStateComponent } from '../../../../../shared/components/page-state/page-state.component';

@Component({
  selector: 'app-customer-reviews-page',
  imports: [RouterLink, ApiFeedbackComponent, PageStateComponent],
  templateUrl: './customer-reviews-page.component.html',
  styleUrl: './customer-reviews-page.component.scss',
})
export class CustomerReviewsPageComponent implements OnInit {
  private readonly customerReviewsApiService = inject(CustomerReviewsApiService);
  private readonly dateTimeFormatter = new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  readonly reviews = signal<CustomerReviewResponse[]>([]);
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    void this.loadReviews();
  }

  renderStars(stars: number): string {
    const sanitizedStars = Math.max(1, Math.min(5, Math.round(stars)));
    return `${sanitizedStars}/5`;
  }

  formatDateTime(value: string): string {
    return this.dateTimeFormatter.format(new Date(value));
  }

  private async loadReviews(): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    try {
      const reviews = await firstValueFrom(this.customerReviewsApiService.list());
      this.reviews.set(
        [...reviews].sort((left, right) => right.createdAtUtc.localeCompare(left.createdAtUtc)),
      );
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
      this.reviews.set([]);
    } finally {
      this.isLoading.set(false);
    }
  }
}
