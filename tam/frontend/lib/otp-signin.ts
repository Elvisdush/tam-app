import { ref, remove, set, get } from 'firebase/database';
import { database } from '@/lib/firebase';

/** OTP validity window (2 minutes) */
export const OTP_TTL_MS = 2 * 60 * 1000;

/** Safe Firebase path segment for an email (no . # $ [ ] /) */
export function otpKeyForEmail(email: string): string {
  return email.toLowerCase().trim().replace(/[.#$\[\]/]/g, '_');
}

export function generateSixDigitCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function writeSignInOtp(
  email: string,
  payload: { code: string; expiresAt: number; userId: string }
): Promise<void> {
  const key = otpKeyForEmail(email);
  await set(ref(database, `otpSignIn/${key}`), payload);
}

export async function readSignInOtp(email: string): Promise<{
  code: string;
  expiresAt: number;
  userId: string;
} | null> {
  const key = otpKeyForEmail(email);
  const snapshot = await get(ref(database, `otpSignIn/${key}`));
  if (!snapshot.exists()) return null;
  const v = snapshot.val() as { code?: string; expiresAt?: number; userId?: string };
  if (!v?.code || v.expiresAt == null || !v.userId) return null;
  return { code: v.code, expiresAt: v.expiresAt, userId: v.userId };
}

export async function deleteSignInOtp(email: string): Promise<void> {
  const key = otpKeyForEmail(email);
  await remove(ref(database, `otpSignIn/${key}`));
}
