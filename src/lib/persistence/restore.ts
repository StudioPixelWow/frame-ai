/**
 * PixelFrameAI — Project State Restoration
 *
 * Restores _nf (wizard state) and PV (video preview state) from a
 * persisted ApiProject response. Called when a project is opened from
 * the project list or loaded from a URL.
 *
 * The entire restore is synchronous (< 1 ms, pure object assignments).
 * The video element begins loading from PV.url (pre-signed CDN URL) as
 * soon as the DOM renders.
 */

import type { ApiProject, ProjectPersistedState } from "@/types/persistence";
import type { WizardState, VideoPreviewState } from "./serialise";

/** Transient UI flags that are never persisted — always reset on load. */
export interface TransientFlags {
  analyzing: boolean;
  processing: boolean;
  analysisStep: number;
  procStep: number;
}

/** Render tracking state restored from API response. */
export interface RestoredRenderState {
  renderId: string | null;
  renderProgress: number;
  renderUrl: string | null;
  status: ProjectPersistedState["status"];
  shouldPoll: boolean; // true if render is still in flight
}

export interface RestoredProjectState {
  nf: WizardState;
  pv: VideoPreviewState;
  transient: TransientFlags;
  render: RestoredRenderState;
  projectId: string;
  videoUrl: string | null;
}

/**
 * Restore full project state from an API response.
 *
 * @param apiProject  The response from GET /api/projects/:id
 * @param defaultSubtitleStyle  Optional fallback style generator (called when
 *                              ws.subtitleStyle is null). Pass a function that
 *                              takes a presetId and returns a SubtitleStyleSpec.
 */
export function loadProjectState(
  apiProject: ApiProject,
  defaultSubtitleStyle?: (presetId: string) => WizardState["subtitleStyle"],
): RestoredProjectState {
  const ws = apiProject.wizardState;

  // 1. Restored wizard state (_nf)
  const nf: WizardState = {
    step: ws.currentStep,
    title: ws.title,
    client: ws.client,
    tags: [...ws.tags],
    target: ws.targetDurationSec,
    fileName: ws.sourceVideo?.fileName ?? "",
    preset: ws.presetId,
    format: ws.outputFormatId,
    subtitles: ws.subtitleMode,
    speechLang: ws.speechLanguage ?? "",
    clipMode: ws.clip.mode,
    clipStart: ws.clip.startSec,
    clipEnd: ws.clip.endSec,
    clipDuration: ws.clip.durationSec,
    segEdits: { ...ws.segmentEdits },
    segStatus: { ...ws.segmentStatus },
    subtitleStyle:
      ws.subtitleStyle ?? (defaultSubtitleStyle?.(ws.presetId) ?? null),
    prompt: ws.creativePrompt,
    analyzed: ws.transcript?.analysisComplete ?? false,
  };

  // 2. Restored video preview state (PV)
  // PV.file is always null after restore — File objects cannot be serialised.
  // All video operations use PV.url (pre-signed CDN URL), not PV.file.
  const pv: VideoPreviewState = {
    duration: ws.sourceVideo?.durationSec ?? 0,
    width: ws.sourceVideo?.width ?? 0,
    height: ws.sourceVideo?.height ?? 0,
    segments: ws.transcript?.segments ?? [],
  };

  // 3. Transient flags — always start fresh
  const transient: TransientFlags = {
    analyzing: false,
    processing: false,
    analysisStep: 0,
    procStep: 0,
  };

  // 4. Render tracking state
  const render: RestoredRenderState = {
    renderId: apiProject.renderId,
    renderProgress: apiProject.renderProgress,
    renderUrl: apiProject.outputUrl,
    status: ws.status,
    shouldPoll: apiProject.renderStatus === "rendering",
  };

  return {
    nf,
    pv,
    transient,
    render,
    projectId: apiProject.id,
    videoUrl: apiProject.videoUrl,
  };
}
