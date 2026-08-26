export interface PermissionView {
  id: string;
  code: string;
  description: string;
}

export interface RoleView {
  id: string;
  name: string;
  isSystemRole: boolean;
  permissions: PermissionView[];
}

export interface RoleCreateRequest {
  name: string;
  permissionIds: string[];
}

export interface RoleUpdateRequest {
  name: string;
  permissionIds: string[];
}
