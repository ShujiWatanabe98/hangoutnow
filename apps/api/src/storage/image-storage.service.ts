import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { v7 as uuidv7 } from 'uuid';
import { optimizeDataImage, PROFILE_IMAGE_SPEC } from './image-optimization';

@Injectable()
export class ImageStorageService {
  private config() {
    const endpoint = process.env.S3_ENDPOINT;
    const region = process.env.S3_REGION;
    const bucket = process.env.S3_BUCKET;
    const accessKeyId = process.env.S3_ACCESS_KEY_ID;
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
    const publicBase = process.env.S3_PUBLIC_BASE_URL;
    if (!endpoint || !region || !bucket || !accessKeyId || !secretAccessKey || !publicBase) return null;
    return {
      bucket,
      publicBase,
      client: new S3Client({ endpoint, region, forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true', credentials: { accessKeyId, secretAccessKey } }),
    };
  }

  async storeProfilePhoto(userId: string, dataUrl: string | null | undefined): Promise<string | null | undefined> {
    if (dataUrl === undefined || dataUrl === null || !dataUrl.startsWith('data:')) return dataUrl;
    const optimized = await optimizeDataImage(dataUrl, PROFILE_IMAGE_SPEC);
    const config = this.config();
    if (!config) {
      if (process.env.NODE_ENV === 'production' && process.env.DEMO_MODE !== 'true') throw new ServiceUnavailableException('画像を現在保存できません');
      return optimized.dataUrl;
    }
    const key = `profiles/${userId}/${uuidv7()}.${optimized.extension}`;
    await config.client.send(new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: optimized.body,
      ContentType: optimized.contentType,
      CacheControl: 'public,max-age=31536000,immutable',
    }));
    return `${config.publicBase.replace(/\/$/, '')}/${key}`;
  }

  async deleteProfilePhoto(userId: string, url: string | null): Promise<void> {
    if (!url || url.startsWith('data:')) return;
    const config = this.config();
    if (!config) return;
    const prefix = `${config.publicBase.replace(/\/$/, '')}/profiles/${userId}/`;
    if (!url.startsWith(prefix)) return;
    const key = decodeURIComponent(url.slice(config.publicBase.replace(/\/$/, '').length + 1));
    await config.client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }));
  }
}
