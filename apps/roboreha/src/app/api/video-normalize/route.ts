import { NextResponse } from "next/server";
import {
  isSupportedVideoUpload,
  normalizeVideoToMp4,
} from "@/lib/video-mp4";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || !isSupportedVideoUpload(file)) {
      return NextResponse.json(
        { error: "MP4、MOV、M4V、WebM形式の動画を選択してください。" },
        { status: 400 },
      );
    }
    if (file.size <= 0 || file.size > 200 * 1024 * 1024) {
      return NextResponse.json(
        { error: "動画は200MB以下にしてください。" },
        { status: 400 },
      );
    }
    const normalized = await normalizeVideoToMp4(file);
    return new Response(normalized.content, {
      status: 200,
      headers: {
        "Content-Type": normalized.mimeType,
        "Content-Length": String(normalized.content.length),
        "Content-Disposition": `inline; filename="${encodeURIComponent(normalized.fileName)}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error
          ? error.message
          : "動画をブラウザ再生用MP4へ変換できませんでした。",
      },
      { status: 500 },
    );
  }
}
