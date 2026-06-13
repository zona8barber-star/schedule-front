export interface AdminUserItem {
  userId: string;
  fullName: string;
  email: string;
  phoneNumber: string | null;
  roles: string[];
  isActive: boolean;
  createdAt: string;
}

export interface AdminUserUpdateRequest {
  fullName: string;
  phoneNumber: string | null;
}
