import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import type { GetObjectCommandOutput } from "@aws-sdk/client-s3";
import { mkdir, open, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

export type VideoStorageScope = "videos" | "physical-function-videos";

type StorageConfig =
  | { mode: "local"; root: string }
  | { mode: "s3"; bucket: string; prefix: string; client: S3Client };

export type StoredVideo = {
  content: Buffer;
  status: 200 | 206;
  contentLength: number;
  totalSize: number;
  contentRange?: string;
};

export class VideoNotFoundError extends Error {}

export class VideoRangeError extends Error {
  public readonly totalSize: number;

  constructor(totalSize: number) {
    super("Requested video range is not satisfiable");
    this.totalSize = totalSize;
  }
}

const safeStorageKey = /^[A-Za-z0-9][A-Za-z0-9._-]{0,254}$/;

function requestedMode() {
  const configured = process.env.ROBOREHA_VIDEO_STORAGE_MODE?.trim().toLowerCase();
  if (configured === "local" || configured === "s3") return configured;
  return process.env.NODE_ENV === "production" ? "s3" : "local";
}

function s3Config(): StorageConfig | null {
  const region = process.env.ROBOREHA_S3_REGION?.trim();
  const bucket = process.env.ROBOREHA_S3_BUCKET?.trim();
  const accessKeyId = process.env.ROBOREHA_S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.ROBOREHA_S3_SECRET_ACCESS_KEY?.trim();
  if (!region || !bucket || !accessKeyId || !secretAccessKey) return null;
  const endpoint = process.env.ROBOREHA_S3_ENDPOINT?.trim();
  const rawPrefix = process.env.ROBOREHA_S3_PREFIX?.trim() || "roboreha-videos";
  const prefix = rawPrefix.replace(/^\/+|\/+$/g, "");
  if (!prefix || prefix.includes("..")) return null;
  return {
    mode: "s3",
    bucket,
    prefix,
    client: new S3Client({
      region,
      ...(endpoint ? { endpoint } : {}),
      forcePathStyle: process.env.ROBOREHA_S3_FORCE_PATH_STYLE === "true",
      credentials: { accessKeyId, secretAccessKey },
    }),
  };
}

function storageConfig(): StorageConfig {
  if (requestedMode() === "s3") {
    const config = s3Config();
    if (!config) throw new Error("RoboReha動画ストレージが設定されていません。");
    return config;
  }
  const configuredRoot = process.env.ROBOREHA_LOCAL_VIDEO_ROOT?.trim();
  return {
    mode: "local",
    root: path.resolve(/* turbopackIgnore: true */ configuredRoot || path.join(process.cwd(), "storage")),
  };
}

function assertStorageKey(storageKey: string) {
  if (!safeStorageKey.test(storageKey)) throw new Error("動画保存キーが正しくありません。");
}

function localTarget(config: Extract<StorageConfig, { mode: "local" }>, scope: VideoStorageScope, storageKey: string) {
  const scopeRoot = path.resolve(config.root, scope);
  const target = path.resolve(scopeRoot, storageKey);
  if (!target.startsWith(`${scopeRoot}${path.sep}`)) throw new Error("動画保存先が正しくありません。");
  return { scopeRoot, target };
}

function objectKey(config: Extract<StorageConfig, { mode: "s3" }>, scope: VideoStorageScope, storageKey: string) {
  return `${config.prefix}/${scope}/${storageKey}`;
}

function byteRange(rangeHeader: string | null, totalSize: number) {
  if (!rangeHeader) return { start: 0, end: totalSize - 1, status: 200 as const };
  const match = /^bytes=(\d+)-(\d*)$/.exec(rangeHeader.trim());
  if (!match) throw new VideoRangeError(totalSize);
  const start = Number(match[1]);
  const requestedEnd = match[2] ? Number(match[2]) : totalSize - 1;
  const end = Math.min(requestedEnd, totalSize - 1);
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start > end || start >= totalSize) {
    throw new VideoRangeError(totalSize);
  }
  return { start, end, status: 206 as const };
}

function isNotFound(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  return candidate.name === "NotFound" || candidate.name === "NoSuchKey" || candidate.$metadata?.httpStatusCode === 404;
}

