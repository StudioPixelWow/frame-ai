import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import type { SubtitleSegmentProps, SubtitleStyleProps } from "../types";
import { FPS } from "../types";

interface Props {
  segments: SubtitleSegmentProps[];
  style: SubtitleStyleProps;
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

/**
 * Short-form subtitle formatter: max 3 words per line, max 2 lines per frame.
 * Keeps Hebrew RTL word order intact (splits by spaces, never reverses).
 */
function formatText(text: string, maxWordsPerLine: number = 3): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  for (let i = 0; i < words.length; i += maxWordsPerLine) {
    lines.push(words.slice(i, i + maxWordsPerLine).join(" "));
  }
  return lines.slice(0, 2); // max 2 lines per frame
}

/**
 * Build the outer-stroke + shadow textShadow string from style props.
 * This MUST be inherited by highlighted words to keep readability.
 */
function buildBaseTextShadow(style: SubtitleStyleProps): string {
  const parts: string[] = [];
  if (style.outlineEnabled) {
    const t = style.outlineThickness;
    const c = style.outlineColor;
    const offsets = [
      [t, 0], [-t, 0], [0, t], [0, -t],
      [t, t], [-t, t], [t, -t], [-t, -t],
      [t * 0.7, t * 0.7], [-t * 0.7, t * 0.7], [t * 0.7, -t * 0.7], [-t * 0.7, -t * 0.7],
    ];
    offsets.forEach(([x, y]) => parts.push(`${x}px ${y}px 0 ${c}`));
  }
  if (style.shadow) parts.push("2px 2px 6px rgba(0,0,0,0.8)");
  return parts.join(", ");
}

