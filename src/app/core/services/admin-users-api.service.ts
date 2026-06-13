import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { RuntimeConfigService } from '../config/runtime-config.service';
import { AdminUserItem, AdminUserUpdateRequest } from '../models/admin-user.models';

@Injectable({
  providedIn: 'root',
})
export class AdminUsersApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RuntimeConfigService);

  list() {
    return this.http.get<AdminUserItem[]>(this.url('/admin/users'));
  }

  getById(userId: string) {
    return this.http.get<AdminUserItem>(this.url(`/admin/users/${userId}`));
  }

  update(userId: string, request: AdminUserUpdateRequest) {
    return this.http.put<AdminUserItem>(this.url(`/admin/users/${userId}`), request);
  }

  deactivate(userId: string) {
    return this.http.delete<void>(this.url(`/admin/users/${userId}`));
  }

  private url(path: string): string {
    return `${this.config.config().apiBaseUrl.replace(/\/$/, '')}${path}`;
  }
}
