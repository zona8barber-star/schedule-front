import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { RuntimeConfigService } from '../config/runtime-config.service';
import { StaffProfileUpdateRequest, StaffSelfProfileResponse } from '../models/staff.models';
import { getUploadFileName } from '../utils/upload-file-name.utils';

@Injectable({
  providedIn: 'root',
})
export class StaffProfileApiService {
  private readonly httpClient = inject(HttpClient);
  private readonly runtimeConfigService = inject(RuntimeConfigService);

  getCurrent() {
    return this.httpClient.get<StaffSelfProfileResponse>(this.buildUrl('/staff/profile'));
  }

  updateCurrent(request: StaffProfileUpdateRequest) {
    return this.httpClient.put<StaffSelfProfileResponse>(this.buildUrl('/staff/profile'), request);
  }

  uploadPhoto(file: File) {
    const form = new FormData();
    form.append('photo', file, getUploadFileName(file, 'staff-photo'));
    return this.httpClient.post<StaffSelfProfileResponse>(
      this.buildUrl('/staff/profile/photo'),
      form,
      {
        headers: {
          'X-Upload-File-Size': String(file.size),
          'X-Upload-File-Type': file.type || 'unknown',
        },
      },
    );
  }

  removePhoto() {
    return this.httpClient.delete<StaffSelfProfileResponse>(this.buildUrl('/staff/profile/photo'));
  }

  uploadTipsQr(file: File) {
    const form = new FormData();
    form.append('file', file, getUploadFileName(file, 'tips-qr'));
    return this.httpClient.post<StaffSelfProfileResponse>(
      this.buildUrl('/staff/profile/tips-qr'),
      form,
      {
        headers: {
          'X-Upload-File-Size': String(file.size),
          'X-Upload-File-Type': file.type || 'unknown',
        },
      },
    );
  }

  removeTipsQr() {
    return this.httpClient.delete<StaffSelfProfileResponse>(
      this.buildUrl('/staff/profile/tips-qr'),
    );
  }

  private buildUrl(path: string): string {
    const apiBaseUrl = this.runtimeConfigService.config().apiBaseUrl.replace(/\/$/, '');
    return `${apiBaseUrl}${path}`;
  }
}
