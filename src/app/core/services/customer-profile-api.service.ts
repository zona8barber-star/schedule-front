import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { RuntimeConfigService } from '../config/runtime-config.service';
import {
  CustomerPasswordChangeRequest,
  CustomerProfileResponse,
  CustomerProfileUpdateRequest,
} from '../models/customer-profile.models';
import { getUploadFileName } from '../utils/upload-file-name.utils';

@Injectable({
  providedIn: 'root',
})
export class CustomerProfileApiService {
  private readonly httpClient = inject(HttpClient);
  private readonly runtimeConfigService = inject(RuntimeConfigService);

  get() {
    return this.httpClient.get<CustomerProfileResponse>(this.buildUrl('/customer/profile'));
  }

  update(request: CustomerProfileUpdateRequest) {
    return this.httpClient.patch<CustomerProfileResponse>(
      this.buildUrl('/customer/profile'),
      request,
    );
  }

  uploadPhoto(file: File) {
    const fileName = getUploadFileName(file, 'profile-photo');
    return this.httpClient.post<CustomerProfileResponse>(
      this.buildUrl('/customer/profile/photo'),
      file,
      {
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
          'X-Upload-File-Name': encodeURIComponent(fileName),
          'X-Upload-File-Size': String(file.size),
          'X-Upload-File-Type': file.type || 'unknown',
        },
      },
    );
  }

  removePhoto() {
    return this.httpClient.delete<CustomerProfileResponse>(
      this.buildUrl('/customer/profile/photo'),
    );
  }

  changePassword(request: CustomerPasswordChangeRequest) {
    return this.httpClient.post<void>(this.buildUrl('/customer/profile/password'), request);
  }

  private buildUrl(path: string): string {
    const apiBaseUrl = this.runtimeConfigService.config().apiBaseUrl.replace(/\/$/, '');
    return `${apiBaseUrl}${path}`;
  }
}
