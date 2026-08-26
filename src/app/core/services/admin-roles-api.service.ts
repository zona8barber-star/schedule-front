import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { RuntimeConfigService } from '../config/runtime-config.service';
import {
  PermissionView,
  RoleCreateRequest,
  RoleUpdateRequest,
  RoleView,
} from '../models/role.models';

@Injectable({
  providedIn: 'root',
})
export class AdminRolesApiService {
  private readonly httpClient = inject(HttpClient);
  private readonly runtimeConfigService = inject(RuntimeConfigService);

  list() {
    return this.httpClient.get<RoleView[]>(this.buildUrl('/admin/roles'));
  }

  create(request: RoleCreateRequest) {
    return this.httpClient.post<RoleView>(this.buildUrl('/admin/roles'), request);
  }

  update(roleId: string, request: RoleUpdateRequest) {
    return this.httpClient.put<RoleView>(this.buildUrl(`/admin/roles/${roleId}`), request);
  }

  remove(roleId: string) {
    return this.httpClient.delete<void>(this.buildUrl(`/admin/roles/${roleId}`));
  }

  listPermissions() {
    return this.httpClient.get<PermissionView[]>(this.buildUrl('/admin/permissions'));
  }

  private buildUrl(path: string): string {
    const apiBaseUrl = this.runtimeConfigService.config().apiBaseUrl.replace(/\/$/, '');
    return `${apiBaseUrl}${path}`;
  }
}
