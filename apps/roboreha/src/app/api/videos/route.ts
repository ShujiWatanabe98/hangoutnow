import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import {
  isSupportedVideoUpload,
  normalizeVideoToMp4,
} from "@/lib/video-mp4";
import { deleteVideo, storeVideo } from "@/lib/video-storage";

export const runtime = "nodejs";

const databaseId = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const assessmentId = databaseId.safeParse(form.get("assessmentId"));
    const phase = z.enum(["before", "after", "analysis"]).safeParse(form.get("phase"));
    const file = form.get("file");
    if (!assessmentId.success || !phase.success || !(file instanceof File)) {
      return NextResponse.json({ error: "動画情報が正しくありません。" }, { status: 400 });
    }
    if (!isSupportedVideoUpload(file)) return NextResponse.json({ error: "動画ファイルを選択してください。保存時にMP4へ変換します。" }, { status: 400 });
    if (file.size <= 0 || file.size > 100 * 1024 * 1024) return NextResponse.json({ error: "動画は100MB以下にしてください。" }, { status: 400 });

    const normalized = await normalizeVideoToMp4(file);
    const storageKey = `${randomUUID()}.mp4`;
    await storeVideo("videos", storageKey, normalized.content, normalized.mimeType);
    try {
      const result = await query(
        `INSERT INTO assessment_videos
          (assessment_id, phase, original_file_name, storage_key, mime_type, size_bytes)
         VALUES ($1,$2,$3,$4,$5,$6)
         RETURNING id, phase, mime_type, size_bytes, created_at`,
        [assessmentId.data, phase.data, normalized.fileName, storageKey, normalized.mimeType, normalized.content.length],
      );
      return NextResponse.json({ video: { ...result.rows[0], url: `/api/videos/${result.rows[0].id}` } }, { status: 201 });
    } catch (error) {
      await deleteVideo("videos", storageKey).catch(() => undefined);
      throw error;
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "動画を保存できませんでした。" }, { status: 500 });
  }
}
