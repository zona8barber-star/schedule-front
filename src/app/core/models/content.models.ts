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

export interface PublicStaffServiceResponse {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  price: number | null;
  isActive: boolean;
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
