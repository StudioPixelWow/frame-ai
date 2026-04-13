/**
 * PixelFrameAI — Transcription Provider Abstraction
 *
 * Defines the provider interface and configuration for ASR services.
 * Actual provider implementations (Whisper, AssemblyAI, etc.) will be
 * added as separate files when the worker is wired up.
 *
 * Service selection via environment variables:
 *   TRANSCRIPTION_PROVIDER=whisper   (openai | replicate | assemblyai | whisper-local)
 *   TRANSCRIPTION_API_KEY=<key>
 *   TRANSCRIPTION_MODEL=whisper-large-v3
 *   TRANSCRIPTION_MODE=deferred      (deferred | immediate)
 */

import type { TranscriptWord } from "@/types/analysis";

// ── Provider interface ─────────────────────────────────────────────────────

export interface TranscriptionRequest {
  /** Path or URL of the audio file to transcribe. */
  audioPath: string;
  /** BCP-47 language code or 'auto' for detection. */
  languageCode: string;
  /** Model identifier (provider-specific). */
  model?: string;
}

export interface TranscriptionResult {
  /** Word-level output with timestamps. */
  words: TranscriptWord[];
  /** Detected language (BCP-47). */
  languageDetected: string;
  /** Total audio duration in milliseconds. */
  durationMs: number;
}

export interface TranscriptionProvider {
  name: string;
  transcribe(request: TranscriptionRequest): Promise<TranscriptionResult>;
}

// ── Configuration ──────────────────────────────────────────────────────────

export interface TranscriptionConfig {
  provider: string;
  apiKey: string;
  model: string;
  /** 'deferred' waits for clip confirmation; 'immediate' starts on upload. */
  mode: "deferred" | "immediate";
}

/**
 * Read transcription config from environment variables.
 */
export function getTranscriptionConfig(): TranscriptionConfig {
  return {
    provider: process.env.TRANSCRIPTION_PROVIDER ?? "whisper",
    apiKey: process.env.TRANSCRIPTION_API_KEY ?? "",
    model: process.env.TRANSCRIPTION_MODEL ?? "whisper-large-v3",
    mode:
      (process.env.TRANSCRIPTION_MODE as "deferred" | "immediate") ??
      "deferred",
  };
}

/**
 * Check if the transcription service is configured (has an API key).
 */
export function isTranscriptionConfigured(): boolean {
  const config = getTranscriptionConfig();
  return config.apiKey.length > 0;
}
