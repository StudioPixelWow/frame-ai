/**
 * Render Worker — Upload rendered output to Supabase Storage
 */
import fs from "fs";
import { getDb } from "./update-job";

const tag = "[Worker:Upload]";
const BUCKET = "project-files";

export interface UploadResult {
  storagePath: string;
  publicUrl: string;
  sizeBytes: number;
}

export async function uploadOutput(
  outputPath: string,
  projectId: string,
  sourceVideoUrl: string,
): Promise<UploadResult> {
  if (!fs.existsSync(outputPath)) {
    throw new Error(`Output file not found: ${outputPath}`);
  }

  const stats = fs.statSync(outputPath);
  if (stats.size < 1024) {
    throw new Error(`Output file too small: ${stats.size} bytes — render likely failed`);
  }

  const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
  const storagePath = `outputs/${projectId}_${Date.now()}.mp4`;

  console.log(`${tag} Uploading: ${sizeMB} MB → bucket=${BUCKET} path=${storagePath}`);

  const fileBuffer = fs.readFileSync(outputPath);
  const sb = getDb();

  const { error } = await sb.storage
    .from(BUCKET)
    .upload(storagePath, fileBuffer, { contentType: "video/mp4", upsert: true });

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  const { data: urlData } = sb.storage.from(BUCKET).getPublicUrl(storagePath);
  const publicUrl = urlData?.publicUrl || "";

  if (!publicUrl) {
    throw new Error("getPublicUrl returned empty after upload");
  }

  // Validate output differs from source
  if (publicUrl === sourceVideoUrl) {
    throw new Error("CRITICAL: Output URL equals source URL — render produced no new file");
  }

  console.log(`${tag} ✅ Uploaded: ${publicUrl}`);
  console.log(`${tag}   size: ${sizeMB} MB`);
  console.log(`${tag}   storage: ${storagePath}`);

  return { storagePath, publicUrl, sizeBytes: stats.size };
}
