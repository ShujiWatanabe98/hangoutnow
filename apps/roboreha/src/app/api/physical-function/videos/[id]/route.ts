import { open, stat } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { z } from "zod";
import { DEMO_STORE_ID } from "@/lib/constants";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const databaseId = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!databaseId.safeParse(id).success) return NextResponse.json({ error: "動画IDが正しくありません。" }, { status: 400 });
  const result = await query<{ storage_key: string; mime_type: string }>(
    `SELECT v.storage_key,v.mime_type FROM physical_function_videos v
      JOIN physical_function_sessions s ON s.id=v.session_id WHERE v.id=$1 AND s.store_id=$2`, [id, DEMO_STORE_ID],
  );
  if (!result.rows[0]) return NextResponse.json({ error: "動画が見つかりません。" }, { status: 404 });
  const storageRoot = path.resolve(process.cwd(), "storage", "physical-function-videos");
  const target = path.resolve(storageRoot, result.rows[0].storage_key);
  if (!target.startsWith(`${storageRoot}${path.sep}`)) return NextResponse.json({ error: "動画パスが正しくありません。" }, { status: 400 });
  try {
    const fileStat = await stat(target);
    const range = request.headers.get("range");
    if (range) {
      const match = /bytes=(\d+)-(\d*)/.exec(range);
      if (!match) return new Response(null, { status: 416 });
      const start = Number(match[1]);
      const end = match[2] ? Math.min(Number(match[2]), fileStat.size - 1) : fileStat.size - 1;
      if (start > end || start >= fileStat.size) return new Response(null, { status: 416 });
      const handle = await open(target, "r");
      const buffer = Buffer.alloc(end - start + 1);
      await handle.read(buffer, 0, buffer.length, start);
      await handle.close();
      return new Response(buffer, { status: 206, headers: { "Content-Type": result.rows[0].mime_type, "Content-Length": String(buffer.length), "Content-Range": `bytes ${start}-${end}/${fileStat.size}`, "Accept-Ranges": "bytes", "Cache-Control": "private, max-age=3600" } });
    }
    const handle = await open(target, "r");
    const buffer = await handle.readFile();
    await handle.close();
    return new Response(buffer, { headers: { "Content-Type": result.rows[0].mime_type, "Content-Length": String(fileStat.size), "Accept-Ranges": "bytes", "Cache-Control": "private, max-age=3600" } });
  } catch {
    return NextResponse.json({ error: "動画ファイルを読み込めませんでした。" }, { status: 404 });
  }
}
