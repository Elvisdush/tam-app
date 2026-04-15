/**
 * Server-side Twilio SMS (avoids browser CORS — Twilio API is not callable from web clients).
 * Reads TWILIO_* or falls back to EXPO_PUBLIC_TWILIO_* when the API shares the app .env file.
 */

const TWILIO_MESSAGES = (accountSid: string) =>
  `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

function basicAuthHeader(accountSid: string, authToken: string): string {
  const raw = `${accountSid}:${authToken}`;
  return `Basic ${Buffer.from(raw, 'utf8').toString('base64')}`;
}

const E164 = /^\+[1-9]\d{6,14}$/;
const CODE = /^\d{6}$/;

export function getTwilioEnv(): { accountSid: string; authToken: string; from: string } | null {
  const accountSid =
    process.env.TWILIO_ACCOUNT_SID?.trim() || process.env.EXPO_PUBLIC_TWILIO_ACCOUNT_SID?.trim();
  const authToken =
    process.env.TWILIO_AUTH_TOKEN?.trim() || process.env.EXPO_PUBLIC_TWILIO_AUTH_TOKEN?.trim();
  const from = process.env.TWILIO_FROM?.trim() || process.env.EXPO_PUBLIC_TWILIO_FROM?.trim();
  if (!accountSid || !authToken || !from) return null;
  return { accountSid, authToken, from };
}

export async function sendSignInOtpViaTwilioServer(
  toE164: string,
  code: string
): Promise<{ ok: true } | { ok: false; status: number; detail: string }> {
  if (!E164.test(toE164) || !CODE.test(code)) {
    return { ok: false, status: 400, detail: 'Invalid phone or code format' };
  }

  const creds = getTwilioEnv();
  if (!creds) {
    return { ok: false, status: 503, detail: 'Twilio is not configured on the server' };
  }

  const body = `Your sign-in code is ${code}. It expires in 2 minutes. If you didn’t try to sign in, ignore this message.`;

  try {
    const res = await fetch(TWILIO_MESSAGES(creds.accountSid), {
      method: 'POST',
      headers: {
        Authorization: basicAuthHeader(creds.accountSid, creds.authToken),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: toE164,
        From: creds.from,
        Body: body,
      }).toString(),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return { ok: false, status: res.status, detail: errText.slice(0, 500) };
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, status: 502, detail: msg };
  }
}
