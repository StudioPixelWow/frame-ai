/**
 * POST /api/upload
 *
 * Accepts a file upload (FormData with "file" field) and streams it to
 * a temporary location in public/uploads/. Returns the local URL.
 *
 * Streams to disk in chunks to avoid buffering entire video files in memory.
 * Supports files up to 500 MB.
 *
 * Also probes the file for audio streams (if ffprobe is available)
 * so the client can warn the user before attempting transcription
 * on a video-only file.
 */
import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import { createWriteStream } from "fs";
import path from "path";
import { randomUUID } from "crypto";

// ── Force Node.js runtime (not Edge) for filesystem access + large uploads ──
export const runtime = "nodejs";

// ── Disable Next.js built-in body size limit for this route ──
// This is the App Router equivalent of Pages Router's `config.api.bodyParser.sizeLimit`
export const maxDuration = 120; // allow up to 2 min for large uploads

const UPLOAD_DIR = path.join(process.cwd(), "public/uploads");
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500 MB

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

/**
 * Stream a Web API ReadableStream (from File/Blob) to a local file on disk.
 * Returns the number of bytes written.
 */
async function streamToDisk(file: File, destPath: string): Promise<number> {
  const webStream = file.stream();
  const reader = webStream.getReader();
  const writeStream = createWriteStream(destPath);
  let bytesWritten = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytesWritten += value.byteLength;
      if (bytesWritten > MAX_FILE_SIZE) {
        writeStream.destroy();
        // Clean up partial file
        try { fs.unlinkSync(destPath); } catch {}
        throw new Error(`File exceeds maximum size of ${MAX_FILE_SIZE / 1024 / 1024}MB`);
      }
      // Write chunk — backpressure-aware
      const ok = writeStream.write(Buffer.from(value));
      if (!ok) {
        await new Promise<void>((resolve) => writeStream.once("drain", resolve));
      }
    }
    // Close the write stream
    await new Promise<void>((resolve, reject) => {
      writeStream.end(() => resolve());
      writeStream.on("error", reject);
    });
    return bytesWritten;
  } catch (err) {
    writeStream.destroy();
    try { fs.unlinkSync(destPath); } catch {}
    throw err;
  }
}

export async function POST(req: NextRequest) {
  const t0 = Date.now();

  try {
    // ── Check Content-Length early ──
    const contentLength = parseInt(req.headers.get("content-length") || "0", 10);
    if (contentLength > MAX_FILE_SIZE) {
      console.error(`[upload] REJECTED: Content-Length ${(contentLength / 1048576).toFixed(1)}MB exceeds ${MAX_FILE_SIZE / 1048576}MB limit`);
      return NextResponse.json(
        { error: `File too large (${(contentLength / 1048576).toFixed(0)}MB). Maximum is ${MAX_FILE_SIZE / 1048576}MB.` },
        { status: 413 }
      );
    }

    console.log(`[upload] Started — Content-Length: ${contentLength ? (contentLength / 1048576).toFixed(1) + "MB" : "unknown"}`);

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      console.error("[upload] No file field in FormData");
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const fileSizeMB = (file.size / 1048576).toFixed(1);
    console.log(`[upload] File received: name=${file.name} size=${fileSizeMB}MB type=${file.type}`);

    // Validate size from File object too
    if (file.size > MAX_FILE_SIZE) {
      console.error(`[upload] REJECTED: File size ${fileSizeMB}MB exceeds limit`);
      return NextResponse.json(
        { error: `File too large (${fileSizeMB}MB). Maximum is ${MAX_FILE_SIZE / 1048576}MB.` },
        { status: 413 }
      );
    }

    // Generate unique filename
    const ext = path.extname(file.name) || ".mp4";
    const filename = `upload-${randomUUID()}${ext}`;
    const filePath = path.join(UPLOAD_DIR, filename);

    // Stream file to disk (avoids loading entire file into memory)
    console.log(`[upload] Streaming to disk: ${filePath}`);
    const bytesWritten = await streamToDisk(file, filePath);

    // Return the public URL
    const publicUrl = `/uploads/${filename}`;

    // Probe media streams (non-fatal if ffprobe unavailable)
    const probe = probeMediaFile(filePath);

    const latencyMs = Date.now() - t0;
    console.log(
      `[upload] SUCCESS: ${filename} (${bytesWritten} bytes, ${fileSizeMB}MB, type=${file.type}, ${latencyMs}ms)` +
      (probe ? ` | probe: hasAudio=${probe.hasAudio}, hasVideo=${probe.hasVideo}, duration=${probe.durationSec}s, format=${probe.format}` : " | probe: unavailable")
    );

    return NextResponse.json({
      url: publicUrl,
      filename,
      size: bytesWritten,
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
    const latencyMs = Date.now() - t0;
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[upload] FAILED (${latencyMs}ms): ${errMsg}`);
    return NextResponse.json(
      { error: "Upload failed", details: errMsg },
      { status: 500 }
    );
  }
}
