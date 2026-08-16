import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { v7 as uuidv7 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { SubscribeNewsletterDto } from './newsletter.dto';

const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

@Injectable()
export class NewsletterService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  async subscribe(input: SubscribeNewsletterDto) {
    if (!input.consent) throw new BadRequestException('Consent is required');
    const email = input.email.trim().toLowerCase();
    const existing = await this.db.newsletterSubscription.findUnique({ where: { email } });
    if (existing && !existing.unsubscribedAt) return { registered: true, alreadyRegistered: true };

    const token = randomBytes(32).toString('hex');
    const unsubscribeTokenHash = hashToken(token);
    const now = new Date();
    if (existing) {
      await this.db.newsletterSubscription.update({
        where: { email },
        data: { consentAt: now, source: input.source, subscribedAt: now, unsubscribedAt: null, unsubscribeTokenHash },
      });
    } else {
      await this.db.newsletterSubscription.create({
        data: { id: uuidv7(), email, consentAt: now, source: input.source, unsubscribeTokenHash },
      });
    }
    return { registered: true, alreadyRegistered: false, unsubscribeToken: token };
  }

  async unsubscribe(token: string) {
    const subscription = await this.db.newsletterSubscription.findUnique({ where: { unsubscribeTokenHash: hashToken(token) } });
    if (!subscription) throw new NotFoundException('Subscription not found');
    if (!subscription.unsubscribedAt) {
      await this.db.newsletterSubscription.update({ where: { id: subscription.id }, data: { unsubscribedAt: new Date() } });
    }
    return { unsubscribed: true };
  }
}
