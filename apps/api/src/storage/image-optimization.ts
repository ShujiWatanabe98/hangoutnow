import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';

export const PROFILE_IMAGE_SPEC = { width: 512, height: 512, quality: 68, maxInputBytes: 1_100_000 } as const;
export const HANGOUT_IMAGE_SPEC = { width: 960, height: 540, quality: 70, maxInputBytes: 20_000_000 } as const;

type ImageSpec = typeof PROFILE_IMAGE_SPEC | typeof HANGOUT_IMAGE_SPEC;

export interface OptimizedImage {
  body: Buffer;
  contentType: 'image/webp';
  dataUrl: string;
  extension: 'webp';
}

export async function optimizeDataImage(dataUrl: string, spec: ImageSpec): Promise<OptimizedImage> {
  const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+=*)$/.exec(dataUrl);
  if (!match) throw new BadRequestException('対応していない画像形式です');
  const input = Buffer.from(match[2]!, 'base64');
  if (!input.length || input.length > spec.maxInputBytes) throw new BadRequestException('画像サイズが大きすぎます');
  try {
    const body = await sharp(input, { failOn: 'error', limitInputPixels: 40_000_000 })
      .rotate()
      .resize(spec.width, spec.height, { fit: 'cover', position: 'attention' })
      .webp({ quality: spec.quality, effort: 4, smartSubsample: true })
      .toBuffer();
    return { body, contentType: 'image/webp', extension: 'webp', dataUrl: `data:image/webp;base64,${body.toString('base64')}` };
  } catch {
    throw new BadRequestException('画像をスマートフォン向けに変換できませんでした');
  }
}
