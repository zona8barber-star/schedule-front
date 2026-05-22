export type SocialPlatformKey = 'instagram' | 'facebook' | 'tiktok' | 'youtube' | 'whatsapp';

export interface BusinessSocialProfiles {
  instagram?: string;
  facebook?: string;
  tiktok?: string;
  youtube?: string;
  whatsapp?: string;
}

export interface SocialPlatformDefinition {
  key: SocialPlatformKey;
  label: string;
  icon: string;
}

export const SOCIAL_PLATFORM_DEFINITIONS: readonly SocialPlatformDefinition[] = [
  { key: 'instagram', label: 'Instagram', icon: '📷' },
  { key: 'facebook', label: 'Facebook', icon: 'f' },
  { key: 'tiktok', label: 'TikTok', icon: '♪' },
  { key: 'youtube', label: 'YouTube', icon: '▶' },
  { key: 'whatsapp', label: 'WhatsApp', icon: '💬' },
];

export const BUSINESS_SOCIAL_PROFILES: BusinessSocialProfiles = {
  instagram: '',
  facebook: '',
  tiktok: '',
  youtube: '',
  whatsapp: '',
};
