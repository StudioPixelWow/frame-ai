/**
 * HebrewCaptions -- TikTok-style Hebrew captions with word highlighting
 * Based on remotion-best-practices/rules/hebrew-rtl.md + display-captions.md
 *
 * Key rules:
 * - All text containers MUST have direction: "rtl"
 * - Font loaded via @remotion/google-fonts with subsets: ["hebrew"]
 * - Numbers/English wrapped in bidi isolates
 * - No CSS transitions/animations -- all driven by useCurrentFrame()
 * - Hebrew fonts are 20-30% wider than English -- reduce fontSize accordingly
 */
import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, Easing, spring } from "remotion";
import { loadFont } from "@remotion/google-fonts/Heebo";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "700", "900"],
  subsets: ["hebrew"],
});

export interface CaptionWord {
  text: string;
  startMs: number;
  endMs: number;
}

export interface HebrewCaptionsProps {
  words: CaptionWord[];
  fontSize?: number;
  highlightColor?: string;
  baseColor?: string;
  position?: "top" | "center" | "bottom";
  maxWordsPerLine?: number;
  bgEnabled?: boolean;
  bgColor?: string;
  bgOpacity?: number;
}

/** Wrap LTR content (numbers, English) in Unicode bidi isolates */
function bidiIsolate(text: string): string {
  return text
    .replace(/(\d[\d,.]*%?)/g, '⁦$1⁩')
    .replace(/([A-Za-z][\w.-]*)/g, '⁦$1⁩');
}

export const HebrewCaptions: React.FC<HebrewCaptionsProps> = ({
  words,
  fontSize = 56,
  highlightColor = "#39E508",
  baseColor = "#FFFFFF",
  position = "bottom",
  maxWordsPerLine = 4,
  bgEnabled = true,
  bgColor = "#000000",
  bgOpacity = 60,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTimeMs = (frame / fps) * 1000;

  // Find currently visible words (show a window of maxWordsPerLine words)
  const activeWordIndex = words.findIndex(
    (w) => w.startMs <= currentTimeMs && w.endMs > currentTimeMs
  );

  if (activeWordIndex === -1 && currentTimeMs > 0) return null;
  if (words.length === 0) return null;

  // Calculate which group of words to show
  const groupIndex = Math.max(0, Math.floor(activeWordIndex / maxWordsPerLine));
  const groupStart = groupIndex * maxWordsPerLine;
  const groupEnd = Math.min(groupStart + maxWordsPerLine, words.length);
  const visibleWords = words.slice(groupStart, groupEnd);

  // Fade in/out animation
  const firstWordStart = visibleWords[0]?.startMs ?? 0;
  const lastWordEnd = visibleWords[visibleWords.length - 1]?.endMs ?? 0;
  const groupStartFrame = Math.round((firstWordStart / 1000) * fps);
  const groupEndFrame = Math.round((lastWordEnd / 1000) * fps);

  const opacity = interpolate(
    frame,
    [groupStartFrame, groupStartFrame + 4, groupEndFrame - 4, groupEndFrame],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Position styling
  const posStyle: React.CSSProperties =
    position === "top" ? { top: "8%", bottom: "auto" } :
    position === "center" ? { top: "50%", transform: "translateY(-50%)" } :
    { bottom: "11%" };

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        ...posStyle,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "0 5%",
        opacity,
        zIndex: 20,
        direction: "rtl",
      }}
    >
      <div
        style={{
          fontFamily,
          fontSize,
          fontWeight: 700,
          textAlign: "center",
          direction: "rtl",
          whiteSpace: "pre",
          lineHeight: 1.4,
          ...(bgEnabled ? {
            background: `rgba(0, 0, 0, ${bgOpacity / 100})`,
            padding: "12px 24px",
            borderRadius: 12,
          } : {}),
        }}
      >
        {visibleWords.map((word, i) => {
          const isActive =
            word.startMs <= currentTimeMs && word.endMs > currentTimeMs;

          // Scale animation for active word
          const wordStartFrame = Math.round((word.startMs / 1000) * fps);
          const scale = isActive
            ? interpolate(
                frame,
                [wordStartFrame, wordStartFrame + 3, wordStartFrame + 6],
                [1, 1.08, 1],
                { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
              )
            : 1;

          return (
            <span
              key={`${word.startMs}-${i}`}
              style={{
                color: isActive ? highlightColor : baseColor,
                fontWeight: isActive ? 900 : 700,
                display: "inline-block",
                transform: `scale(${scale})`,
                transformOrigin: "center",
                textShadow: isActive
                  ? `0 0 20px ${highlightColor}60, 0 2px 4px rgba(0,0,0,0.8)`
                  : "0 2px 4px rgba(0,0,0,0.8)",
                marginLeft: i > 0 ? `${Math.round(fontSize * 0.25)}px` : undefined,
              }}
            >
              {bidiIsolate(word.text)}
            </span>
          );
        })}
      </div>
    </div>
  );
};
