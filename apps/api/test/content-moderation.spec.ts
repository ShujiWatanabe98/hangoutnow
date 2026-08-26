import { BadRequestException } from '@nestjs/common';
import { afterEach, describe, expect, it } from 'vitest';
import { ContentModerationService } from '../src/moderation/content-moderation.service';

describe('ContentModerationService', () => {
  afterEach(() => { delete process.env.UGC_BLOCKED_TERMS; });

  it('allows ordinary activity and chat text', () => {
    const service = new ContentModerationService();
    expect(() => service.assertAllowed('新宿でカフェに行きましょう', ['初参加歓迎', '途中退出OK'])).not.toThrow();
  });

  it('rejects normalized and configured objectionable text before posting', () => {
    process.env.UGC_BLOCKED_TERMS = '危険な勧誘';
    const service = new ContentModerationService();
    expect(() => service.assertAllowed('死　ね')).toThrow(BadRequestException);
    expect(() => service.assertAllowed('これは危険な勧誘です')).toThrow(BadRequestException);
  });
});
