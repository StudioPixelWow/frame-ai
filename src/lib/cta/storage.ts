/**
 * FrameAI — CTA result persistence.
 *
 * Storage: <cwd>/.frameai/ctas/<projectId>.json
 * Override base dir via FRAMEAI_STORAGE_DIR env var.
 */

import fs   from "fs";
import path from "path";
import type { CtaResult, StoredCtaResult } from "./types";

function getStorageDir(): string {
  const base =
    process.env.FRAMEAI_STORAGE_DIR ??
    path.join(process.cwd(), ".frameai");
  return path.join(base, "ctas");
}

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

function safeFilename(projectId: string): string {
  return projectId.replace(/[^a-zA-Z0-9_\-]/g, "_").slice(0, 200);
}

function filePath(projectId: string): string {
  return path.join(getStorageDir(), `${safeFilename(projectId)}.json`);
}

export function storeCtas(
  projectId: string,
  result: CtaResult
): StoredCtaResult {
  const dir = getStorageDir();
  ensureDir(dir);
  const stored: StoredCtaResult = { projectId, ...result };
  fs.writeFileSync(filePath(projectId), JSON.stringify(stored, null, 2), "utf-8");
  return stored;
}

export function getCtas(projectId: string): StoredCtaResult | null {
  const fp = filePath(projectId);
  if (!fs.existsSync(fp)) return null;
  try {
    return JSON.parse(fs.readFileSync(fp, "utf-8")) as StoredCtaResult;
  } catch {
    return null;
  }
}

export function deleteCtas(projectId: string): boolean {
  const fp = filePath(projectId);
  if (!fs.existsSync(fp)) return false;
  fs.unlinkSync(fp);
  return true;
}

export function listCtaProjects(): string[] {
  const dir = getStorageDir();
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter(f => f.endsWith(".json"))
    .map(f => f.replace(/\.json$/, ""));
}
