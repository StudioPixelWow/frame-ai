"use client";

/**
 * UnifiedEditedPreviewPlayer — THE single source-of-truth preview player
 * for the PixelFrameAI wizard editing pipeline.
 *
 * Shows the accumulated edit state across ALL previous wizard stages:
 *   Layer 0  → Base video (or active B-roll replacing it)
 *   Layer 1  → Subtitle overlay (with full styling carry-over)
 *   Layer 2  → AI highlight / emphasis on active words
 *   Layer 3  → Transition/Effect visual transforms (zoom, shake, blur, etc.)
 *
 * Used by: StepAiHighlight, StepBroll, StepTransitions, StepPreview, StepApprove
 */

import React, { useRef, useState, useMemo, useEffect, useCallback, useImperativeHandle, forwardRef } from "react";
import { FORMAT_DIMENSIONS } from "@/remotion/types";

/* ═══════════════════════════════════════════════════════════════════════
   Types — kept minimal; mirrors the shapes from the wizard
   ═══════════════════════════════════════════════════════════════════════ */

export interface SubSegment {
  id: string;
  startSec: number;
  endSec: number;
  text: string;
  confidence?: number;
  edited: boolean;
  highlightWord: string;
  highlightStyle: "color" | "bg" | "scale" | "bold";
  emphasisWords?: string[];
}

export interface BrollPlacement {
  id: string;
  startSec: number;
  endSec: number;
  keyword: string;
  source: string;
  stockProvider?: string;
  stockClipId?: string;
  stockPreviewUrl?: string;
  stockDownloadUrl?: string;
  stockThumbnailUrl?: string;
  stockTitle?: string;
  stockDuration?: number;
}

export type EffectType = "zoom" | "shake" | "fade" | "blur" | "flash" | "punchZoom" | "slowZoom" | "kenBurns";
export type EffectScope = "global" | "segment";

export interface VisualEffect {
  id: string;
  type: EffectType;
  intensity: number;
  scope: EffectScope;
  segmentId?: string;
  startSec?: number;
  endSec?: number;
  enabled: boolean;
}

export interface SubtitleStyleData {
  subtitleFont: string;
  subtitleFontWeight: number;
  subtitleFontSize: number;
  subtitleColor: string;
  subtitleHighlightColor: string;
  subtitleOutlineEnabled: boolean;
  subtitleOutlineColor: string;
  subtitleOutlineThickness: number;
  subtitleShadow: boolean;
  subtitleBg: boolean;
  subtitleBgColor: string;
  subtitleBgOpacity: number;
  subtitleAlign: "left" | "center" | "right";
  subtitlePosition: "top" | "center" | "bottom" | "manual";
  subtitleManualY?: number; // 0-100 percentage from top
  subtitleAnimation: string;
  subtitleLineBreak: string;
  highlightMode: "sequential" | "ai";
  highlightIntensity: "subtle" | "strong";
}

export interface UnifiedPreviewProps {
  /** The uploaded video URL — single source of truth */
  videoSrc: string;
  /** Selected output format */
  format: "9:16" | "16:9" | "1:1" | "4:5";
  /** Subtitle segments from transcription */
  segments: SubSegment[];
  /** Subtitle styling data */
  subtitleStyle: SubtitleStyleData;
  /** B-roll placements */
  brollEnabled?: boolean;
  brollPlacements?: BrollPlacement[];
  /** Visual effects */
  effects?: VisualEffect[];
  /** Optional: external time listener (for parent sync) */
  onTimeUpdate?: (time: number) => void;
  /** Optional: compact mode for sidebar use */
  compact?: boolean;
  /** Optional: max width override (px) */
  maxWidth?: number;
  /** Optional: show layer status badges below player */
  showLayerBadges?: boolean;
  /** Optional: show debug overlay */
  debug?: boolean;
  /** Transition style to render between clips / B-roll boundaries */
  transitionStyle?: string;
  /** Transition duration in ms */
  transitionDurationMs?: number;
}

