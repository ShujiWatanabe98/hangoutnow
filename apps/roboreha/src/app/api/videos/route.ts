import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";

export const runtime = "nodejs";

const databaseId = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const allowedTypes = new Set(["video/webm", "video/mp4", "video/quicktime", "video/x-m4v"]);

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const assessmentId = databaseId.safeParse(form.get("assessmentId"));
    const phase = z.enum(["before", "after", "analysis"]).safeParse(form.get("phase"));
    const file = form.get("file");
    if (!assessmentId.success || !phase.success || !(file instanceof File)) {
      return NextResponse.json({ error: "動画情報が正しくありません。" }, { status: 400 });
    }
    if (!allowedTypes.has(file.type)) return NextResponse.json({ error: "MP4、MOV、WebM形式の動画を選択してください。" }, { status: 400 });
    if (file.size <= 0 || file.size > 100 * 1024 * 1024) return NextResponse.json({ error: "動画は100MB以下にしてください。" }, { status: 400 });

    const extension = file.type === "video/webm" ? ".webm" : file.type === "video/quicktime" ? ".mov" : file.type === "video/x-m4v" ? ".m4v" : ".mp4";
    const storageKey = `${randomUUID()}${extension}`;
    const storageRoot = path.resolve(process.cwd(), "storage", "videos");
    const target = path.resolve(storageRoot, storageKey);
    if (!target.startsWith(`${storageRoot}${path.sep}`)) throw new Error("保存先を確認できませんでした。");
    await mkdir(storageRoot, { recursive: true });
    await writeFile(target, Buffer.from(await file.arrayBuffer()));
    const result = await query(
      `INSERT INTO assessment_videos
        (assessment_id, phase, original_file_name, storage_key, mime_type, size_bytes)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id, phase, mime_type, size_bytes, created_at`,
      [assessmentId.data, phase.data, file.name || `recording${extension}`, storageKey, file.type, file.size],
    );
    return NextResponse.json({ video: { ...result.rows[0], url: `/api/videos/${result.rows[0].id}` } }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "動画を保存できませんでした。" }, { status: 500 });
  }
}
