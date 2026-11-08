export interface StaffManagementView {
  staffProfileId: string;
  userId: string;
  fullName: string;
  email: string;
  phoneNumber: string | null;
  displayName: string;
  bio: string | null;
  defaultAppointmentDurationMinutes: number;
  photoMediaAssetId: string | null;
  photoUrl: string | null;
  tipsQrMediaAssetId: string | null;
  tipsQrUrl: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
  tikTokUrl: string | null;
  youtubeUrl: string | null;
  xUrl: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string | null;
}

export type StaffListItem = StaffManagementView;
export type StaffResponse = StaffManagementView;
export type StaffSelfProfileResponse = StaffManagementView;

export interface AdminStaffCreateRequest {
  fullName: string;
  email: string;
  displayName: string;
  initialPassword: string;
  phoneNumber: string | null;
  bio: string | null;
  defaultAppointmentDurationMinutes: number | null;
  photoMediaAssetId: string | null;
  tipsQrMediaAssetId: string | null;
  isActive: boolean | null;
}

export interface AdminStaffUpdateRequest {
  fullName: string;
  email: string;
  displayName: string;
  phoneNumber: string | null;
  bio: string | null;
  defaultAppointmentDurationMinutes: number | null;
  photoMediaAssetId: string | null;
  tipsQrMediaAssetId: string | null;
  isActive: boolean | null;
}

export interface StaffStatusUpdateRequest {
  isActive: boolean;
}

export interface EnableProfessionalProfileRequest {
  displayName: string;
  defaultAppointmentDurationMinutes: number | null;
}

export interface StaffProfileUpdateRequest {
  displayName: string;
  bio: string | null;
  phoneNumber: string | null;
  defaultAppointmentDurationMinutes: number | null;
  photoMediaAssetId: string | null;
  tipsQrMediaAssetId: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
  tikTokUrl: string | null;
  youtubeUrl: string | null;
  xUrl: string | null;
}

/** One general service a professional offers, with their own duration (ADR-0016 B2). */
export interface StaffOfferingView {
  generalServiceId: string;
  generalServiceName: string;
  categoryId: string;
  categoryName: string;
  durationMinutes: number;
  isActive: boolean;
  generalServiceIsActive: boolean;
  categoryIsActive: boolean;
  createdAt: string;
  updatedAt: string | null;
}

export interface StaffOfferingsView {
  staffProfileId: string;
  defaultAppointmentDurationMinutes: number;
  offerings: StaffOfferingView[];
}

export interface StaffOfferingUpsertItem {
  generalServiceId: string;
  durationMinutes: number;
  isActive: boolean;
}

/** Full replacement: offerings not sent are removed. */
export interface StaffOfferingsUpdateRequest {
  offerings: StaffOfferingUpsertItem[];
}

export const STAFF_DURATION_RANGE = {
  min: 10,
  max: 240,
  suggested: 30,
} as const;
