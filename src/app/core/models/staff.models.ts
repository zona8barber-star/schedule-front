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

export const STAFF_DURATION_RANGE = {
  min: 10,
  max: 240,
  suggested: 30,
} as const;
