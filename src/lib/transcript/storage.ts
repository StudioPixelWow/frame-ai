/**
 * FrameAI — Transcript analysis storage.
 *
 * Persists TranscriptAnalysis results as JSON files under:
 *   <project-root>/.frameai/analyses/<projectId>.json
 *
 * Drop-in replaceable: swap this module for a database adapter
 * (Postgres, Redis, SQLite…) without touching the orchestrator.
 */

import fs   from "fs/promises";
import path from "path";
import type { TranscriptAnalysis, StoredAnalysis } from "./types";

// ── Storage directory ─────────────────────────────────────────────────────────

function storageDir(): string {
  // FRAMEAI_STORAGE_DIR env var allows overriding the storage path (e.g. in tests)
  return (
    process.env.FRAMEAI_STORAGE_DIR ??
    path.join(process.cwd(), ".frameai", "analyses")
  );
}

function analysisPath(projectId: string): string {
  // Sanitise project ID to prevent path traversal
  const safe = projectId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(storageDir(), `${safe}.json`);
}

// ── Write ─────────────────────────────────────────────────────────────────────

export async function storeAnalysis(
  projectId: string,
  analysis: TranscriptAnalysis
): Promise<void> {
  const dir     = storageDir();
  await fs.mkdir(dir, { recursive: true });

  const record: StoredAnalysis = {
    projectId,
    analysis,
    savedAt: new Date().toISOString(),
  };

  await fs.writeFile(analysisPath(projectId), JSON.stringify(record, null, 2), "utf-8");
}

// ── Read ──────────────────────────────────────────────────────────────────────

export async function getAnalysis(
  projectId: string
): Promise<TranscriptAnalysis | null> {
  try {
    const raw    = await fs.readFile(analysisPath(projectId), "utf-8");
    const record = JSON.parse(raw) as StoredAnalysis;
    return record.analysis ?? null;
  } catch (err: unknown) {
    // File not found is expected (ENOENT) — all other errors are surfaced
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deleteAnalysis(projectId: string): Promise<boolean> {
  try {
    await fs.unlink(analysisPath(projectId));
    return true;
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw err;
  }
}

// ── List ──────────────────────────────────────────────────────────────────────

export async function listAnalyses(): Promise<StoredAnalysis[]> {
  const dir = storageDir();
  let files: string[];
  try {
    files = await fs.readdir(dir);
  } catch {
    return [];
  }

  const records: StoredAnalysis[] = [];
  for (const file of files.filter((f) => f.endsWith(".json"))) {
    try {
      const raw = await fs.readFile(path.join(dir, file), "utf-8");
      records.push(JSON.parse(raw) as StoredAnalysis);
    } catch {
      // Skip corrupt files
    }
  }

  return records.sort(
    (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
  );
}
