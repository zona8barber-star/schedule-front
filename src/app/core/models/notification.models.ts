export interface PushSubscriptionRequest {
  endpoint: string;
  p256dhKey: string;
  authKey: string;
  userAgent?: string | null;
}

export interface PushUnsubscribeRequest {
  endpoint: string;
}

export interface PushClientConfigResponse {
  enabled: boolean;
  vapidPublicKey: string | null;
}

export interface UserNotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  url: string | null;
  createdAtUtc: string;
  readAtUtc: string | null;
}

export interface NotificationInboxResponse {
  unreadCount: number;
  items: UserNotificationItem[];
}

export type NotificationBroadcastTargetType = 'all' | 'selected' | 'filter';

export interface NotificationBroadcastRequest {
  title: string;
  body: string;
  targetType: NotificationBroadcastTargetType;
  customerUserIds?: string[] | null;
  staffProfileId?: string | null;
}

export interface NotificationCampaignResponse {
  id: string;
  title: string;
  body: string;
  targetSummary: string;
  recipientCount: number;
  sentByName: string;
  createdAtUtc: string;
}

export interface CustomerSummaryResponse {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string | null;
}
