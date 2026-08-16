import { Body, Controller, Delete, Inject, Post } from '@nestjs/common';
import { SubscribeNewsletterDto, UnsubscribeNewsletterDto } from './newsletter.dto';
import { NewsletterService } from './newsletter.service';

@Controller('newsletter/subscriptions')
export class NewsletterController {
  constructor(@Inject(NewsletterService) private readonly newsletter: NewsletterService) {}

  @Post()
  subscribe(@Body() body: SubscribeNewsletterDto) {
    return this.newsletter.subscribe(body);
  }

  @Delete()
  unsubscribe(@Body() body: UnsubscribeNewsletterDto) {
    return this.newsletter.unsubscribe(body.token);
  }
}
