export interface PushSubscriptionRequest {
  endpoint: string;
  p256dhKey: string;
  authKey: string;
  userAgent?: string | null;
}

export interface PushUnsubscribeRequest {
  endpoint: string;
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
