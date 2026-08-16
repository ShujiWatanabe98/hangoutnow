import { Injectable } from '@nestjs/common';

@Injectable()
export class NewsletterEmailService {
  async sendWelcome(email: string, unsubscribeToken: string): Promise<boolean> {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.NEWSLETTER_FROM_EMAIL;
    if (!apiKey || !from) return false;
    const siteUrl = (process.env.PUBLIC_SITE_URL || 'https://method-more.com').replace(/\/$/, '');
    const unsubscribeUrl = `${siteUrl}/newsletter-unsubscribe.html?token=${encodeURIComponent(unsubscribeToken)}`;
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          from,
          to: [email],
          subject: 'Hangout Now 更新通知の登録を受け付けました',
          html: `<h1>Hangout Now</h1><p>更新通知への登録ありがとうございます。公開情報や重要な安全機能の更新をお知らせします。</p><p><a href="${unsubscribeUrl}">更新通知の登録を解除する</a></p>`,
          text: `Hangout Nowの更新通知への登録ありがとうございます。解除: ${unsubscribeUrl}`,
        }),
        signal: AbortSignal.timeout(5_000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
