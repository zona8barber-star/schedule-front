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
  /** ADR-0020 (BUG-091): custom roles and Staff; Admin and Customer are locked. Older APIs omit it. */
  canEditPermissions?: boolean;
  /** SONDA BUG-161: the version read; sent back on save so a change made meanwhile by someone else is a 409. */
  version?: string | null;
}

export interface RoleCreateRequest {
  name: string;
  permissionIds: string[];
}

export interface RoleUpdateRequest {
  name: string;
  permissionIds: string[];
  version?: string | null;
}
