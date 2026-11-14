export interface LandingContentResponse {
  heroTitle: string;
  heroSubtitle: string | null;
  aboutTitle: string | null;
  aboutText: string | null;
  contactPhone: string | null;
  mapsUrl: string | null;
  address: string | null;
  updatedAtUtc: string | null;
}

export interface BrandingSettingsResponse {
  appName: string;
  primaryColor: string;
  secondaryColor: string;
  logoMediaAssetId: string | null;
  appIconMediaAssetId: string | null;
  logoUrl: string | null;
  appIconUrl: string | null;
  updatedAtUtc: string | null;
}

export interface BannerResponse {
  id: string;
  title: string;
  subtitle: string | null;
  imageMediaAssetId: string | null;
  imageUrl: string | null;
  linkUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  startsAtUtc: string | null;
  endsAtUtc: string | null;
  createdAtUtc: string;
  updatedAtUtc: string | null;
}

/** A general service the professional offers (ADR-0016 B2). Never carries a price. */
export interface PublicStaffServiceResponse {
  generalServiceId: string;
  name: string;
  description: string | null;
  categoryId: string;
  categoryName: string;
  durationMinutes: number;
}

export interface PublicStaffListItemResponse {
  staffProfileId: string;
  displayName: string;
  bio: string | null;
  phoneNumber: string | null;
  photoMediaAssetId: string | null;
  photoUrl: string | null;
  defaultAppointmentDurationMinutes: number;
  averageRating: number;
  reviewCount: number;
  services: PublicStaffServiceResponse[];
}

export interface PublicStaffProfileResponse {
  staffProfileId: string;
  displayName: string;
  bio: string | null;
  phoneNumber: string | null;
  photoMediaAssetId: string | null;
  photoUrl: string | null;
  tipsQrMediaAssetId: string | null;
  tipsQrUrl: string | null;
  defaultAppointmentDurationMinutes: number;
  averageRating: number;
  reviewCount: number;
  services: PublicStaffServiceResponse[];
  instagramUrl: string | null;
  facebookUrl: string | null;
  tikTokUrl: string | null;
  youtubeUrl: string | null;
  xUrl: string | null;
}

export interface UpsertLandingContentRequest {
  heroTitle: string;
  heroSubtitle: string | null;
  aboutTitle: string | null;
  aboutText: string | null;
  contactPhone: string | null;
  mapsUrl: string | null;
  address: string | null;
}

export interface UpsertBrandingSettingsRequest {
  appName: string;
  primaryColor: string;
  secondaryColor: string;
  logoMediaAssetId: string | null;
  appIconMediaAssetId: string | null;
}

export type UpsertBrandingRequest = UpsertBrandingSettingsRequest;

export interface CreateBannerRequest {
  title: string;
  subtitle: string | null;
  imageMediaAssetId: string | null;
  linkUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  startsAtUtc: string | null;
  endsAtUtc: string | null;
}

export interface UpdateBannerRequest {
  title: string;
  subtitle: string | null;
  imageMediaAssetId: string | null;
  linkUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  startsAtUtc: string | null;
  endsAtUtc: string | null;
}

/** 0 = Monday … 6 = Sunday */
export interface BusinessScheduleDayResponse {
  dayOfWeek: number;
  isOpen: boolean;
  openTime: string | null;
  closeTime: string | null;
}

export interface BusinessScheduleResponse {
  days: BusinessScheduleDayResponse[];
}

export interface UpsertBusinessScheduleDayRequest {
  dayOfWeek: number;
  isOpen: boolean;
  openTime: string | null;
  closeTime: string | null;
}

export interface UpsertBusinessScheduleRequest {
  days: UpsertBusinessScheduleDayRequest[];
}

export interface TickerItemResponse {
  id: string;
  text: string;
  sortOrder: number;
  isActive: boolean;
  createdAtUtc: string;
  updatedAtUtc: string | null;
}

export interface CreateTickerItemRequest {
  text: string;
  sortOrder: number;
  isActive: boolean;
}

export interface UpdateTickerItemRequest {
  text: string;
  sortOrder: number;
  isActive: boolean;
}

// ── Public contracts (SONDA BUG-101): what /public/content returns. Only active items, already ordered by the API,
// without file ids, flags or edit timestamps. The admin screens keep the full *Response models above. ──

export type PublicLandingContentResponse = Omit<LandingContentResponse, 'updatedAtUtc'>;

export interface PublicBrandingResponse {
  appName: string;
  primaryColor: string;
  secondaryColor: string;
  logoUrl: string | null;
  appIconUrl: string | null;
}

export interface PublicBannerResponse {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  linkUrl: string | null;
}

export interface PublicTickerItemResponse {
  id: string;
  text: string;
}
