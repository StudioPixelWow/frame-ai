import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, Img, OffthreadVideo } from "remotion";
import { AbsoluteFill } from "remotion";
import type { BrollPlacementProps } from "../types";

interface Props {
  placements: BrollPlacementProps[];
  transitionStyle: string;
  transitionDurationMs: number;
  cleanupCuts: { startSec: number; endSec: number }[];
}

function adjustTime(timeSec: number, cuts: { startSec: number; endSec: number }[]): number {
  let adj = 0;
  for (const cut of cuts) {
    if (cut.startSec < timeSec) {
      adj += Math.min(cut.endSec, timeSec) - cut.startSec;
    }
  }
  return Math.max(0, timeSec - adj);
}

/** Determine if a URL is likely a video (not an image) */
function isVideoUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return lower.endsWith(".mp4") || lower.endsWith(".mov") || lower.endsWith(".webm") ||
    lower.includes("/uploads/") || lower.includes("video");
}

export const BrollLayer: React.FC<Props> = ({ placements, transitionStyle, transitionDurationMs, cleanupCuts }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentSec = frame / fps;

  // Find active B-roll at current time
  const activeBroll = placements.find((p) => {
    const adjStart = adjustTime(p.startSec, cleanupCuts);
    const adjEnd = adjustTime(p.endSec, cleanupCuts);
    return currentSec >= adjStart && currentSec < adjEnd;
  });

  if (!activeBroll) return null;

  const adjStart = adjustTime(activeBroll.startSec, cleanupCuts);
  const adjEnd = adjustTime(activeBroll.endSec, cleanupCuts);
  const brollStartFrame = Math.round(adjStart * fps);
  const brollEndFrame = Math.round(adjEnd * fps);
  const localFrame = frame - brollStartFrame;
  const totalFrames = brollEndFrame - brollStartFrame;
  const transDurFrames = Math.ceil((transitionDurationMs / 1000) * fps);

  // Transition opacity — smooth fade in/out
  let opacity = 1;
  if (transitionStyle !== "cut" && transDurFrames > 0 && totalFrames > 0) {
    opacity = interpolate(
      localFrame,
      [0, Math.min(transDurFrames, totalFrames / 2), Math.max(totalFrames / 2, totalFrames - transDurFrames), totalFrames],
      [0, 1, 1, 0],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
    );
  }

  // Scale animation for visual impact
  const scale = interpolate(
    localFrame,
    [0, Math.min(transDurFrames, totalFrames)],
    [1.05, 1.0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const hasMedia = !!activeBroll.mediaUrl && !activeBroll.mediaUrl.startsWith("blob:");

  if (process.env.NODE_ENV === "development" && localFrame === 0) {
    console.debug("[BrollLayer] Active:", activeBroll.keyword, "| mediaUrl:", activeBroll.mediaUrl?.substring(0, 60) || "(empty)", "| isVideo:", hasMedia && isVideoUrl(activeBroll.mediaUrl));
  }

  return (
    <AbsoluteFill style={{ opacity, zIndex: 5 }}>
      {hasMedia ? (
        isVideoUrl(activeBroll.mediaUrl) ? (
          /* Real video B-roll — play a different section of the source video */
          <OffthreadVideo
            src={activeBroll.mediaUrl}
            startFrom={Math.round(activeBroll.startSec * fps)}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transform: `scale(${scale})`,
            }}
          />
        ) : (
          /* Image B-roll */
          <Img
            src={activeBroll.mediaUrl}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transform: `scale(${scale})`,
            }}
          />
        )
      ) : (
        /* Placeholder — styled gradient with keyword */
        <AbsoluteFill
          style={{
            background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{
            color: "rgba(255,255,255,0.4)",
            fontSize: 32,
            fontWeight: 700,
            textAlign: "center",
            fontFamily: "sans-serif",
          }}>
            B-Roll: {activeBroll.keyword}
          </div>
        </AbsoluteFill>
      )}

      {/* Color grading overlay to distinguish B-roll from main video */}
      {hasMedia && isVideoUrl(activeBroll.mediaUrl) && (
        <AbsoluteFill style={{
          background: "linear-gradient(135deg, rgba(0,181,254,0.08) 0%, rgba(0,227,255,0.05) 100%)",
          mixBlendMode: "overlay",
        }} />
      )}

      {/* B-Roll indicator badge */}
      <div style={{
        position: "absolute",
        top: 20,
        left: 20,
        background: "rgba(34,197,94,0.85)",
        padding: "4px 12px",
        borderRadius: 6,
        fontSize: 14,
        fontWeight: 600,
        color: "white",
        fontFamily: "sans-serif",
        backdropFilter: "blur(4px)",
      }}>
        B-Roll: {activeBroll.keyword}
      </div>
    </AbsoluteFill>
  );
};
