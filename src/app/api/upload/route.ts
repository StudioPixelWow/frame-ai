/**
 * POST /api/upload
 *
 * Accepts a file upload (FormData with "file" field) and saves it to
 * a temporary location in public/uploads/. Returns the local URL.
 *
 * Also probes the file for audio streams (if ffprobe is available)
 * so the client can warn the user before attempting transcription
 * on a video-only file.
 */
import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

const UPLOAD_DIR = path.join(process.cwd(), "public/uploads");

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

/**
 * Probe a media file to check if it contains audio/video streams.
 */
function probeMediaFile(filePath: string): { hasAudio: boolean; hasVideo: boolean; durationSec: number; format: string } | null {
  try {
    const { execSync } = require("child_process");
    const result = execSync(
      `ffprobe -v quiet -print_format json -show_streams -show_format "${filePath}"`,
      { stdio: ["pipe", "pipe", "pipe"], timeout: 15000 }
    ).toString();
    const parsed = JSON.parse(result);
    const streams = parsed.streams || [];
    const audioStreams = streams.filter((s: any) => s.codec_type === "audio");
    const videoStreams = streams.filter((s: any) => s.codec_type === "video");
    const format = parsed.format?.format_name || "unknown";
    const durationSec = parseFloat(parsed.format?.duration || "0");
    return {
      hasAudio: audioStreams.length > 0,
      hasVideo: videoStreams.length > 0,
      durationSec,
      format,
    };
  } catch {
    // ffprobe not available or failed — return null (non-fatal)
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Generate unique filename
    const ext = path.extname(file.name) || ".mp4";
    const filename = `upload-${randomUUID()}${ext}`;
    const filePath = path.join(UPLOAD_DIR, filename);

    // Write file to disk
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(filePath, buffer);

    // Return the public URL
    const publicUrl = `/uploads/${filename}`;

    // Probe media streams (non-fatal if ffprobe unavailable)
    const probe = probeMediaFile(filePath);

    console.log(
      `[upload] Saved: ${filename} (${buffer.length} bytes, type=${file.type})` +
      (probe ? ` | probe: hasAudio=${probe.hasAudio}, hasVideo=${probe.hasVideo}, duration=${probe.durationSec}s, format=${probe.format}` : " | probe: unavailable")
    );

    return NextResponse.json({
      url: publicUrl,
      filename,
      size: buffer.length,
      type: file.type,
      // Media probe results (may be null if ffprobe not available)
      probe: probe ? {
        hasAudio: probe.hasAudio,
        hasVideo: probe.hasVideo,
        durationSec: probe.durationSec,
        format: probe.format,
      } : null,
    });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json(
      { error: "Upload failed", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
