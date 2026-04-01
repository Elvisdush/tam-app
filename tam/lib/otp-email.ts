/**
 * Sends sign-in OTP via Resend (https://resend.com).
 * Set EXPO_PUBLIC_RESEND_API_KEY and EXPO_PUBLIC_RESEND_FROM (verified sender) in .env
 * For production, prefer a server-side endpoint — API keys in the app bundle are not ideal.
 */

const RESEND_URL = 'https://api.resend.com/emails';

export async function sendSignInOtpEmail(to: string, code: string): Promise<boolean> {
  const apiKey = process.env.EXPO_PUBLIC_RESEND_API_KEY;
  const from = process.env.EXPO_PUBLIC_RESEND_FROM ?? 'onboarding@resend.dev';

  if (!apiKey?.trim()) {
    if (__DEV__) {
      console.warn(
        '[OTP email] EXPO_PUBLIC_RESEND_API_KEY is missing. Add it to .env and restart Expo (expo start -c).'
      );
    }
    return false;
  }

  try {
    const res = await fetch(RESEND_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey.trim()}`,
      },
      body: JSON.stringify({
        from,
        to: [to.trim()],
        subject: 'Your sign-in code',
        html: `<p>Your sign-in code is <strong style="font-size:20px;letter-spacing:4px">${code}</strong>.</p><p>This code expires in <strong>2 minutes</strong>. If you didn’t try to sign in, ignore this email.</p>`,
      }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      if (__DEV__) {
        console.warn('[OTP email] Resend API error', res.status, errText);
      }
      return false;
    }
    return true;
  } catch (e) {
    if (__DEV__) {
      console.warn('[OTP email] Network error', e);
    }
    return false;
  }
}
