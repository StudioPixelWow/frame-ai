/**
 * FrameAI — Highlight result persistence.
 *
 * Mirrors the pattern from transcript/storage.ts but for highlight results.
 * Storage location: <cwd>/.frameai/highlights/<projectId>.json
 * Override via FRAMEAI_STORAGE_DIR env var (uses same base dir as analyses).
 */

import fs   from "fs";
import path from "path";
import { FRAMEAI_DIR } from "@/lib/db/paths";
import type { HighlightResult, StoredHighlightResult } from "./types";

// ─── Storage dir ─────────────────────────────────────────────────────────────

function getStorageDir(): string {
  const base =
    process.env.FRAMEAI_STORAGE_DIR ?? FRAMEAI_DIR;
  return path.join(base, "highlights");
}

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

/** Sanitise projectId to prevent path traversal. */
function safeFilename(projectId: string): string {
  return projectId.replace(/[^a-zA-Z0-9_\-]/g, "_").slice(0, 200);
}

function filePath(projectId: string): string {
  return path.join(getStorageDir(), `${safeFilename(projectId)}.json`);
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export function storeHighlights(
  projectId: string,
  result: HighlightResult
): StoredHighlightResult {
  const dir = getStorageDir();
  ensureDir(dir);

  const stored: StoredHighlightResult = { projectId, ...result };
  fs.writeFileSync(filePath(projectId), JSON.stringify(stored, null, 2), "utf-8");
  return stored;
}

export function getHighlights(projectId: string): StoredHighlightResult | null {
  const fp = filePath(projectId);
  if (!fs.existsSync(fp)) return null;

  try {
    const raw = fs.readFileSync(fp, "utf-8");
    return JSON.parse(raw) as StoredHighlightResult;
  } catch {
    return null;
  }
}

export function deleteHighlights(projectId: string): boolean {
  const fp = filePath(projectId);
  if (!fs.existsSync(fp)) return false;
  fs.unlinkSync(fp);
  return true;
}

export function listHighlightProjects(): string[] {
  const dir = getStorageDir();
  if (!fs.existsSync(dir)) return [];

  return fs
    .readdirSync(dir)
    .filter(f => f.endsWith(".json"))
    .map(f => f.replace(/\.json$/, ""));
}
