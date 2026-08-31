import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { videoStorageStatus } from "@/lib/video-storage";

export const runtime = "nodejs";

export async function GET() {
  try {
    const result = await query<{ now: string }>("SELECT now()::text AS now");
    const storage = videoStorageStatus();
    return NextResponse.json(
      { ok: storage.ready, database: "connected", videoStorage: storage, at: result.rows[0].now },
      { status: storage.ready ? 200 : 503 },
    );
  } catch (error) {
    return NextResponse.json(
      { ok: false, database: "unavailable", message: error instanceof Error ? error.message : "unknown error" },
      { status: 503 },
    );
  }
}
