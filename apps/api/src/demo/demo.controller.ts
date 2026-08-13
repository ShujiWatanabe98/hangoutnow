import { Controller, Inject, Post, Req, UseGuards } from '@nestjs/common';
import { AccessTokenGuard, AuthenticatedRequest } from '../auth/access-token.guard';
import { DemoService } from './demo.service';

@Controller('demo')
@UseGuards(AccessTokenGuard)
export class DemoController {
  constructor(@Inject(DemoService) private readonly service: DemoService) {}
  @Post('reset') reset(@Req() request: AuthenticatedRequest) { return this.service.reset(request.userId); }
}
