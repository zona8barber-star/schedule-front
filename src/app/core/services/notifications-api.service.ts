import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import {
  CustomerSummaryResponse,
  NotificationBroadcastRequest,
  NotificationCampaignResponse,
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
