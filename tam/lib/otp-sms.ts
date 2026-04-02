/**
 * Sends sign-in OTP via Twilio SMS (https://www.twilio.com).
 * Set EXPO_PUBLIC_TWILIO_ACCOUNT_SID, EXPO_PUBLIC_TWILIO_AUTH_TOKEN, EXPO_PUBLIC_TWILIO_FROM
 * (your Twilio phone number in E.164). Restart Expo after changing .env.
 * For production, prefer a server-side endpoint — credentials in the app bundle are not ideal.
 */

const TWILIO_MESSAGES = (accountSid: string) =>
  `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

function basicAuthHeader(accountSid: string, authToken: string): string {
  const raw = `${accountSid}:${authToken}`;
  return `Basic ${globalThis.btoa(raw)}`;
}

export async function sendSignInOtpSms(toE164: string, code: string): Promise<boolean> {
  const accountSid = process.env.EXPO_PUBLIC_TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.EXPO_PUBLIC_TWILIO_AUTH_TOKEN?.trim();
  const from = process.env.EXPO_PUBLIC_TWILIO_FROM?.trim();

  if (!accountSid || !authToken || !from) {
    if (__DEV__) {
      const missing = [
        !accountSid && 'EXPO_PUBLIC_TWILIO_ACCOUNT_SID',
        !authToken && 'EXPO_PUBLIC_TWILIO_AUTH_TOKEN',
        !from && 'EXPO_PUBLIC_TWILIO_FROM (Twilio SMS number, e.g. +15551234567)',
      ].filter(Boolean) as string[];
      console.warn(
        '[OTP SMS] Twilio env incomplete — missing:',
        missing.join(', ') || '(unknown)',
        '— check .env in the app root and restart with: npx expo start -c'
      );
    }
    return false;
  }

  const body = `Your sign-in code is ${code}. It expires in 2 minutes. If you didn’t try to sign in, ignore this message.`;

  try {
    const res = await fetch(TWILIO_MESSAGES(accountSid), {
      method: 'POST',
      headers: {
        Authorization: basicAuthHeader(accountSid, authToken),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: toE164,
        From: from,
        Body: body,
      }).toString(),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      if (__DEV__) {
        console.warn('[OTP SMS] Twilio API error', res.status, errText);
      }
      return false;
    }
    return true;
  } catch (e) {
    if (__DEV__) {
      console.warn('[OTP SMS] Network error', e);
    }
    return false;
  }
}
