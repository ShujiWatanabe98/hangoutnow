import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "テスト動画は開発環境でのみ利用できます。" }, { status: 404 });
  }
  try {
    const workspaceRoot = path.resolve(process.cwd());
    const target = path.resolve(workspaceRoot, "test-data", "videos", "fg001-patient-helper-walking.mp4");
    if (!target.startsWith(`${workspaceRoot}${path.sep}`)) throw new Error("テスト動画の場所を確認できませんでした。");
    const [content, metadata] = await Promise.all([readFile(target), stat(target)]);
    return new NextResponse(content, {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": String(metadata.size),
        "Content-Disposition": "inline; filename=fg001-patient-helper-walking.mp4",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "テスト動画を読み込めませんでした。" }, { status: 404 });
  }
}
