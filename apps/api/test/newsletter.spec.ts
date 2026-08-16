import { ValidationPipe } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { SubscribeNewsletterDto } from '../src/newsletter/newsletter.dto';
import { NewsletterService } from '../src/newsletter/newsletter.service';
import type { PrismaService } from '../src/prisma/prisma.service';
import type { NewsletterEmailService } from '../src/newsletter/newsletter-email.service';

describe('newsletter subscriptions', () => {
  const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
  const email = { sendWelcome: vi.fn().mockResolvedValue(false) } as unknown as NewsletterEmailService;

  it('validates email, consent and source at the API boundary', async () => {
    await expect(pipe.transform({ email: 'person@example.com', consent: true, source: 'homepage' }, { type: 'body', metatype: SubscribeNewsletterDto })).resolves.toMatchObject({ consent: true });
    await expect(pipe.transform({ email: 'not-an-email', consent: true, source: 'homepage' }, { type: 'body', metatype: SubscribeNewsletterDto })).rejects.toMatchObject({ status: 400 });
    await expect(pipe.transform({ email: 'person@example.com', consent: false, source: 'homepage' }, { type: 'body', metatype: SubscribeNewsletterDto })).rejects.toMatchObject({ status: 400 });
  });

  it('normalizes and stores a new subscriber without exposing a stored token', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'subscription-id' });
    const db = { newsletterSubscription: { findUnique: vi.fn().mockResolvedValue(null), create, update: vi.fn() } } as unknown as PrismaService;
    const result = await new NewsletterService(db, email).subscribe({ email: ' Person@Example.COM ', consent: true, source: 'homepage' });
    expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({ email: 'person@example.com', unsubscribeTokenHash: expect.stringMatching(/^[a-f0-9]{64}$/) }) });
    expect(result.unsubscribeToken).toMatch(/^[a-f0-9]{64}$/);
    expect(create.mock.calls[0]?.[0].data).not.toHaveProperty('unsubscribeToken');
  });

  it('does not create a duplicate active subscription', async () => {
    const create = vi.fn();
    const db = { newsletterSubscription: { findUnique: vi.fn().mockResolvedValue({ id: 'subscription-id', unsubscribedAt: null }), create, update: vi.fn() } } as unknown as PrismaService;
    await expect(new NewsletterService(db, email).subscribe({ email: 'person@example.com', consent: true, source: 'homepage' })).resolves.toEqual({ registered: true, alreadyRegistered: true });
    expect(create).not.toHaveBeenCalled();
  });

  it('unsubscribes using only the hashed token lookup', async () => {
    const update = vi.fn().mockResolvedValue({ id: 'subscription-id' });
    const findUnique = vi.fn().mockResolvedValue({ id: 'subscription-id', unsubscribedAt: null });
    const db = { newsletterSubscription: { findUnique, create: vi.fn(), update } } as unknown as PrismaService;
    const token = 'a'.repeat(64);
    await expect(new NewsletterService(db, email).unsubscribe(token)).resolves.toEqual({ unsubscribed: true });
    expect(findUnique).toHaveBeenCalledWith({ where: { unsubscribeTokenHash: expect.stringMatching(/^[a-f0-9]{64}$/) } });
    expect(findUnique.mock.calls[0]?.[0].where.unsubscribeTokenHash).not.toBe(token);
    expect(update).toHaveBeenCalledWith({ where: { id: 'subscription-id' }, data: { unsubscribedAt: expect.any(Date) } });
  });
});
