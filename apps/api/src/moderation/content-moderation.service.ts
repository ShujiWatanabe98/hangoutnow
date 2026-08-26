import { BadRequestException, Injectable } from '@nestjs/common';

const DEFAULT_BLOCKED_FRAGMENTS = [
  '死ね',
  '自殺しろ',
  '殺す',
  'ころす',
  'レイプ',
  '強姦',
  '児童ポルノ',
  '売春',
  '援交',
  '覚醒剤',
  'セフレ',
  'kill yourself',
  'child porn',
  'rape',
  'porn',
] as const;

type ModeratedValue = string | null | undefined | readonly string[];

@Injectable()
export class ContentModerationService {
  private readonly blockedFragments: readonly string[];

  constructor() {
    const configured = (process.env.UGC_BLOCKED_TERMS ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    this.blockedFragments = [...DEFAULT_BLOCKED_FRAGMENTS, ...configured]
      .map((value) => this.normalize(value));
  }

  assertAllowed(...values: ModeratedValue[]): void {
    for (const value of values.flatMap((item) => Array.isArray(item) ? item : [item])) {
      if (typeof value !== 'string' || !value.trim()) continue;
      const normalized = this.normalize(value);
      if (this.blockedFragments.some((fragment) => normalized.includes(fragment))) {
        throw new BadRequestException('不適切な表現が含まれています。内容を修正してください');
      }
    }
  }

  private normalize(value: string): string {
    return value
      .normalize('NFKC')
      .toLocaleLowerCase('ja-JP')
      .replace(/[\p{P}\p{S}\p{Z}\s_]+/gu, '');
  }
}
