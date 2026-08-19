import { afterEach, describe, expect, it, vi } from 'vitest';
import { SmsVerificationProvider } from '../src/auth/sms-verification.provider';

describe('SmsVerificationProvider', () => {
  const previousAccountSid = process.env.TWILIO_ACCOUNT_SID;
  const previousAuthToken = process.env.TWILIO_AUTH_TOKEN;
  const previousServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

  afterEach(() => {
    vi.unstubAllGlobals();
    if (previousAccountSid === undefined) delete process.env.TWILIO_ACCOUNT_SID;
    else process.env.TWILIO_ACCOUNT_SID = previousAccountSid;
    if (previousAuthToken === undefined) delete process.env.TWILIO_AUTH_TOKEN;
    else process.env.TWILIO_AUTH_TOKEN = previousAuthToken;
    if (previousServiceSid === undefined) delete process.env.TWILIO_VERIFY_SERVICE_SID;
    else process.env.TWILIO_VERIFY_SERVICE_SID = previousServiceSid;
  });

  it('reports an invalid Twilio destination as a user-correctable phone error', async () => {
    process.env.TWILIO_ACCOUNT_SID = `AC${'1'.repeat(32)}`;
    process.env.TWILIO_AUTH_TOKEN = '2'.repeat(32);
    process.env.TWILIO_VERIFY_SERVICE_SID = `VA${'3'.repeat(32)}`;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: 60200 }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    })));

    await expect(new SmsVerificationProvider().request('+819012345678'))
      .rejects.toThrow('携帯電話番号を確認してください');
  });
});
