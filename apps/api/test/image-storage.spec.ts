import { ServiceUnavailableException } from '@nestjs/common';
import { afterEach, describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { ImageStorageService } from '../src/storage/image-storage.service';

const storageKeys = [
  'S3_ENDPOINT',
  'S3_REGION',
  'S3_BUCKET',
  'S3_ACCESS_KEY_ID',
  'S3_SECRET_ACCESS_KEY',
  'S3_PUBLIC_BASE_URL',
] as const;

describe('profile image storage boundary', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalStorage = Object.fromEntries(storageKeys.map((key) => [key, process.env[key]]));

  afterEach(() => {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    for (const key of storageKeys) {
      const value = originalStorage[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('fails closed in production instead of persisting image bytes on the app server', async () => {
    process.env.NODE_ENV = 'production';
    for (const key of storageKeys) delete process.env[key];
    const service = new ImageStorageService();

    const source = await sharp({ create: { width: 900, height: 600, channels: 3, background: '#4f8f67' } }).png().toBuffer();
    await expect(service.storeProfilePhoto('user-1', `data:image/png;base64,${source.toString('base64')}`)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('stores a 512px WebP only as a local-development fallback', async () => {
    process.env.NODE_ENV = 'development';
    for (const key of storageKeys) delete process.env[key];
    const service = new ImageStorageService();
    const source = await sharp({ create: { width: 900, height: 600, channels: 3, background: '#4f8f67' } }).png().toBuffer();
    const dataUrl = `data:image/png;base64,${source.toString('base64')}`;

    const stored = await service.storeProfilePhoto('user-1', dataUrl);
    expect(stored).toMatch(/^data:image\/webp;base64,/);
    const metadata = await sharp(Buffer.from(stored!.split(',')[1]!, 'base64')).metadata();
    expect(metadata).toMatchObject({ format: 'webp', width: 512, height: 512 });
  });
});