export interface UnifiedPreviewHandle {
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  getCurrentTime: () => number;
  getVideoElement: () => HTMLVideoElement | null;
}

/* ═══════════════════════════════════════════════════════════════════════
   Helpers — local copies to keep the component self-contained
   ═══════════════════════════════════════════════════════════════════════ */

const MAX_HL_SCALE = 1.1;

function formatSubtitleText(text: string): string[] {
  if (!text.trim()) return [];
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  for (let i = 0; i < words.length && lines.length < 2; i += 3) {
    lines.push(words.slice(i, Math.min(i + 3, words.length)).join(" "));
  }
  return lines;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.substring(0, 2), 16), parseInt(h.substring(2, 4), 16), parseInt(h.substring(4, 6), 16)];
}

function buildBaseTextShadow(s: SubtitleStyleData): string {
  const parts: string[] = [];
  if (s.subtitleOutlineEnabled) {
    const t = s.subtitleOutlineThickness;
    const c = s.subtitleOutlineColor;
    const offsets = [
      [t, 0], [-t, 0], [0, t], [0, -t],
      [t, t], [-t, t], [t, -t], [-t, -t],
      [t * 0.7, t * 0.7], [-t * 0.7, t * 0.7], [t * 0.7, -t * 0.7], [-t * 0.7, -t * 0.7],
    ];
    offsets.forEach(([x, y]) => parts.push(`${x}px ${y}px 0 ${c}`));
  }
  if (s.subtitleShadow) parts.push("2px 2px 4px rgba(0,0,0,0.8)");
  return parts.join(", ");
}

/* ═══════════════════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════════════════ */

