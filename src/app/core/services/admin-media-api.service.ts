import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { RuntimeConfigService } from '../config/runtime-config.service';
import { MediaAssetView, MediaPurpose } from '../models/media.models';

@Injectable({
  providedIn: 'root',
})
export class AdminMediaApiService {
  private readonly httpClient = inject(HttpClient);
  private readonly runtimeConfigService = inject(RuntimeConfigService);

  list() {
    return this.httpClient.get<MediaAssetView[]>(this.buildUrl('/media'));
  }

  getById(mediaAssetId: string) {
    return this.httpClient.get<MediaAssetView>(this.buildUrl(`/media/${mediaAssetId}`));
  }

  upload(file: File, purpose: MediaPurpose) {
    const formData = new FormData();
    formData.append('file', file, file.name);
    formData.append('purpose', purpose);

    return this.httpClient.post<MediaAssetView>(this.buildUrl('/media/upload'), formData);
  }

  delete(mediaAssetId: string) {
    return this.httpClient.delete<void>(this.buildUrl(`/media/${mediaAssetId}`));
  }

  private buildUrl(path: string): string {
    const apiBaseUrl = this.runtimeConfigService.config().apiBaseUrl.replace(/\/$/, '');
    return `${apiBaseUrl}${path}`;
  }
}
