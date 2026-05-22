export type ReviewStars = 1 | 2 | 3 | 4 | 5;

export const REVIEW_STARS_VALUES: readonly ReviewStars[] = [1, 2, 3, 4, 5] as const;

export interface ReviewCreateRequest {
  stars: ReviewStars;
  comment?: string | null;
}

export interface CustomerReviewResponse {
  id: string;
  appointmentId: string;
  staffProfileId: string;
  stars: ReviewStars;
  comment: string | null;
  createdAtUtc: string;
}

export interface PublicStaffReviewResponse {
  appointmentId: string;
  stars: ReviewStars;
  comment: string | null;
  createdAtUtc: string;
}

export interface StaffReviewSummaryResponse {
  staffProfileId: string;
  totalReviews: number;
  averageStars: number;
}
