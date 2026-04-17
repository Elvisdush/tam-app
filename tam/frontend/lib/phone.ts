/**
 * Normalize stored phone numbers for SMS (E.164-style with leading +).
 * Prefer saving numbers with country code at registration (e.g. +250788123456).
 */
export function normalizePhoneForSms(phone: string): string | null {
  const t = phone.trim();
  if (!t) return null;
  const digits = t.replace(/\D/g, '');
  if (!digits) return null;
  if (t.startsWith('+')) {
    return `+${digits}`;
  }
  const defaultCc = (process.env.EXPO_PUBLIC_DEFAULT_SMS_COUNTRY_CODE ?? '1').replace(/\D/g, '');
  if (digits.length === 10 && defaultCc === '1') {
    return `+1${digits}`;
  }
  return `+${digits}`;
}

/** e.g. +15551234567 → "•••• 4567" */
export function maskPhoneForDisplay(e164: string): string {
  const digits = e164.replace(/\D/g, '');
  if (digits.length < 4) return '••••';
  return `•••• ${digits.slice(-4)}`;
}