export const UnifiedEditedPreviewPlayer = forwardRef<UnifiedPreviewHandle, UnifiedPreviewProps>(function UnifiedEditedPreviewPlayer(props, ref) {
  const {
    videoSrc,
    format,
    segments,
    subtitleStyle: ss,
    brollEnabled = false,
    brollPlacements = [],
    effects = [],
    onTimeUpdate,
    compact = false,
    maxWidth,
    showLayerBadges = true,
    debug = false,
    transitionStyle = "cut",
    transitionDurationMs = 500,
  } = props;

  /* ── Refs & State ── */
  const videoRef = useRef<HTMLVideoElement>(null);
  const rafRef = useRef<number>(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoReady, setVideoReady] = useState(false);
  const [videoError, setVideoError] = useState(false);

  const hasVideo = !!videoSrc;
  const formatDims = FORMAT_DIMENSIONS[format] || FORMAT_DIMENSIONS["9:16"];
  const aspectRatio = formatDims.width / formatDims.height;

  /* ── Imperative handle for parent control ── */
  useImperativeHandle(ref, () => ({
    play: () => videoRef.current?.play(),
    pause: () => videoRef.current?.pause(),
    seek: (t: number) => { if (videoRef.current) videoRef.current.currentTime = t; },
    getCurrentTime: () => videoRef.current?.currentTime ?? 0,
    getVideoElement: () => videoRef.current,
  }), []);

  /* ── Reset on source change ── */
  useEffect(() => { setVideoReady(false); setVideoError(false); }, [videoSrc]);

  /* ── rAF playback tracking (single timeline source) ── */
  useEffect(() => {
    if (!hasVideo) return;
    const tick = () => {
      const v = videoRef.current;
      if (v && !v.paused && !v.ended) {
        setCurrentTime(v.currentTime);
        onTimeUpdate?.(v.currentTime);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    const startTimer = setTimeout(() => {
      rafRef.current = requestAnimationFrame(tick);
    }, 80);
    const v = videoRef.current;
    const handleTimeUpdate = () => { if (v) { setCurrentTime(v.currentTime); onTimeUpdate?.(v.currentTime); } };
    const handleSeeked = () => { if (v) { setCurrentTime(v.currentTime); onTimeUpdate?.(v.currentTime); } };
    const handleLoadedData = () => { if (v) { setCurrentTime(v.currentTime); onTimeUpdate?.(v.currentTime); } };
    if (v) {
      v.addEventListener("timeupdate", handleTimeUpdate);
      v.addEventListener("seeked", handleSeeked);
      v.addEventListener("loadeddata", handleLoadedData);
    }
    return () => {
      clearTimeout(startTimer);
      cancelAnimationFrame(rafRef.current);
      if (v) {
        v.removeEventListener("timeupdate", handleTimeUpdate);
        v.removeEventListener("seeked", handleSeeked);
        v.removeEventListener("loadeddata", handleLoadedData);
      }
    };
  }, [videoSrc, hasVideo, onTimeUpdate]);

  /* ── Active subtitle segment ── */
  const activeSeg = useMemo(
    () => segments.find(s => currentTime >= s.startSec && currentTime <= s.endSec) || null,
    [currentTime, segments],
  );

  /* ── Active B-roll overlay ── */
  const activeBroll = useMemo(() => {
    if (!brollEnabled) return null;
    return brollPlacements.find(p => currentTime >= p.startSec && currentTime <= p.endSec && p.stockPreviewUrl) || null;
  }, [currentTime, brollPlacements, brollEnabled]);

  /* ── Transition overlay state ── */
  const transitionOverlay = useMemo(() => {
    if (transitionStyle === "cut" || !brollEnabled || brollPlacements.length === 0) return null;
    const durationSec = transitionDurationMs / 1000;
    const halfDur = durationSec / 2;

    // Check all B-roll boundaries (start = entering broll, end = leaving broll)
    for (const p of brollPlacements) {
      if (!p.stockPreviewUrl) continue;
      // Entering B-roll (video → broll)
      if (currentTime >= p.startSec - halfDur && currentTime <= p.startSec + halfDur) {
        const progress = (currentTime - (p.startSec - halfDur)) / durationSec;
        return Math.max(0, Math.min(1, progress));
      }
      // Leaving B-roll (broll → video)
      if (currentTime >= p.endSec - halfDur && currentTime <= p.endSec + halfDur) {
        const progress = (currentTime - (p.endSec - halfDur)) / durationSec;
        return Math.max(0, Math.min(1, progress));
      }
    }
    return null;
  }, [currentTime, brollPlacements, brollEnabled, transitionStyle, transitionDurationMs]);

  /* ── Active effects for current time ── */
  const activeEffectsNow = useMemo(() => {
    return effects.filter(fx => {
      if (!fx.enabled) return false;
      if (fx.scope === "global") return true;
      if (fx.scope === "segment" && fx.startSec != null && fx.endSec != null) {
        return currentTime >= fx.startSec && currentTime <= fx.endSec;
      }
      return false;
    });
  }, [currentTime, effects]);

  /* ── Build CSS effect transforms ── */
  const effectStyle = useMemo<React.CSSProperties>(() => {
    const style: React.CSSProperties = { transition: "all 0.3s ease" };
    for (const fx of activeEffectsNow) {
      const i = fx.intensity / 100;
      switch (fx.type) {
        case "zoom":
        case "slowZoom":
          style.transform = `${style.transform || ""} scale(${1 + i * 0.15})`.trim();
          break;
        case "punchZoom":
          style.transform = `${style.transform || ""} scale(${1 + i * 0.25})`.trim();
          style.transition = "all 0.15s ease-out";
          break;
        case "shake": {
          const amt = Math.round(i * 4);
          const phase = Math.sin(currentTime * 20) * amt;
          style.transform = `${style.transform || ""} translate(${phase}px, ${phase * 0.7}px)`.trim();
          style.transition = "none";
          break;
        }
        case "kenBurns":
          style.transform = `${style.transform || ""} scale(${1 + i * 0.12}) translate(${i * 2}%, ${i * 1}%)`.trim();
          break;
        case "fade":
          style.opacity = 1 - i * 0.3;
          break;
        case "blur":
          style.filter = `blur(${i * 3}px)`;
          break;
      }
    }
    return style;
  }, [activeEffectsNow, currentTime]);

  const hasFlash = activeEffectsNow.some(fx => fx.type === "flash");
  const flashIntensity = activeEffectsNow.find(fx => fx.type === "flash")?.intensity || 0;

  /* ── Debug logging ── */
  useEffect(() => {
    if (!debug) return;
    console.log(
      `[UnifiedPreview] format=${format} (${formatDims.width}×${formatDims.height})` +
      ` | t=${currentTime.toFixed(2)}s` +
      ` | src=${videoSrc ? "loaded" : "EMPTY"}` +
      ` | ready=${videoReady} err=${videoError}` +
      ` | sub=${activeSeg ? `"${activeSeg.text.substring(0, 20)}…"` : "none"}` +
      ` | hl=${activeSeg?.highlightWord || "none"} mode=${ss.highlightMode}` +
      ` | broll=${activeBroll ? `${activeBroll.keyword}@${activeBroll.startSec}` : "none"}` +
      ` | fx=${activeEffectsNow.length}(${activeEffectsNow.map(f => f.type).join(",")})` +
      ` | render=${activeBroll ? "BROLL" : "BASE_VIDEO"}`
    );
  }, [debug, format, formatDims, currentTime, videoSrc, videoReady, videoError, activeSeg, activeBroll, activeEffectsNow, ss.highlightMode]);

  /* ── Render highlighted tokens ── */
  const renderTokens = useCallback((line: string, seg: SubSegment) => {
    const hlColor = ss.subtitleHighlightColor || "#FFD700";
    const isStrong = ss.highlightIntensity === "strong";
    const baseShadow = buildBaseTextShadow(ss);
    const glowPart = isStrong ? `0 0 12px ${hlColor}60, 0 0 4px ${hlColor}40` : "";
    const composedShadow = [baseShadow, glowPart].filter(Boolean).join(", ") || undefined;
    const words = line.split(/\s+/).filter(Boolean);
    const tokenBase: React.CSSProperties = {
      display: "inline-block", transformOrigin: "center",
      transition: "transform 0.15s ease, color 0.15s ease", willChange: "transform",
    };

    if (ss.highlightMode === "ai" && seg.emphasisWords && seg.emphasisWords.length > 0) {
      return words.map((word, i) => {
        const isEmphasis = seg.emphasisWords!.some(w => word.includes(w) || w.includes(word));
        if (isEmphasis) {
          return (
            <span key={i} style={{
              ...tokenBase, color: hlColor,
              fontWeight: isStrong ? 900 : 700,
              textShadow: composedShadow,
              transform: isStrong ? `scale(${MAX_HL_SCALE})` : "none",
            }}>{word}</span>
          );
        }
        return <span key={i} style={tokenBase}>{word}</span>;
      });
    }

    return words.map((word, i) => {
      const isHighlighted = seg.highlightWord && word.toLowerCase().includes(seg.highlightWord.toLowerCase());
      if (isHighlighted) {
        const hlExtra: React.CSSProperties = { textShadow: composedShadow };
        if (seg.highlightStyle === "color") hlExtra.color = hlColor;
        else if (seg.highlightStyle === "bg") hlExtra.background = hlColor;
        else if (seg.highlightStyle === "scale") { hlExtra.transform = `scale(${MAX_HL_SCALE})`; hlExtra.color = hlColor; }
        else if (seg.highlightStyle === "bold") hlExtra.fontWeight = 900;
        return <span key={i} style={{ ...tokenBase, ...hlExtra }}>{word}</span>;
      }
      return <span key={i} style={tokenBase}>{word}</span>;
    });
  }, [ss]);

  /* ── Scaled subtitle style for preview ── */
  const scaleFactor = compact ? 0.45 : 0.55;
  const scaledFontSize = Math.max(ss.subtitleFontSize * scaleFactor, 11);
  const scaledOutline = Math.max(ss.subtitleOutlineThickness * scaleFactor, 1);

  const previewSubStyle = useMemo<React.CSSProperties>(() => {
    const style: React.CSSProperties = {
      fontFamily: ss.subtitleFont,
      fontWeight: ss.subtitleFontWeight,
      fontSize: `${scaledFontSize}px`,
      color: ss.subtitleColor,
      textAlign: ss.subtitleAlign,
      lineHeight: 1.3,
      direction: "rtl",
      whiteSpace: "pre-line",
    };
    if (ss.subtitleBg) {
      const [r, g, b] = hexToRgb(ss.subtitleBgColor);
      style.background = `rgba(${r},${g},${b},${ss.subtitleBgOpacity / 100})`;
      style.padding = "0.2em 0.5em";
      style.borderRadius = "4px";
    }
    const strokeParts: string[] = [];
    if (ss.subtitleOutlineEnabled) {
      const t = scaledOutline;
      const c = ss.subtitleOutlineColor;
      const offsets = [[t,0],[-t,0],[0,t],[0,-t],[t,t],[-t,t],[t,-t],[-t,-t],[t*0.7,t*0.7],[-t*0.7,t*0.7],[t*0.7,-t*0.7],[-t*0.7,-t*0.7]];
      offsets.forEach(([x, y]) => strokeParts.push(`${x}px ${y}px 0 ${c}`));
    }
    if (ss.subtitleShadow) strokeParts.push("2px 2px 4px rgba(0,0,0,0.8)");
    const shadow = strokeParts.join(", ");
    if (shadow) style.textShadow = shadow;
    return style;
  }, [ss, scaledFontSize, scaledOutline]);

  /* ── Compute container sizing ── */
  const containerMaxWidth = maxWidth ?? (aspectRatio < 1 ? (compact ? 240 : 340) : "100%");

  /* ═══════════════ JSX ═══════════════ */
  return (
    <div>
      {/* Empty state */}
      {!hasVideo && (
        <div style={{
          width: "100%", maxWidth: containerMaxWidth,
          aspectRatio: `${formatDims.width} / ${formatDims.height}`,
          margin: "0 auto", borderRadius: 12, background: "var(--surface-raised)",
          border: "2px dashed var(--border)", display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: "0.5rem", padding: "1rem",
        }}>
          <span style={{ fontSize: "2rem" }}>🎬</span>
          <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--foreground-muted)", textAlign: "center" }}>
            לא נמצא וידאו לתצוגה מקדימה
          </span>
          <span style={{ fontSize: "0.72rem", color: "var(--foreground-muted)", textAlign: "center" }}>
            חזור לשלב העלאת וידאו כדי להעלות קובץ
          </span>
        </div>
      )}

      {/* Player with all layers */}
      {hasVideo && (
        <div style={{
          position: "relative",
          width: "100%",
          maxWidth: containerMaxWidth,
          aspectRatio: `${formatDims.width} / ${formatDims.height}`,
          margin: "0 auto",
          borderRadius: 12,
          overflow: "hidden",
          background: "#000",
        }}>

          {/* Layer 3: Effect transform wrapper — wraps base video + broll */}
          <div style={{
            ...effectStyle,
            position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "hidden",
          }}>

            {/* Layer 0: B-roll overlay when active (replaces base video visually) */}
            {activeBroll && activeBroll.stockPreviewUrl && (
              <video
                key={activeBroll.stockClipId || activeBroll.id}
                src={activeBroll.stockPreviewUrl}
                autoPlay muted loop playsInline
                onLoadedData={(e) => { (e.target as HTMLVideoElement).play().catch(() => {}); }}
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 2 }}
              />
            )}

            {/* Layer 0: Base video — THE real media player, single timeline source */}
            <video
              ref={videoRef}
              src={videoSrc}
              controls
              playsInline
              preload="auto"
              onLoadedData={() => { setVideoReady(true); setVideoError(false); }}
              onError={() => { setVideoError(true); setVideoReady(false); }}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", borderRadius: 12 }}
            />

            {/* Video loading state */}
            {!videoReady && !videoError && (
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3, background: "rgba(0,0,0,0.6)" }}>
                <span style={{ color: "#fff", fontSize: "0.8rem" }}>טוען וידאו...</span>
              </div>
            )}
            {videoError && (
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 3, background: "rgba(0,0,0,0.7)", gap: "0.35rem" }}>
                <span style={{ fontSize: "1.5rem" }}>⚠️</span>
                <span style={{ color: "#fff", fontSize: "0.75rem" }}>שגיאה בטעינת הוידאו</span>
              </div>
            )}
          </div>

          {/* Flash effect overlay */}
          {hasFlash && (
            <div style={{
              position: "absolute", inset: 0, zIndex: 20, pointerEvents: "none",
              background: `rgba(255,255,255,${(flashIntensity / 100) * 0.6})`,
              transition: "background 0.1s",
            }} />
          )}

          {/* Transition overlay between clips/B-roll */}
          {transitionOverlay !== null && transitionStyle !== "cut" && (() => {
            const p = transitionOverlay; // 0→1 progress
            // Bell curve: peak at 0.5
            const bell = Math.sin(p * Math.PI);

            if (transitionStyle === "fade") {
              return <div style={{ position: "absolute", inset: 0, zIndex: 21, pointerEvents: "none", backgroundColor: "#000", opacity: bell * 0.85 }} />;
            }
            if (transitionStyle === "zoom") {
              const sc = 1 + bell * 0.3;
              return <div style={{ position: "absolute", inset: 0, zIndex: 21, pointerEvents: "none", backgroundColor: "#000", opacity: bell * 0.5, transform: `scale(${sc})` }} />;
            }
            if (transitionStyle === "motionBlur") {
              return <div style={{ position: "absolute", inset: 0, zIndex: 21, pointerEvents: "none", backdropFilter: `blur(${bell * 12}px)` }} />;
            }
            if (transitionStyle === "premiumSlide") {
              const tx = (p < 0.5 ? p * 2 - 1 : (1 - p) * 2 - 1) * 100;
              return <div style={{ position: "absolute", inset: 0, zIndex: 21, pointerEvents: "none", backgroundColor: "#000", transform: `translateX(${tx}%)` }} />;
            }
            if (transitionStyle === "punchyCut") {
              return <div style={{ position: "absolute", inset: 0, zIndex: 21, pointerEvents: "none", backgroundColor: "#fff", opacity: bell > 0.8 ? (1 - bell) * 5 : 0 }} />;
            }
            if (transitionStyle === "cinematicDissolve") {
              const r = (1 - bell) * 100;
              return <div style={{ position: "absolute", inset: 0, zIndex: 21, pointerEvents: "none", background: `radial-gradient(circle, transparent ${r}%, rgba(0,0,0,0.85) ${r + 20}%)` }} />;
            }
            if (transitionStyle === "lightLeak") {
              const lightX = p * 120 - 10;
              const hue = 30 + bell * 15;
              const intensity = bell * 0.75;
              const blur = bell * 25;
              return (
                <div style={{ position: "absolute", inset: 0, zIndex: 21, pointerEvents: "none" }}>
                  <div style={{
                    position: "absolute", inset: 0,
                    background: `radial-gradient(ellipse 80% 100% at ${lightX}% 50%, hsla(${hue},100%,65%,${intensity}) 0%, hsla(${hue + 15},90%,55%,${intensity * 0.5}) 40%, transparent 75%)`,
                    mixBlendMode: "screen" as const, filter: `blur(${blur}px)`,
                  }} />
                  <div style={{
                    position: "absolute", inset: 0,
                    background: `radial-gradient(ellipse 60% 80% at ${lightX + 10}% 40%, hsla(35,100%,70%,${intensity * 0.4}) 0%, transparent 60%)`,
                    mixBlendMode: "overlay" as const, filter: `blur(${blur * 1.5}px)`,
                  }} />
                  <div style={{
                    position: "absolute", inset: 0,
                    backgroundColor: `hsla(40,80%,90%,${bell * 0.12})`,
                    mixBlendMode: "screen" as const,
                  }} />
                </div>
              );
            }
            return null;
          })()}

          {/* Layer 1+2: Subtitle + AI highlight overlay */}
          {activeSeg && activeSeg.text && (
            <div style={{
              position: "absolute", left: 0, right: 0, zIndex: 10, pointerEvents: "none",
              bottom: ss.subtitlePosition === "top" ? "auto" : ss.subtitlePosition === "center" ? "40%" : ss.subtitlePosition === "manual" ? "auto" : "8%",
              top: ss.subtitlePosition === "top" ? "8%" : ss.subtitlePosition === "manual" ? `${Math.max(5, Math.min(95, ss.subtitleManualY ?? 75))}%` : "auto",
              transform: ss.subtitlePosition === "manual" ? "translateY(-50%)" : undefined,
              display: "flex", justifyContent: "center", padding: "0 8%",
            }}>
              <div style={previewSubStyle}>
                {formatSubtitleText(activeSeg.text).map((line, li) => (
                  <div key={li} style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "0.18em 0.3em", direction: "rtl" }}>
                    {renderTokens(line, activeSeg)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* B-roll active indicator badge */}
          {activeBroll && (
            <div style={{
              position: "absolute", top: 8, left: 8, zIndex: 15,
              fontSize: "0.6rem", fontWeight: 700, padding: "2px 8px", borderRadius: 6,
              background: "rgba(0,181,254,0.9)", color: "#fff",
            }}>
              B-Roll: {activeBroll.stockProvider || activeBroll.source}
            </div>
          )}

          {/* Active effects indicator badge */}
          {activeEffectsNow.length > 0 && (
            <div style={{
              position: "absolute", top: 8, right: 8, zIndex: 15,
              fontSize: "0.6rem", fontWeight: 700, padding: "2px 8px", borderRadius: 6,
              background: "rgba(0,181,254,0.9)", color: "#fff",
            }}>
              ✨ {activeEffectsNow.length} אפקט{activeEffectsNow.length > 1 ? "ים" : ""}
            </div>
          )}

          {/* Format badge */}
          <div style={{
            position: "absolute", bottom: 8, left: 8, zIndex: 15,
            fontSize: "0.58rem", fontWeight: 700, padding: "2px 6px", borderRadius: 4,
            background: "rgba(0,0,0,0.65)", color: "#fff",
          }}>
            {format}
          </div>
        </div>
      )}

      {/* Layer status badges */}
      {showLayerBadges && hasVideo && (
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.5rem", justifyContent: "center" }}>
          {([
            { label: "כתוביות", active: !!activeSeg, color: "#3b82f6" },
            { label: "הדגשה", active: !!(activeSeg?.highlightWord || (activeSeg?.emphasisWords && activeSeg.emphasisWords.length > 0)), color: "#fbbf24" },
            { label: "B-Roll", active: !!activeBroll, color: "#22c55e" },
            { label: "אפקטים", active: activeEffectsNow.length > 0, color: "#00B5FE" },
          ] as const).map(l => (
            <span key={l.label} style={{
              fontSize: "0.62rem", padding: "2px 6px", borderRadius: 4,
              background: l.active ? `${l.color}20` : "var(--surface-raised)",
              color: l.active ? l.color : "var(--foreground-muted)",
              border: `1px solid ${l.active ? `${l.color}40` : "var(--border)"}`,
              fontWeight: 600,
            }}>
              {l.active ? "●" : "○"} {l.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
});

export default UnifiedEditedPreviewPlayer;
