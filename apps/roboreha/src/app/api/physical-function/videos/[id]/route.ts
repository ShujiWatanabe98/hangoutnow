import { NextResponse } from "next/server";
import { z } from "zod";
import { DEMO_STORE_ID } from "@/lib/constants";
import { query } from "@/lib/db";
import {
  readVideo,
  VideoNotFoundError,
  VideoRangeError,
} from "@/lib/video-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const databaseId = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!databaseId.safeParse(id).success) {
    return NextResponse.json({ error: "動画IDが正しくありません。" }, { status: 400 });
  }

  const result = await query<{ storage_key: string; mime_type: string }>(
    `SELECT v.storage_key,v.mime_type FROM physical_function_videos v
      JOIN physical_function_sessions s ON s.id=v.session_id WHERE v.id=$1 AND s.store_id=$2`,
    [id, DEMO_STORE_ID],
  );
  if (!result.rows[0]) {
    return NextResponse.json({ error: "動画が見つかりません。" }, { status: 404 });
  }

  try {
    const video = await readVideo(
      "physical-function-videos",
      result.rows[0].storage_key,
      request.headers.get("range"),
    );
    return new Response(Uint8Array.from(video.content), {
      status: video.status,
      headers: {
        "Content-Type": result.rows[0].mime_type,
        "Content-Length": String(video.contentLength),
        ...(video.contentRange ? { "Content-Range": video.contentRange } : {}),
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    if (error instanceof VideoRangeError) {
      return new Response(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${error.totalSize}` },
      });
    }
    if (!(error instanceof VideoNotFoundError)) throw error;
    return NextResponse.json({ error: "動画ファイルを読み込めませんでした。" }, { status: 404 });
  }
}
