import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import {
  CustomerSummaryResponse,
  NotificationBroadcastPreviewResponse,
  NotificationBroadcastRequest,
  NotificationCampaignResponse,
  NotificationHistoryResponse,
  NotificationInboxResponse,
  NotificationPreferencesResponse,
  NotificationPreferencesUpdateRequest,
  PushClientConfigResponse,
  PushSubscriptionRequest,
  PushUnsubscribeRequest,
} from '../models/notification.models';
import { RuntimeConfigService } from '../config/runtime-config.service';

@Injectable({
  providedIn: 'root',
})
export class NotificationsApiService {
  private readonly httpClient = inject(HttpClient);
  private readonly runtimeConfigService = inject(RuntimeConfigService);

  subscribe(request: PushSubscriptionRequest) {
    return this.httpClient.post<void>(this.buildUrl('/notifications/subscribe'), request);
  }

  unsubscribe(request: PushUnsubscribeRequest) {
    return this.httpClient.post<void>(this.buildUrl('/notifications/unsubscribe'), request);
  }

  getPushConfig() {
    return this.httpClient.get<PushClientConfigResponse>(this.buildUrl('/notifications/push-config'));
  }

  getInbox(limit: number, offset = 0) {
    const params: Record<string, number> = offset > 0 ? { limit, offset } : { limit };
    return this.httpClient.get<NotificationInboxResponse>(this.buildUrl('/notifications/inbox'), { params });
  }

  markNotificationAsRead(notificationId: string) {
    return this.httpClient.post<void>(
      this.buildUrl(`/notifications/inbox/${encodeURIComponent(notificationId)}/read`),
      {},
    );
  }

  markAllNotificationsAsRead() {
    return this.httpClient.post<void>(this.buildUrl('/notifications/inbox/read-all'), {});
  }

  /** ADR-0019 N5: historial completo, paginado; con `unreadOnly` solo las sin leer. */
  getHistory(page: number, pageSize: number, unreadOnly: boolean) {
    return this.httpClient.get<NotificationHistoryResponse>(this.buildUrl('/notifications/history'), {
      params: { page, pageSize, unreadOnly },
    });
  }

  /** ADR-0019 N4: qué tipos de aviso llegan por push. */
  getPreferences() {
    return this.httpClient.get<NotificationPreferencesResponse>(this.buildUrl('/notifications/preferences'));
  }

  updatePreferences(request: NotificationPreferencesUpdateRequest) {
    return this.httpClient.put<NotificationPreferencesResponse>(this.buildUrl('/notifications/preferences'), request);
  }

  /** BUG-110: a quién llegaría la difusión, sin enviarla. */
  previewBroadcast(request: NotificationBroadcastRequest) {
    return this.httpClient.post<NotificationBroadcastPreviewResponse>(
      this.buildUrl('/admin/notifications/broadcast/preview'),
      request,
    );
  }

  broadcast(request: NotificationBroadcastRequest) {
    return this.httpClient.post<NotificationCampaignResponse>(
      this.buildUrl('/admin/notifications/broadcast'),
      request,
    );
  }

  getCampaigns() {
    return this.httpClient.get<NotificationCampaignResponse[]>(
      this.buildUrl('/admin/notifications/campaigns'),
    );
  }

  searchCustomers(search: string | null) {
    const params = search?.trim() ? { search: search.trim() } : undefined;
    return this.httpClient.get<CustomerSummaryResponse[]>(
      this.buildUrl('/admin/notifications/customers/search'),
      { params },
    );
  }

  private buildUrl(path: string): string {
    const apiBaseUrl = this.runtimeConfigService.config().apiBaseUrl.replace(/\/$/, '');
    return `${apiBaseUrl}${path}`;
  }
}
