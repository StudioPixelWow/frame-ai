/**
 * PixelManageAI — Main Composition
 * Real multi-layer video composition driven by CompositionProps.
 *
 * Premium layers visible in preview/render:
 *  - Auto-zoom on speech (sporadic, smooth easing — not constant)
 *  - Ken Burns drift between sections (subtle pan movement)
 *  - Motion polish (smooth scale transitions at clip boundaries)
 *  - Color grading, vignette, film grain via VisualEffects
 */
import React from "react";
import { AbsoluteFill, OffthreadVideo, Sequence, useCurrentFrame, useVideoConfig, interpolate, Easing } from "remotion";
import type { CompositionProps } from "./types";
import { FPS } from "./types";
import { SubtitleLayer } from "./components/SubtitleLayer";
import { BrollLayer } from "./components/BrollLayer";
import { TransitionLayer } from "./components/TransitionLayer";
import { AudioLayer } from "./components/AudioLayer";
import { VisualEffects } from "./components/VisualEffects";

/** Pseudo-random seeded by segment index — deterministic, not Math.random */
function seededRand(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
}

export const PixelManageEdit: React.FC<CompositionProps> = (props) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const currentSec = frame / fps;

  const {
    videoUrl,
    trimStart,
    trimEnd,
    segments,
    subtitleStyle,
    brollPlacements,
    transition,
    music,
    cleanupCuts,
    visual,
    premium,
    durationSec,
    zoomKeyframes = [],
    hookBoost,
  } = props;

  // Build effective video segments (splitting around cleanup cuts)
  const sortedCuts = [...cleanupCuts].sort((a, b) => a.startSec - b.startSec);
  const effectiveStart = trimStart;
  const effectiveEnd = trimEnd > 0 ? trimEnd : durationSec + trimStart;

  // Calculate video clips after cleanup
  type VideoClip = { sourceStart: number; sourceEnd: number; outputStart: number; outputEnd: number; index: number };
  const videoClips: VideoClip[] = [];
  let cursor = effectiveStart;
  let outputCursor = 0;
  let clipIdx = 0;

  if (sortedCuts.length === 0) {
    videoClips.push({
      sourceStart: effectiveStart,
      sourceEnd: effectiveEnd,
      outputStart: 0,
      outputEnd: effectiveEnd - effectiveStart,
      index: 0,
    });
  } else {
    for (const cut of sortedCuts) {
      if (cut.startSec > cursor) {
        const dur = cut.startSec - cursor;
        videoClips.push({
          sourceStart: cursor,
          sourceEnd: cut.startSec,
          outputStart: outputCursor,
          outputEnd: outputCursor + dur,
          index: clipIdx,
        });
        outputCursor += dur;
        clipIdx++;
      }
      cursor = cut.endSec;
    }
    if (cursor < effectiveEnd) {
      const dur = effectiveEnd - cursor;
      videoClips.push({
        sourceStart: cursor,
        sourceEnd: effectiveEnd,
        outputStart: outputCursor,
        outputEnd: outputCursor + dur,
        index: clipIdx,
      });
    }
  }

  /* ═══════════════════════════════════════════════════════════════════════
     Smart Zoom — combines legacy sporadic zoom with keyframe-based zoom
     Priority: keyframe zoom > legacy sporadic zoom > transition zoom
     ═══════════════════════════════════════════════════════════════════════ */
  const getZoomScale = (): number => {
    // Hook boost multiplier — stronger zoom in hook zone
    const hookMult = (hookBoost?.active && currentSec < (hookBoost.hookEndSec || 5))
      ? (hookBoost.zoomMultiplier || 1)
      : 1;

    // 1. Keyframe-based smart zoom (from edit engine)
    if (zoomKeyframes.length > 0) {
      for (let i = 0; i < zoomKeyframes.length; i++) {
        const kf = zoomKeyframes[i];
        const kfEnd = kf.timeSec + kf.durationSec;
        if (currentSec >= kf.timeSec && currentSec < kfEnd) {
          const progress = (currentSec - kf.timeSec) / kf.durationSec;
          // Ease in for first half, ease out for second half
          let easedScale: number;
          if (progress < 0.4) {
            easedScale = interpolate(progress, [0, 0.4], [1, kf.scale], {
              easing: Easing.out(Easing.cubic),
            });
          } else if (progress > 0.7) {
            easedScale = interpolate(progress, [0.7, 1], [kf.scale, 1], {
              easing: Easing.in(Easing.cubic),
            });
          } else {
            easedScale = kf.scale;
          }
          return easedScale * hookMult;
        }
      }
    }

    // 2. Legacy sporadic zoom (fallback when no keyframes)
    if (!visual.zoomEnabled) return 1 * hookMult;

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      if (currentSec >= seg.startSec && currentSec < seg.endSec) {
        const shouldZoom = seededRand(i) > 0.45;
        if (!shouldZoom) return 1 * hookMult;

        const segDuration = (seg.endSec - seg.startSec) * fps;
        const segFrame = (currentSec - seg.startSec) * fps;

        const zoomTarget = visual.zoomOnSpeech;
        const easeInFrames = Math.min(segDuration * 0.3, fps * 0.5);
        const easeOutFrames = Math.min(segDuration * 0.3, fps * 0.5);

        if (segFrame < easeInFrames) {
          return interpolate(segFrame, [0, easeInFrames], [1, zoomTarget], {
            easing: Easing.out(Easing.cubic),
          }) * hookMult;
        } else if (segFrame > segDuration - easeOutFrames) {
          return interpolate(segFrame, [segDuration - easeOutFrames, segDuration], [zoomTarget, 1], {
            easing: Easing.in(Easing.cubic),
          }) * hookMult;
        }
        return zoomTarget * hookMult;
      }
    }

    // 3. Transition zoom
    if (visual.zoomOnTransition > 1) {
      for (let i = 0; i < videoClips.length - 1; i++) {
        const clip = videoClips[i];
        const nextClip = videoClips[i + 1];
        if (!nextClip) break;
        const gapStart = clip.outputEnd;
        const transZone = 0.3;
        if (currentSec >= gapStart - transZone && currentSec <= gapStart + transZone) {
          const t = interpolate(
            currentSec,
            [gapStart - transZone, gapStart, gapStart + transZone],
            [1, visual.zoomOnTransition, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) }
          );
          return t * hookMult;
        }
      }
    }

    return 1 * hookMult;
  };

  /* ═══════════════════════════════════════════════════════════════════════
     Ken Burns Drift — subtle pan/move per clip
     Each clip gets a unique slow pan direction (seeded), creating subtle
     motion that makes the video feel professionally edited.
     ═══════════════════════════════════════════════════════════════════════ */
  const getKenBurnsTransform = (clipIndex: number, clipOutputStart: number, clipOutputEnd: number): React.CSSProperties => {
    if (!premium.enabled || !premium.motionEffects) return {};

    const clipDuration = clipOutputEnd - clipOutputStart;
    if (clipDuration < 1) return {};

    const progress = Math.max(0, Math.min(1, (currentSec - clipOutputStart) / clipDuration));

    // Each clip gets a unique drift direction
    const seed = clipIndex * 7 + 13;
    const panXRange = (seededRand(seed) - 0.5) * 3;      // -1.5% to 1.5%
    const panYRange = (seededRand(seed + 1) - 0.5) * 2;   // -1% to 1%
    const scaleRange = seededRand(seed + 2) * 0.03 + 0.01; // 1% to 4% scale drift

    const panX = interpolate(progress, [0, 1], [0, panXRange], { easing: Easing.inOut(Easing.sin) });
    const panY = interpolate(progress, [0, 1], [0, panYRange], { easing: Easing.inOut(Easing.sin) });
    const scale = interpolate(progress, [0, 1], [1, 1 + scaleRange], { easing: Easing.inOut(Easing.sin) });

    return {
      transform: `translate(${panX}%, ${panY}%) scale(${scale})`,
    };
  };

  /* ═══════════════════════════════════════════════════════════════════════
     Clip transition motion — smooth scale pulse at cut boundaries
     ═══════════════════════════════════════════════════════════════════════ */
  const getClipTransitionScale = (clipOutputStart: number): number => {
    if (!premium.enabled || !premium.motionEffects) return 1;

    const transZone = 0.2; // 200ms around clip start
    if (currentSec >= clipOutputStart && currentSec < clipOutputStart + transZone) {
      return interpolate(
        currentSec,
        [clipOutputStart, clipOutputStart + transZone * 0.5, clipOutputStart + transZone],
        [1.02, 1.04, 1],
        { easing: Easing.out(Easing.cubic) }
      );
    }
    return 1;
  };

  const zoomScale = getZoomScale();

  // Validate video URL — blob: URLs CANNOT work in OffthreadVideo (Web Worker context)
  const safeVideoUrl = (() => {
    if (!videoUrl) return "";
    if (videoUrl.startsWith("blob:")) {
      // eslint-disable-next-line no-console
      console.error("[PixelManageEdit] CRITICAL: blob: URL passed to Remotion composition — this will cause black screen!", videoUrl);
      return ""; // Refuse to render — prevents silent black screen
    }
    return videoUrl;
  })();

  // Debug: log video source status (only in development, throttle to every 30 frames)
  if (typeof window !== "undefined" && process.env.NODE_ENV === "development" && frame % 30 === 0) {
    // eslint-disable-next-line no-console
    console.debug("[PixelManageEdit] videoUrl:", safeVideoUrl ? `"${safeVideoUrl.substring(0, 80)}..."` : "EMPTY/NULL",
      "| clips:", videoClips.length, "| durationSec:", durationSec, "| frame:", frame,
      "| zoomScale:", zoomScale.toFixed(3));
  }

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      {/* Layer 0: Main Video Track — ALWAYS the original video file */}
      {safeVideoUrl ? (
        videoClips.map((clip, i) => {
          const startFrame = Math.round(clip.outputStart * fps);
          const durationFrames = Math.round((clip.outputEnd - clip.outputStart) * fps);
          const kenBurns = getKenBurnsTransform(clip.index, clip.outputStart, clip.outputEnd);
          const clipTransScale = getClipTransitionScale(clip.outputStart);
          const combinedScale = zoomScale * clipTransScale;

          return (
            <Sequence key={`clip-${i}`} from={startFrame} durationInFrames={durationFrames}>
              <AbsoluteFill style={{
                ...kenBurns,
                transform: `${kenBurns.transform || ""} scale(${combinedScale})`.trim(),
              }}>
                <OffthreadVideo
                  src={safeVideoUrl}
                  startFrom={Math.round(clip.sourceStart * fps)}
                  endAt={Math.round(clip.sourceEnd * fps)}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </AbsoluteFill>
            </Sequence>
          );
        })
      ) : (
        <AbsoluteFill style={{
          background: "linear-gradient(180deg, #0a0a12 0%, #1a1a2e 100%)",
          display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column",
        }}>
          <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.4 }}>🎬</div>
          <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 14, fontFamily: "system-ui" }}>
            {videoUrl && videoUrl.startsWith("blob:") ? "שגיאה: blob: URL — ממתין ל-URL מהשרת" : "ממתין לקובץ וידאו..."}
          </div>
        </AbsoluteFill>
      )}

      {/* Layer 1: Visual Effects (color grading, vignette, film grain, motion breathing) */}
      <VisualEffects visual={visual} premium={premium} />

      {/* Layer 2: B-Roll Overlay */}
      {brollPlacements.length > 0 && (
        <BrollLayer
          placements={brollPlacements}
          transitionStyle={transition.style}
          transitionDurationMs={transition.durationMs}
          cleanupCuts={cleanupCuts}
        />
      )}

      {/* Layer 3: Transitions between clips */}
      {videoClips.length > 1 && transition.style !== "cut" && (
        videoClips.slice(0, -1).map((clip, i) => {
          const transFrames = Math.ceil((transition.durationMs / 1000) * fps);
          const transStart = Math.round(clip.outputEnd * fps) - Math.ceil(transFrames / 2);
          return (
            <Sequence key={`trans-${i}`} from={Math.max(0, transStart)} durationInFrames={transFrames}>
              <TransitionLayer style={transition.style} durationMs={transition.durationMs} at="start" />
            </Sequence>
          );
        })
      )}

      {/* Layer 4: Subtitles */}
      <SubtitleLayer segments={segments} style={subtitleStyle} cleanupCuts={cleanupCuts} />

      {/* Layer 5: Background Music */}
      <AudioLayer music={music} segments={segments} totalDurationSec={durationSec} />
    </AbsoluteFill>
  );
};