async function objectBodyToBuffer(body: NonNullable<GetObjectCommandOutput["Body"]>) {
  if (body instanceof Readable) {
    const chunks: Buffer[] = [];
    for await (const chunk of body) {
      if (typeof chunk === "string") chunks.push(Buffer.from(chunk));
      else chunks.push(Buffer.from(chunk as Uint8Array));
    }
    return Buffer.concat(chunks);
  }
  if (body instanceof Blob) return Buffer.from(await body.arrayBuffer());

  const chunks: Buffer[] = [];
  const reader = body.getReader();
  while (true) {
    const result = await reader.read();
    if (result.done) break;
    chunks.push(Buffer.from(result.value as Uint8Array));
  }
  return Buffer.concat(chunks);
}

export function videoStorageStatus() {
  const mode = requestedMode();
  const ready = mode === "local" || s3Config() !== null;
  return { mode, ready, durable: mode === "s3" && ready } as const;
}

export async function storeVideo(scope: VideoStorageScope, storageKey: string, content: Buffer, contentType: string) {
  assertStorageKey(storageKey);
  const config = storageConfig();
  if (config.mode === "local") {
    const { scopeRoot, target } = localTarget(config, scope, storageKey);
    await mkdir(scopeRoot, { recursive: true });
    await writeFile(target, content);
    return;
  }
  await config.client.send(new PutObjectCommand({
    Bucket: config.bucket,
    Key: objectKey(config, scope, storageKey),
    Body: content,
    ContentType: contentType,
    CacheControl: "private,max-age=3600",
  }));
}

export async function deleteVideo(scope: VideoStorageScope, storageKey: string) {
  assertStorageKey(storageKey);
  const config = storageConfig();
  if (config.mode === "local") {
    const { target } = localTarget(config, scope, storageKey);
    await unlink(target).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    });
    return;
  }
  await config.client.send(new DeleteObjectCommand({
    Bucket: config.bucket,
    Key: objectKey(config, scope, storageKey),
  }));
}

export async function readVideo(scope: VideoStorageScope, storageKey: string, rangeHeader: string | null): Promise<StoredVideo> {
  assertStorageKey(storageKey);
  const config = storageConfig();
  if (config.mode === "local") {
    const { target } = localTarget(config, scope, storageKey);
    let fileStat;
    try {
      fileStat = await stat(/* turbopackIgnore: true */ target);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new VideoNotFoundError();
      throw error;
    }
    const range = byteRange(rangeHeader, fileStat.size);
    const handle = await open(/* turbopackIgnore: true */ target, "r");
    try {
      const content = Buffer.alloc(range.end - range.start + 1);
      await handle.read(content, 0, content.length, range.start);
      return {
        content,
        status: range.status,
        contentLength: content.length,
        totalSize: fileStat.size,
        ...(range.status === 206 ? { contentRange: `bytes ${range.start}-${range.end}/${fileStat.size}` } : {}),
      };
    } finally {
      await handle.close();
    }
  }

  const key = objectKey(config, scope, storageKey);
  let totalSize: number;
  try {
    const metadata = await config.client.send(new HeadObjectCommand({ Bucket: config.bucket, Key: key }));
    totalSize = Number(metadata.ContentLength ?? 0);
  } catch (error) {
    if (isNotFound(error)) throw new VideoNotFoundError();
    throw error;
  }
  if (!Number.isSafeInteger(totalSize) || totalSize <= 0) throw new VideoNotFoundError();
  const range = byteRange(rangeHeader, totalSize);
  try {
    const result = await config.client.send(new GetObjectCommand({
      Bucket: config.bucket,
      Key: key,
      ...(range.status === 206 ? { Range: `bytes=${range.start}-${range.end}` } : {}),
    }));
    if (!result.Body) throw new VideoNotFoundError();
    const content = await objectBodyToBuffer(result.Body);
    return {
      content,
      status: range.status,
      contentLength: content.length,
      totalSize,
      ...(range.status === 206 ? { contentRange: `bytes ${range.start}-${range.end}/${totalSize}` } : {}),
    };
  } catch (error) {
    if (isNotFound(error)) throw new VideoNotFoundError();
    throw error;
  }
}
