import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import ffmpegStatic from "ffmpeg-static";

const supportedMimeTypes = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-m4v",
  "application/octet-stream",
  "",
]);
const supportedExtensions = new Set([".mp4", ".mov", ".m4v", ".webm"]);

export function isSupportedVideoUpload(file: File) {
  const extension = path.extname(file.name || "").toLowerCase();
  const mimeType = file.type.toLowerCase().split(";", 1)[0].trim();
  return (
    supportedMimeTypes.has(mimeType) &&
    (mimeType.startsWith("video/") || supportedExtensions.has(extension))
  );
}

function runFfmpeg(inputPath: string, outputPath: string) {
  const executable = process.env.FFMPEG_BIN || ffmpegStatic;
  if (!executable)
    throw new Error("MP4変換エンジンを利用できません。");
  return new Promise<void>((resolve, reject) => {
    const child = spawn(
      executable,
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        inputPath,
        "-map",
        "0:v:0",
        "-map",
        "0:a?",
        "-vf",
        "scale=trunc(iw/2)*2:trunc(ih/2)*2",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "23",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        "-movflags",
        "+faststart",
        outputPath,
      ],
      { windowsHide: true },
    );
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error("MP4変換がタイムアウトしました。動画を短くしてください。"));
    }, 5 * 60 * 1000);
    child.stderr.on("data", (chunk: Buffer) => {
      stderr = `${stderr}${chunk.toString("utf8")}`.slice(-4000);
    });
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(new Error(`MP4変換を開始できませんでした。${error.message}`));
    });
    child.once("close", (code) => {
      clearTimeout(timeout);
      if (code === 0) resolve();
      else
        reject(
          new Error(
            `動画をMP4へ変換できませんでした。${stderr.trim() || `終了コード ${code}`}`,
          ),
        );
    });
  });
}

export async function normalizeVideoToMp4(file: File) {
  const conversionRoot = path.resolve(tmpdir(), "roboreha-video-conversion");
  await mkdir(conversionRoot, { recursive: true });
  const sourceExtension = supportedExtensions.has(
    path.extname(file.name || "").toLowerCase(),
  )
    ? path.extname(file.name).toLowerCase()
    : ".video";
  const conversionId = randomUUID();
  const inputPath = path.resolve(
    conversionRoot,
    `${conversionId}-input${sourceExtension}`,
  );
  const outputPath = path.resolve(conversionRoot, `${conversionId}-output.mp4`);
  if (
    !inputPath.startsWith(`${conversionRoot}${path.sep}`) ||
    !outputPath.startsWith(`${conversionRoot}${path.sep}`)
  )
    throw new Error("動画変換用の一時保存先を確認できませんでした。");
  try {
    await writeFile(inputPath, Buffer.from(await file.arrayBuffer()));
    await runFfmpeg(inputPath, outputPath);
    const content = await readFile(outputPath);
    if (!content.length) throw new Error("MP4変換後の動画が空です。");
    const originalBaseName = path.basename(
      file.name || "recording",
      path.extname(file.name || ""),
    );
    return {
      content,
      fileName: `${originalBaseName || "recording"}.mp4`,
      mimeType: "video/mp4" as const,
    };
  } finally {
    await Promise.all([
      rm(inputPath, { force: true }),
      rm(outputPath, { force: true }),
    ]);
  }
}
