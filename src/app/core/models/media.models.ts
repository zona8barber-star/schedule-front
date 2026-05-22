export const MEDIA_PURPOSE = {
  logo: 'Logo',
  appIcon: 'AppIcon',
  banner: 'Banner',
  staffPhoto: 'StaffPhoto',
  tipsQr: 'TipsQr',
  customerReference: 'CustomerReference',
  other: 'Other',
} as const;

export type MediaPurpose = (typeof MEDIA_PURPOSE)[keyof typeof MEDIA_PURPOSE];

export const MEDIA_STATUS = {
  pending: 'Pending',
  ready: 'Ready',
  archived: 'Archived',
  failed: 'Failed',
} as const;

export type MediaStatus = (typeof MEDIA_STATUS)[keyof typeof MEDIA_STATUS];

export interface MediaAssetView {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  storageKey: string;
  publicUrl: string | null;
  purpose: MediaPurpose;
  status: MediaStatus;
  uploadedByUserId: string;
  failureReason: string | null;
  createdAtUtc: string;
  updatedAtUtc: string | null;
}

export interface MediaPurposeOption {
  value: MediaPurpose;
  label: string;
  hint?: string;
}

export const MEDIA_PURPOSE_OPTIONS: readonly MediaPurposeOption[] = [
  {
    value: MEDIA_PURPOSE.logo,
    label: 'Logo',
    hint: 'Logotipo principal de la aplicacion o marca.',
  },
  {
    value: MEDIA_PURPOSE.appIcon,
    label: 'App icon',
    hint: 'Icono para instalar la app en el celular.',
  },
  {
    value: MEDIA_PURPOSE.banner,
    label: 'Banner',
    hint: 'Imagenes de hero o promocionales para landing.',
  },
  {
    value: MEDIA_PURPOSE.staffPhoto,
    label: 'Foto staff',
    hint: 'Foto de perfil para staff publicado.',
  },
  {
    value: MEDIA_PURPOSE.tipsQr,
    label: 'QR propinas',
    hint: 'Codigo QR vinculado al staff.',
  },
  {
    value: MEDIA_PURPOSE.customerReference,
    label: 'Referencia cliente',
    hint: 'Soporte visual asociado a solicitudes de cliente.',
  },
  {
    value: MEDIA_PURPOSE.other,
    label: 'Otro',
    hint: 'Activo no clasificado para usos internos.',
  },
] as const;
