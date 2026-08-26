import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { RuntimeConfigService } from '../config/runtime-config.service';
import {
  AdminStaffCreateRequest,
  AdminStaffUpdateRequest,
  EnableProfessionalProfileRequest,
  StaffListItem,
  StaffResponse,
  StaffStatusUpdateRequest,
} from '../models/staff.models';
import { getUploadFileName } from '../utils/upload-file-name.utils';

@Injectable({
  providedIn: 'root',
})
export class AdminStaffApiService {
  private readonly httpClient = inject(HttpClient);
  private readonly runtimeConfigService = inject(RuntimeConfigService);

  list() {
    return this.httpClient.get<StaffListItem[]>(this.buildUrl('/admin/staff'));
  }

  getById(staffId: string) {
    return this.httpClient.get<StaffResponse>(this.buildUrl(`/admin/staff/${staffId}`));
  }

  create(request: AdminStaffCreateRequest) {
    return this.httpClient.post<StaffResponse>(this.buildUrl('/admin/staff'), request);
  }

  update(staffId: string, request: AdminStaffUpdateRequest) {
    return this.httpClient.put<StaffResponse>(this.buildUrl(`/admin/staff/${staffId}`), request);
  }

  updateStatus(staffId: string, request: StaffStatusUpdateRequest) {
    return this.httpClient.patch<StaffResponse>(
      this.buildUrl(`/admin/staff/${staffId}/status`),
      request,
    );
  }

  activateOwnProfessionalProfile(request: EnableProfessionalProfileRequest) {
    return this.httpClient.post<StaffResponse>(this.buildUrl('/admin/staff/me'), request);
  }

  remove(staffId: string) {
    return this.httpClient.delete<void>(this.buildUrl(`/admin/staff/${staffId}`));
  }

  uploadPhoto(staffId: string, file: File) {
    const fileName = getUploadFileName(file, 'admin-staff-photo');
    return this.httpClient.post<StaffResponse>(this.buildUrl(`/admin/staff/${staffId}/photo`), file, {
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
        'X-Upload-File-Name': encodeURIComponent(fileName),
        'X-Upload-File-Size': String(file.size),
        'X-Upload-File-Type': file.type || 'unknown',
      },
    });
  }

  removePhoto(staffId: string) {
    return this.httpClient.delete<StaffResponse>(this.buildUrl(`/admin/staff/${staffId}/photo`));
  }

  uploadTipsQr(staffId: string, file: File) {
    const fileName = getUploadFileName(file, 'admin-staff-tips-qr');
    return this.httpClient.post<StaffResponse>(this.buildUrl(`/admin/staff/${staffId}/tips-qr`), file, {
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
        'X-Upload-File-Name': encodeURIComponent(fileName),
        'X-Upload-File-Size': String(file.size),
        'X-Upload-File-Type': file.type || 'unknown',
      },
    });
  }

  removeTipsQr(staffId: string) {
    return this.httpClient.delete<StaffResponse>(this.buildUrl(`/admin/staff/${staffId}/tips-qr`));
  }

  private buildUrl(path: string): string {
    const apiBaseUrl = this.runtimeConfigService.config().apiBaseUrl.replace(/\/$/, '');
    return `${apiBaseUrl}${path}`;
  }
}
