/**
 * API Keys Storage
 * Stores encrypted API keys for external services.
 * Keys are base64-encoded (not truly encrypted, but not plain text).
 *
 * DUAL SOURCE: Keys can be saved in TWO places:
 *   1. api-keys.json — base64-encoded, used by older code paths
 *   2. ai-settings.json — plain text, used by the Settings UI (JsonStore)
 * getApiKeys() merges both, preferring ai-settings.json (latest from UI).
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { DATA_DIR } from "./paths";

const KEYS_FILE = join(DATA_DIR, "api-keys.json");
const AI_SETTINGS_FILE = join(DATA_DIR, "ai-settings.json");

export interface ApiKeysConfig {
  assemblyai: string;
  openai: string;
  updatedAt: string;
}

const EMPTY_KEYS: ApiKeysConfig = {
  assemblyai: "",
  openai: "",
  updatedAt: "",
};

function encode(raw: string): string {
  if (!raw) return "";
  return Buffer.from(raw).toString("base64");
}

function decode(encoded: string): string {
  if (!encoded) return "";
  try { return Buffer.from(encoded, "base64").toString("utf8"); }
  catch { return ""; }
}

function ensureDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

/** Read keys from api-keys.json (base64-encoded) */
function readFromApiKeysFile(): ApiKeysConfig {
  try {
    if (!existsSync(KEYS_FILE)) return EMPTY_KEYS;
    const raw = readFileSync(KEYS_FILE, "utf8");
    const data = JSON.parse(raw);
    return {
      assemblyai: decode(data.assemblyai || ""),
      openai: decode(data.openai || ""),
      updatedAt: data.updatedAt || "",
    };
  } catch {
    return EMPTY_KEYS;
  }
}

/** Read keys from ai-settings.json (Settings UI, plain text) */
function readFromAISettings(): ApiKeysConfig {
  try {
    if (!existsSync(AI_SETTINGS_FILE)) return EMPTY_KEYS;
    const raw = readFileSync(AI_SETTINGS_FILE, "utf8");
    const arr = JSON.parse(raw);
    // ai-settings.json is a JsonStore array — take first element
    const s = Array.isArray(arr) ? arr[0] : arr;
    if (!s) return EMPTY_KEYS;
    return {
      openai: s.apiKey || "",            // "apiKey" is the OpenAI key
      assemblyai: s.assemblyaiApiKey || "", // "assemblyaiApiKey" for AssemblyAI
      updatedAt: s.updatedAt || "",
    };
  } catch {
    return EMPTY_KEYS;
  }
}

/**
 * Get API keys — merges both sources.
 * For each provider, prefer ai-settings.json (Settings UI) if it has a key,
 * otherwise fall back to api-keys.json.
 */
export function getApiKeys(): ApiKeysConfig {
  // Prefer environment variables (work on Vercel). Fall back to disk-based
  // stores for local dev where keys are configured via the Settings UI.
  console.log("OPENAI KEY EXISTS:", !!process.env.OPENAI_API_KEY);
  const envOpenAi = process.env.OPENAI_API_KEY || "";
  const envAssembly = process.env.ASSEMBLYAI_API_KEY || "";

  let fromFile: ApiKeysConfig = EMPTY_KEYS;
  let fromSettings: ApiKeysConfig = EMPTY_KEYS;
  try {
    ensureDir();
    fromFile = readFromApiKeysFile();
    fromSettings = readFromAISettings();
  } catch (err) {
    // On read-only filesystems (e.g. Vercel) this is expected — env vars cover it.
    console.warn("[api-keys] Disk read skipped:", err instanceof Error ? err.message : err);
  }

  const merged: ApiKeysConfig = {
    openai: envOpenAi || fromSettings.openai || fromFile.openai,
    assemblyai: envAssembly || fromSettings.assemblyai || fromFile.assemblyai,
    updatedAt: fromSettings.updatedAt || fromFile.updatedAt,
  };

  console.log(
    `[api-keys] Resolved: openai=${merged.openai ? "yes" : "no"} (env=${!!envOpenAi} settings=${!!fromSettings.openai} file=${!!fromFile.openai}), assemblyai=${merged.assemblyai ? "yes" : "no"} (env=${!!envAssembly} settings=${!!fromSettings.assemblyai} file=${!!fromFile.assemblyai})`
  );

  return merged;
}

export function saveApiKeys(keys: Partial<ApiKeysConfig>): ApiKeysConfig {
  ensureDir();
  const current = getApiKeys();
  const updated: ApiKeysConfig = {
    assemblyai: keys.assemblyai !== undefined ? keys.assemblyai : current.assemblyai,
    openai: keys.openai !== undefined ? keys.openai : current.openai,
    updatedAt: new Date().toISOString(),
  };
  const encoded = {
    assemblyai: encode(updated.assemblyai),
    openai: encode(updated.openai),
    updatedAt: updated.updatedAt,
  };
  writeFileSync(KEYS_FILE, JSON.stringify(encoded, null, 2), "utf8");
  return updated;
}

export function getApiKeyStatus(): { assemblyai: boolean; openai: boolean } {
  const keys = getApiKeys();
  return {
    assemblyai: !!keys.assemblyai,
    openai: !!keys.openai,
  };
}

export function maskKey(key: string): string {
  if (!key || key.length < 8) return key ? "••••" : "";
  return key.substring(0, 4) + "•".repeat(Math.min(key.length - 8, 20)) + key.substring(key.length - 4);
}
