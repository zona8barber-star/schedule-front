export interface CustomerProfileResponse {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string | null;
  dateOfBirth: string | null;
  photoUrl: string | null;
}

export interface CustomerProfileUpdateRequest {
  fullName: string;
  phoneNumber: string | null;
  dateOfBirth: string | null;
}

export interface CustomerPasswordChangeRequest {
  currentPassword: string;
  newPassword: string;
}
