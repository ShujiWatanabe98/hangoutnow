import { ServiceUnavailableException } from '@nestjs/common';
import { afterEach, describe, expect, it } from 'vitest';
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

    await expect(service.storeProfilePhoto('user-1', 'data:image/png;base64,iVBORw0KGgo=')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('allows a data URL only as a local-development fallback', async () => {
    process.env.NODE_ENV = 'development';
    for (const key of storageKeys) delete process.env[key];
    const service = new ImageStorageService();
    const dataUrl = 'data:image/png;base64,iVBORw0KGgo=';

    await expect(service.storeProfilePhoto('user-1', dataUrl)).resolves.toBe(dataUrl);
  });
});
