/**
 * FrameAI — Variation result persistence.
 *
 * Storage: <cwd>/.frameai/variations/<projectId>.json
 * Override base dir via FRAMEAI_STORAGE_DIR env var.
 */

import fs   from "fs";
import path from "path";
import type { VariationResult, StoredVariationResult } from "./types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getStorageDir(): string {
  const base =
    process.env.FRAMEAI_STORAGE_DIR ??
    path.join(process.cwd(), ".frameai");
  return path.join(base, "variations");
}

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

/** Sanitise projectId for use as a filename. Prevents path traversal. */
function safeFilename(projectId: string): string {
  return projectId.replace(/[^a-zA-Z0-9_\-]/g, "_").slice(0, 200);
}

function filePath(projectId: string): string {
  return path.join(getStorageDir(), `${safeFilename(projectId)}.json`);
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

/**
 * Persist a VariationResult to disk, returning the stored form.
 */
export function storeVariations(
  projectId: string,
  result:    VariationResult
): StoredVariationResult {
  const dir = getStorageDir();
  ensureDir(dir);
  const stored: StoredVariationResult = { projectId, ...result };
  fs.writeFileSync(filePath(projectId), JSON.stringify(stored, null, 2), "utf-8");
  return stored;
}

/**
 * Load a previously persisted VariationResult.
 * Returns null if the file does not exist or cannot be parsed.
 */
export function getVariations(projectId: string): StoredVariationResult | null {
  const fp = filePath(projectId);
  if (!fs.existsSync(fp)) return null;
  try {
    return JSON.parse(fs.readFileSync(fp, "utf-8")) as StoredVariationResult;
  } catch {
    return null;
  }
}

/**
 * Delete the stored result for a project.
 * Returns true if the file was deleted, false if it did not exist.
 */
export function deleteVariations(projectId: string): boolean {
  const fp = filePath(projectId);
  if (!fs.existsSync(fp)) return false;
  fs.unlinkSync(fp);
  return true;
}

/**
 * List all project IDs that have a stored variation result.
 */
export function listVariationProjects(): string[] {
  const dir = getStorageDir();
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter(f => f.endsWith(".json"))
    .map(f => f.replace(/\.json$/, ""));
}
