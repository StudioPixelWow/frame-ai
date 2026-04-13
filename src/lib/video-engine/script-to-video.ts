/**
 * PixelFrameAI — Script-to-Video Engine
 * Converts script text into timed subtitle segments and scene plans.
 */

import type {
  SubtitleSegment, ScenePlan, ScriptToVideoInput, ScriptToVideoOutput,
  SmartPresetId,
} from "./types";
import { SMART_PRESETS } from "./types";

const PACING_WPM: Record<string, number> = {
  slow: 100, moderate: 130, fast: 160, aggressive: 190,
};

function splitIntoSentences(text: string): string[] {
  return text
    .split(/(?<=[.\!?。])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

function estimateDuration(text: string, wpm: number): number {
  const words = text.split(/\s+/).length;
  return (words / wpm) * 60;
}

export function scriptToVideo(input: ScriptToVideoInput): ScriptToVideoOutput {
  const { script, language, targetDurationSec, preset } = input;

  const presetConfig = SMART_PRESETS.find(p => p.id === preset as any) || SMART_PRESETS[0];
  const pacing = presetConfig.pacing;
  const wpm = PACING_WPM[pacing] || 130;

  const sentences = splitIntoSentences(script);
  if (sentences.length === 0) {
    return { segments: [], scenePlan: [], suggestedPacing: pacing, estimatedDurationSec: 0 };
  }

  // Build segments with timing
  const segments: SubtitleSegment[] = [];
  let cursor = 0;

  sentences.forEach((sentence, i) => {
    // Split long sentences into 4-word chunks for subtitle formatting
    const words = sentence.split(/\s+/);
    const chunks: string[] = [];
    for (let j = 0; j < words.length; j += 4) {
      chunks.push(words.slice(j, j + 4).join(" "));
    }

    chunks.forEach((chunk, ci) => {
      const dur = estimateDuration(chunk, wpm);
      const minDur = 1.5;
      const effectiveDur = Math.max(minDur, dur);

      segments.push({
        id: `script_seg_${i}_${ci}`,
        startSec: Math.round(cursor * 100) / 100,
        endSec: Math.round((cursor + effectiveDur) * 100) / 100,
        text: chunk,
        edited: false,
        highlightWord: "",
        highlightStyle: "color",
      });

      cursor += effectiveDur;
    });

    // Add small pause between sentences
    cursor += 0.3;
  });

  // Build scene plan
  const scenePlan: ScenePlan[] = sentences.map((sentence, i) => {
    const startSeg = segments.find(s => s.text.includes(sentence.split(/\s+/).slice(0, 2).join(" ")));
    const cameras: ScenePlan["cameraMovement"][] = ["static", "zoomIn", "zoomOut", "pan"];
    const transitions: ScenePlan["transition"][] = ["cut", "crossfade", "slide"];

    return {
      sceneIndex: i,
      startSec: startSeg?.startSec || 0,
      endSec: startSeg?.endSec || 0,
      text: sentence,
      brollSuggestion: sentence.length > 20 ? "contextual footage" : "close-up",
      cameraMovement: cameras[i % cameras.length],
      transition: transitions[i % transitions.length],
    };
  });

  return {
    segments,
    scenePlan,
    suggestedPacing: pacing,
    estimatedDurationSec: Math.round(cursor),
  };
}
