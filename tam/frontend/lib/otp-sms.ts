/**
 * Sends sign-in OTP via Twilio SMS (https://www.twilio.com).
 *
 * - **Native:** calls Twilio from the app (set EXPO_PUBLIC_TWILIO_*). Auth token in the client is not ideal for production.
 * - **Web:** Twilio’s API does not allow browser requests (CORS). Set `EXPO_PUBLIC_API_BASE_URL` to your Hono server
 *   (e.g. `http://localhost:3000`) and run `npm run server` so SMS is sent via `POST /api/otp/send-sign-in`.
 */

import { Platform } from 'react-native';

const TWILIO_MESSAGES = (accountSid: string) =>
  `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

function basicAuthHeader(accountSid: string, authToken: string): string {
  const raw = `${accountSid}:${authToken}`;
  return `Basic ${globalThis.btoa(raw)}`;
}

function apiBaseUrl(): string | null {
  const raw = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  return raw ? raw.replace(/\/$/, '') : null;
}

async function sendSignInOtpSmsViaServerProxy(toE164: string, code: string): Promise<boolean> {
  const base = apiBaseUrl();
  if (!base) {
    if (__DEV__) {
      console.warn(
        '[OTP SMS] Web requires EXPO_PUBLIC_API_BASE_URL (e.g. http://localhost:3000) and the API server running so Twilio can be called without CORS.'
      );
    }
    return false;
  }

  const secret = process.env.EXPO_PUBLIC_OTP_PROXY_SECRET?.trim();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (secret) {
    headers['x-otp-proxy-secret'] = secret;
  }

  try {
    const res = await fetch(`${base}/api/otp/send-sign-in`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ toE164, code }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      if (__DEV__) {
        console.warn('[OTP SMS] Proxy error', res.status, errText);
      }
      return false;
    }
    const data = (await res.json().catch(() => null)) as { ok?: boolean } | null;
    return data?.ok === true;
  } catch (e) {
    if (__DEV__) {
      console.warn('[OTP SMS] Proxy network error — is the API server running?', e);
    }
    return false;
  }
}

export async function sendSignInOtpSms(toE164: string, code: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    return sendSignInOtpSmsViaServerProxy(toE164, code);
  }

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