export const SubtitleLayer: React.FC<Props> = ({ segments, style, cleanupCuts }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentSec = frame / fps;

  // Find active segment
  const activeSeg = segments.find((seg) => {
    const adjStart = adjustTime(seg.startSec, cleanupCuts);
    const adjEnd = adjustTime(seg.endSec, cleanupCuts);
    return currentSec >= adjStart && currentSec < adjEnd;
  });

  if (!activeSeg || !activeSeg.text.trim()) return null;

  const adjStart = adjustTime(activeSeg.startSec, cleanupCuts);
  const adjEnd = adjustTime(activeSeg.endSec, cleanupCuts);
  const segStartFrame = Math.round(adjStart * fps);
  const segEndFrame = Math.round(adjEnd * fps);
  const segFrame = frame - segStartFrame;
  const segDurFrames = segEndFrame - segStartFrame;

  // Animation
  let opacity = 1;
  let translateY = 0;
  let scale = 1;

  if (style.animation === "fade") {
    opacity = interpolate(segFrame, [0, 8, segDurFrames - 8, segDurFrames], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  } else if (style.animation === "slideIn" || style.animation === "slideUp" || style.animation === "pop") {
    translateY = interpolate(segFrame, [0, 10], [30, 0], { extrapolateRight: "clamp" });
    opacity = interpolate(segFrame, [0, 6], [0, 1], { extrapolateRight: "clamp" });
  } else if (style.animation === "zoomIn") {
    scale = interpolate(segFrame, [0, 10], [0.7, 1], { extrapolateRight: "clamp" });
    opacity = interpolate(segFrame, [0, 6], [0, 1], { extrapolateRight: "clamp" });
  } else if (style.animation === "kineticTypography" || style.animation === "wordByWord") {
    opacity = 1;
    scale = interpolate(segFrame, [0, 5], [1.1, 1.0], { extrapolateRight: "clamp" });
  }

  const positionStyle: React.CSSProperties =
    style.position === "top" ? { top: "8%" } :
    style.position === "center" ? { top: "50%", transform: `translateY(-50%) translateY(${translateY}px) scale(${scale})` } :
    style.position === "manual" ? { top: `${Math.max(5, Math.min(95, style.manualY ?? 75))}%`, transform: `translateY(-50%) translateY(${translateY}px) scale(${scale})` } :
    { bottom: "11%" };

  const lines = formatText(activeSeg.text, 3);
  const baseTextShadow = buildBaseTextShadow(style);

  const hexToRgb = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16) || 0;
    const g = parseInt(hex.slice(3, 5), 16) || 0;
    const b = parseInt(hex.slice(5, 7), 16) || 0;
    return `${r}, ${g}, ${b}`;
  };

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        ...positionStyle,
        display: "flex",
        flexDirection: "column",
        alignItems: style.align === "left" ? "flex-start" : style.align === "right" ? "flex-end" : "center",
        padding: "0 5%",
        opacity,
        transform: style.position !== "center" ? `translateY(${translateY}px) scale(${scale})` : positionStyle.transform,
        zIndex: 10,
        direction: "rtl",
      }}
    >
      <div
        style={{
          fontFamily: `"${style.font}", sans-serif`,
          fontWeight: style.fontWeight,
          fontSize: style.fontSize,
          color: style.color,
          textAlign: style.align,
          lineHeight: 1.3,
          letterSpacing: "0.02em",
          ...(style.bgEnabled ? {
            background: `rgba(${hexToRgb(style.bgColor)}, ${style.bgOpacity / 100})`,
            padding: "8px 16px",
            borderRadius: "8px",
          } : {}),
          ...(baseTextShadow ? { textShadow: baseTextShadow } : {}),
        }}
      >
        {lines.map((line, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: style.align === "left" ? "flex-start" : style.align === "right" ? "flex-end" : "center",
              gap: `${Math.round(style.fontSize * 0.18)}px ${Math.round(style.fontSize * 0.3)}px`,
              direction: "rtl",
            }}
          >
            {renderHighlightedTokens(
              line,
              activeSeg.highlightWord,
              activeSeg.highlightStyle,
              style.highlightColor,
              baseTextShadow,
              style.highlightMode,
              style.highlightIntensity,
              activeSeg.emphasisWords,
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Safe max highlight scale — capped so words never visually overflow their
 * flex-allocated slot.  The flex gap system reserves breathing room but 1.1 is
 * the comfortable maximum.
 */
const MAX_HL_SCALE = 1.1;

/**
 * Tokenized word renderer.  Every word becomes its own flex item so that
 * transform: scale() expands visually from center without affecting layout
 * flow.  Gap between flex items provides breathing room.
 *
 * Key rule: highlighted <span>s MUST carry the base textShadow (stroke +
 * shadow) so they don't lose the outline.  Glow is COMPOSED on top of the
 * stroke, never replaces it.
 */
function renderHighlightedTokens(
  text: string,
  highlightWord: string,
  highlightStyle: string,
  highlightColor: string,
  baseTextShadow: string,
  highlightMode?: "sequential" | "ai",
  highlightIntensity?: "subtle" | "strong",
  emphasisWords?: string[],
): React.ReactNode {
  const isStrong = highlightIntensity === "strong";
  const words = text.split(/\s+/).filter(Boolean);

  // Compose glow on top of base stroke — never replace
  const glowShadow = isStrong
    ? `0 0 12px ${highlightColor}60, 0 0 4px ${highlightColor}40`
    : "";
  const composedShadow = [baseTextShadow, glowShadow].filter(Boolean).join(", ") || undefined;

  /** Base style every word token gets — ensures transform doesn't shift layout */
  const tokenBase: React.CSSProperties = {
    display: "inline-block",
    transformOrigin: "center",
    transition: "transform 0.15s ease, color 0.15s ease",
    willChange: "transform",
  };

  // ── AI emphasis mode ──
  if (highlightMode === "ai" && emphasisWords && emphasisWords.length > 0) {
    return words.map((word, i) => {
      const isEmphasis = emphasisWords.some(w => word.includes(w) || w.includes(word));
      if (isEmphasis) {
        return (
          <span key={i} style={{
            ...tokenBase,
            color: highlightColor,
            fontWeight: isStrong ? 900 : 700,
            textShadow: composedShadow,
            transform: isStrong ? `scale(${MAX_HL_SCALE})` : "none",
          }}>{word}</span>
        );
      }
      return <span key={i} style={tokenBase}>{word}</span>;
    });
  }

  // ── Sequential mode ──
  return words.map((word, i) => {
    const isHighlighted = highlightWord && word.toLowerCase().includes(highlightWord.toLowerCase());
    if (isHighlighted) {
      const hlExtra: React.CSSProperties =
        highlightStyle === "color" || highlightStyle === "bg"
          ? { color: highlightColor, textShadow: composedShadow }
          : highlightStyle === "scale"
            ? { transform: `scale(${MAX_HL_SCALE})`, color: highlightColor, textShadow: composedShadow }
            : { fontWeight: 900, color: highlightColor, textShadow: composedShadow };
      return <span key={i} style={{ ...tokenBase, ...hlExtra }}>{word}</span>;
    }
    return <span key={i} style={tokenBase}>{word}</span>;
  });
}
