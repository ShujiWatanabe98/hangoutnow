import { afterEach, describe, expect, it, vi } from 'vitest';
import { NewsletterEmailService } from '../src/newsletter/newsletter-email.service';

describe('newsletter confirmation email', () => {
  const previousKey = process.env.RESEND_API_KEY;
  const previousFrom = process.env.NEWSLETTER_FROM_EMAIL;
  afterEach(() => {
    vi.unstubAllGlobals();
    if (previousKey === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = previousKey;
    if (previousFrom === undefined) delete process.env.NEWSLETTER_FROM_EMAIL; else process.env.NEWSLETTER_FROM_EMAIL = previousFrom;
  });

  it('does not attempt delivery when the provider is not configured', async () => {
    delete process.env.RESEND_API_KEY;
    delete process.env.NEWSLETTER_FROM_EMAIL;
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(new NewsletterEmailService().sendWelcome('person@example.com', 'a'.repeat(64))).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends a confirmation with a scoped unsubscribe URL when configured', async () => {
    process.env.RESEND_API_KEY = 'test-key';
    process.env.NEWSLETTER_FROM_EMAIL = 'Hangout Now <updates@example.com>';
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    await expect(new NewsletterEmailService().sendWelcome('person@example.com', 'b'.repeat(64))).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledWith('https://api.resend.com/emails', expect.objectContaining({ method: 'POST', headers: expect.objectContaining({ authorization: 'Bearer test-key' }) }));
    const request = fetchMock.mock.calls[0]?.[1] as { body: string };
    const body = JSON.parse(request.body) as { html: string; to: string[] };
    expect(body.to).toEqual(['person@example.com']);
    expect(body.html).toContain('/newsletter-unsubscribe.html?token=');
  });
});
