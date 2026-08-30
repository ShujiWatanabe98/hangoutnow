import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    const result = await query<{ now: string }>("SELECT now()::text AS now");
    return NextResponse.json({ ok: true, database: "connected", at: result.rows[0].now });
  } catch (error) {
    return NextResponse.json(
      { ok: false, database: "unavailable", message: error instanceof Error ? error.message : "unknown error" },
      { status: 503 },
    );
  }
}
