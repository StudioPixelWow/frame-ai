/**
 * FrameAI — B-roll suggestion persistence.
 *
 * Storage: <cwd>/.frameai/broll/<projectId>.json
 * Override base dir via FRAMEAI_STORAGE_DIR env var.
 */

import fs   from "fs";
import path from "path";
import { FRAMEAI_DIR } from "@/lib/db/paths";
import type { BrollResult, StoredBrollResult } from "./types";

function getStorageDir(): string {
  const base =
    process.env.FRAMEAI_STORAGE_DIR ?? FRAMEAI_DIR;
  return path.join(base, "broll");
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

export function storeBroll(
  projectId: string,
  result: BrollResult
): StoredBrollResult {
  const dir = getStorageDir();
  ensureDir(dir);
  const stored: StoredBrollResult = { projectId, ...result };
  fs.writeFileSync(filePath(projectId), JSON.stringify(stored, null, 2), "utf-8");
  return stored;
}

export function getBroll(projectId: string): StoredBrollResult | null {
  const fp = filePath(projectId);
  if (!fs.existsSync(fp)) return null;
  try {
    return JSON.parse(fs.readFileSync(fp, "utf-8")) as StoredBrollResult;
  } catch {
    return null;
  }
}

export function deleteBroll(projectId: string): boolean {
  const fp = filePath(projectId);
  if (!fs.existsSync(fp)) return false;
  fs.unlinkSync(fp);
  return true;
}

export function listBrollProjects(): string[] {
  const dir = getStorageDir();
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter(f => f.endsWith(".json"))
    .map(f => f.replace(/\.json$/, ""));
}
