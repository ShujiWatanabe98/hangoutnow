import { Body, Controller, Inject, Post, Req, UseGuards } from '@nestjs/common';
import { AccessTokenGuard, AuthenticatedRequest } from '../auth/access-token.guard';
import { SaveMatchFeedbackDto, TrackFunnelEventDto } from './analytics.dto';
import { AnalyticsService } from './analytics.service';

@Controller('analytics/events')
@UseGuards(AccessTokenGuard)
export class AnalyticsController {
  constructor(@Inject(AnalyticsService) private readonly analytics: AnalyticsService) {}

  @Post()
  track(@Req() request: AuthenticatedRequest, @Body() body: TrackFunnelEventDto) {
    return this.analytics.track(request.userId, body);
  }
}

@Controller('analytics/match-feedback')
@UseGuards(AccessTokenGuard)
export class MatchFeedbackController {
  constructor(@Inject(AnalyticsService) private readonly analytics: AnalyticsService) {}

  @Post()
  save(@Req() request: AuthenticatedRequest, @Body() body: SaveMatchFeedbackDto) {
    return this.analytics.saveMatchFeedback(request.userId, body);
  }
}
