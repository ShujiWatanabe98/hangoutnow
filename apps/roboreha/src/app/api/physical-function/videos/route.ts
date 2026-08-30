import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { z } from "zod";
import { DEMO_STORE_ID } from "@/lib/constants";
import { query } from "@/lib/db";

export const runtime = "nodejs";

const databaseId = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const allowedTypes = new Set(["video/webm", "video/mp4", "video/quicktime", "video/x-m4v"]);

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const sessionId = databaseId.safeParse(form.get("sessionId"));
    const testCode = z.string().min(1).max(80).safeParse(form.get("testCode") || "gait");
    const phase = z.enum(["measurement", "baseline", "hal_assisted", "analysis"]).safeParse(form.get("phase") || "measurement");
    const consentConfirmed = form.get("consentConfirmed") === "true";
    const file = form.get("file");
    if (!sessionId.success || !testCode.success || !phase.success || !(file instanceof File)) {
      return NextResponse.json({ error: "動画情報を確認してください。" }, { status: 400 });
    }
    if (!consentConfirmed) return NextResponse.json({ error: "動画保存の同意確認が必要です。" }, { status: 400 });
    if (!allowedTypes.has(file.type)) return NextResponse.json({ error: "MP4、MOV、WebM形式の動画を選択してください。" }, { status: 400 });
    if (file.size <= 0 || file.size > 200 * 1024 * 1024) return NextResponse.json({ error: "動画は200MB以下にしてください。" }, { status: 400 });
    const session = await query(`SELECT id FROM physical_function_sessions WHERE id=$1 AND store_id=$2`, [sessionId.data, DEMO_STORE_ID]);
    if (!session.rows[0]) return NextResponse.json({ error: "身体機能記録が見つかりません。" }, { status: 404 });
    const extension = file.type === "video/webm" ? ".webm" : file.type === "video/quicktime" ? ".mov" : file.type === "video/x-m4v" ? ".m4v" : ".mp4";
    const storageKey = `${randomUUID()}${extension}`;
    const storageRoot = path.resolve(process.cwd(), "storage", "physical-function-videos");
    const target = path.resolve(storageRoot, storageKey);
    if (!target.startsWith(`${storageRoot}${path.sep}`)) throw new Error("保存先を確認できませんでした。");
    await mkdir(storageRoot, { recursive: true });
    await writeFile(target, Buffer.from(await file.arrayBuffer()));
    const numeric = (name: string) => {
      const value = Number(form.get(name));
      return Number.isFinite(value) && value > 0 ? value : null;
    };
    const saved = await query(
      `INSERT INTO physical_function_videos
        (session_id,test_code,phase,original_file_name,storage_key,mime_type,size_bytes,
         duration_seconds,width,height,fps,consent_confirmed)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true)
       RETURNING id,test_code,phase,mime_type,size_bytes,duration_seconds,width,height,fps,created_at`,
      [sessionId.data, testCode.data, phase.data, file.name || `recording${extension}`, storageKey,
        file.type, file.size, numeric("durationSeconds"), numeric("width"), numeric("height"), numeric("fps")],
    );
    return NextResponse.json({ video: { ...saved.rows[0], url: `/api/physical-function/videos/${saved.rows[0].id}` } }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "動画を保存できませんでした。" }, { status: 500 });
  }
}
