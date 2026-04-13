/**
 * PixelFrameAI — Wizard State Serialisation
 *
 * Converts live browser state (_nf, PV) into the storable
 * ProjectPersistedState. Called before every PATCH /api/projects/:id.
 */

import {
  CURRENT_SCHEMA_VERSION,
  type ProjectPersistedState,
  type SubtitleStyleSpec,
} from "@/types/persistence";
import type { TranscriptSegment } from "@/lib/transcript/types";

// ── Browser-side state shapes (minimal types for the serialiser) ───────────

/** Wizard configuration accumulated across 10 steps. */
export interface WizardState {
  step: number;
  title: string;
  client: string;
  tags: string[];
  target: number; // target duration in seconds
  fileName: string;
  preset: string;
  format: string;
  subtitles: "automatic" | "manual" | "none";
  speechLang: string;
  clipMode: string;
  clipStart: number;
  clipEnd: number;
  clipDuration: number;
  segEdits: Record<string, string>;
  segStatus: Record<string, string>;
  subtitleStyle: SubtitleStyleSpec | null;
  prompt: string;
  analyzed: boolean;
}

/** Source video metadata from the video preview layer. */
export interface VideoPreviewState {
  duration: number;
  width: number;
  height: number;
  segments: TranscriptSegment[];
}

/**
 * Serialise the current wizard + video state into a ProjectPersistedState.
 *
 * @param nf               Live wizard configuration
 * @param pv               Video preview metadata
 * @param storageKey        Storage key for the source video (null during blob phase)
 * @param status            Project status
 * @param renderPayloadSnapshot  Frozen render payload (only set at approval time)
 */
export function serialiseWizardState(
  nf: WizardState,
  pv: VideoPreviewState,
  storageKey: string | null,
  status: ProjectPersistedState["status"] = "draft",
  renderPayloadSnapshot: Record<string, unknown> | null = null,
): ProjectPersistedState {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    currentStep: nf.step,

    title: nf.title,
    client: nf.client,
    tags: [...nf.tags],
    targetDurationSec: nf.target,

    sourceVideo:
      pv.duration > 0
        ? {
            storageKey,
            fileName: nf.fileName || null,
            durationSec: pv.duration,
            width: pv.width,
            height: pv.height,
            fileSizeBytes: null, // set by API after upload confirms
          }
        : null,

    clip: {
      mode: nf.clipMode as "full" | "custom",
      startSec: nf.clipStart,
      endSec: nf.clipEnd || pv.duration,
      durationSec: nf.clipDuration || pv.duration,
    },

    presetId: nf.preset,
    outputFormatId: nf.format,

    subtitleMode: nf.subtitles,
    speechLanguage:
      nf.subtitles === "automatic" ? nf.speechLang || "auto" : null,

    transcript:
      pv.segments.length > 0
        ? {
            segments: pv.segments,
            analysisComplete: nf.analyzed,
          }
        : null,

    segmentEdits: { ...nf.segEdits },
    segmentStatus: { ...nf.segStatus },

    subtitleStyle: nf.subtitleStyle ? { ...nf.subtitleStyle } : null,

    creativePrompt: nf.prompt,

    status,
    approvedAt: status === "approved" ? new Date().toISOString() : null,

    renderPayloadSnapshot,
  };
}
