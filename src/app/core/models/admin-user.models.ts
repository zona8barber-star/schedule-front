export interface AdminUserItem {
  userId: string;
  fullName: string;
  email: string;
  phoneNumber: string | null;
  roles: string[];
  customRoleIds: string[];
  isActive: boolean;
  createdAt: string;
}

export interface AdminUserUpdateRequest {
  fullName: string;
  phoneNumber: string | null;
}

export interface AdminUserRolesUpdateRequest {
  roleIds: string[];
}
