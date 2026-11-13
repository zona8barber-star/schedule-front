/** Colombian country calling code; the business operates in Colombia. */
const COLOMBIA_CODE = '57';
/** Colombian national numbers (mobile 3xx and fixed 60x) have 10 digits. */
const COLOMBIA_NATIONAL_LENGTH = 10;
/** E.164 allows at most 15 digits; shorter than 8 is never a reachable number. */
const INTERNATIONAL_MIN = 8;
const INTERNATIONAL_MAX = 15;

/**
 * Normalises a free-text phone to the digits-only international number wa.me expects
 * (no "+", no spaces). Adds 57 only when it is missing. Returns null when the value cannot be a
 * real number, so callers render no link instead of a broken one (SONDA BUG-048).
 */
export function toWhatsAppNumber(phone: string | null | undefined): string | null {
  const trimmed = phone?.trim() ?? '';
  let digits = trimmed.replace(/\D/g, '');
  if (!digits) return null;

  const explicitInternational = trimmed.startsWith('+') || digits.startsWith('00');
  if (digits.startsWith('00')) digits = digits.slice(2);

  if (digits.startsWith(COLOMBIA_CODE) && digits.length === COLOMBIA_CODE.length + COLOMBIA_NATIONAL_LENGTH) {
    return digits;
  }

  if (explicitInternational) {
    // "+57" must be followed by exactly one national number; other countries only need a plausible length.
    if (digits.startsWith(COLOMBIA_CODE)) return null;
    return digits.length >= INTERNATIONAL_MIN && digits.length <= INTERNATIONAL_MAX ? digits : null;
  }

  return digits.length === COLOMBIA_NATIONAL_LENGTH ? `${COLOMBIA_CODE}${digits}` : null;
}

/** Builds a https://wa.me link (optionally with a prefilled message), or null when the phone is unusable. */
export function whatsAppUrl(phone: string | null | undefined, message?: string): string | null {
  const number = toWhatsAppNumber(phone);
  if (!number) return null;
  return message ? `https://wa.me/${number}?text=${encodeURIComponent(message)}` : `https://wa.me/${number}`;
}
