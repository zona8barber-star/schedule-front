const FALLBACK_EXTENSIONS: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/gif': '.gif',
  'image/heic': '.heic',
  'image/heif': '.heif',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

export function getUploadFileName(file: File, fallbackBaseName: string): string {
  const fileName = file.name.trim();
  if (fileName) {
    return fileName;
  }

  const contentType = file.type.split(';')[0]?.trim().toLowerCase() ?? '';
  return `${fallbackBaseName}${FALLBACK_EXTENSIONS[contentType] ?? ''}`;
}
