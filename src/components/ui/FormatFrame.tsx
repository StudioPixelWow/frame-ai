"use client";

import { useRef, useState, useMemo, useCallback, useEffect } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import { PixelManageEdit } from "@/remotion/PixelManageEdit";
import { FPS, FORMAT_DIMENSIONS } from "@/remotion/types";
import type { CompositionProps } from "@/remotion/types";

/* ═══════════════════════════════════════════════════════════════════════════
   FormatFrame — shared preview component
   Renders a properly aspect-ratio-locked video preview.
   Two modes:
     1. "simple" — plain <video> inside a format-frame container
     2. "remotion" — Remotion <Player> with full composition
   ═══════════════════════════════════════════════════════════════════════════ */

export interface FormatFrameProps {
  /** Output format — determines aspect ratio */
  format: "9:16" | "16:9" | "1:1" | "4:5";
  /** Video source URL (blob: or /uploads/...) */
  videoSrc: string;

  /** Mode: "simple" renders a basic video, "remotion" renders Remotion Player */
  mode?: "simple" | "remotion";

  /** Remotion composition props — required when mode="remotion" */
  remotionProps?: Record<string, unknown>;
  /** Duration in seconds — required for Remotion Player */
  durationSec?: number;

  /** Show format badge (e.g. "9:16") */
  showFormatBadge?: boolean;
  /** Show play/pause overlay for simple mode */
  showPlayOverlay?: boolean;
  /** Auto-play video on load (simple mode) */
  autoPlay?: boolean;
  /** Loop video */
  loop?: boolean;
  /** Muted */
  muted?: boolean;
  /** Show native controls (simple mode) */
  controls?: boolean;

  /** Max width override (px). Sensible defaults per format if omitted. */
  maxWidth?: number;
  /** Max height override (px) */
  maxHeight?: number;

  /** Children rendered as overlay on top of the video (e.g. subtitle preview) */
  children?: React.ReactNode;

  /** Additional className on the outer wrapper */
  className?: string;
  /** Additional inline style on the outer wrapper */
  style?: React.CSSProperties;

  /** Ref callback for the inner <video> element (simple mode) */
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  /** Ref callback for the Remotion PlayerRef */
  playerRef?: React.RefObject<PlayerRef | null>;

  /** Callback when video is ready / loaded */
  onReady?: () => void;
  /** Click handler on the frame */
  onClick?: () => void;
}

/** Sensible max-width per format */
const DEFAULT_MAX_WIDTH: Record<string, number> = {
  "9:16": 280,
  "16:9": 640,
  "1:1": 400,
  "4:5": 320,
};

export function FormatFrame({
  format,
  videoSrc,
  mode = "simple",
  remotionProps,
  durationSec = 30,
  showFormatBadge = true,
  showPlayOverlay = true,
  autoPlay = false,
  loop = true,
  muted = true,
  controls = false,
  maxWidth,
  maxHeight,
  children,
  className,
  style,
  videoRef: externalVideoRef,
  playerRef: externalPlayerRef,
  onReady,
  onClick,
}: FormatFrameProps) {
  const internalVideoRef = useRef<HTMLVideoElement>(null);
  const videoEl = externalVideoRef || internalVideoRef;
  const internalPlayerRef = useRef<PlayerRef>(null);
  const playerEl = externalPlayerRef || internalPlayerRef;

  const [videoReady, setVideoReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [playerError, setPlayerError] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);

  const formatClass = `format-frame-${format.replace(":", "")}`;
  const dims = FORMAT_DIMENSIONS[format] || FORMAT_DIMENSIONS["9:16"];
  const effectiveMaxWidth = maxWidth ?? DEFAULT_MAX_WIDTH[format] ?? 320;
  const durationInFrames = Math.max(1, Math.ceil(durationSec * FPS));

  const toggleSimple = useCallback(() => {
    const v = videoEl.current;
    if (!v || !videoReady) return;
    if (v.paused) { v.play().catch(() => {}); setPlaying(true); }
    else { v.pause(); setPlaying(false); }
  }, [videoReady, videoEl]);

  const handleClick = useCallback(() => {
    if (onClick) { onClick(); return; }
    if (mode === "simple") toggleSimple();
  }, [onClick, mode, toggleSimple]);

  /* ── Simple mode ── */
  if (mode === "simple") {
    return (
      <div style={{ maxWidth: effectiveMaxWidth, maxHeight, margin: "0 auto", ...style }} className={className}>
        <div className={`format-frame ${formatClass}`} style={{ position: "relative", cursor: "pointer" }} onClick={handleClick}>
          {videoSrc ? (
            <>
              <video
                ref={videoEl}
                src={videoSrc}
                loop={loop}
                muted={muted}
                playsInline
                controls={controls}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                onLoadedData={() => {
                  setVideoReady(true);
                  setVideoError(null);
                  onReady?.();
                  if (process.env.NODE_ENV === "development") {
                    const v = videoEl.current;
                    console.debug("[FormatFrame:simple] Video loaded:", {
                      src: videoSrc?.substring(0, 80),
                      duration: v?.duration, readyState: v?.readyState,
                      videoWidth: v?.videoWidth, videoHeight: v?.videoHeight,
                      hasVideoTrack: (v?.videoWidth ?? 0) > 0,
                    });
                  }
                  if (autoPlay) videoEl.current?.play().then(() => setPlaying(true)).catch(() => {});
                }}
                onError={(e) => {
                  const v = e.currentTarget;
                  const errMsg = v?.error?.message || `code ${v?.error?.code || "unknown"}`;
                  setVideoError(errMsg);
                  console.error("[FormatFrame:simple] Video error:", errMsg, "src:", videoSrc?.substring(0, 80));
                }}
              />
              {/* Loading overlay — only when video has not loaded yet and no error */}
              {!videoReady && !videoError && (
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.6)", zIndex: 2 }}>
                  <div className="transcript-loading-spinner" />
                </div>
              )}
              {/* Error overlay */}
              {videoError && (
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.75)", zIndex: 2, color: "#fff", padding: "1rem", textAlign: "center" }}>
                  <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>⚠️</div>
                  <div style={{ fontSize: "0.75rem", fontWeight: 600, marginBottom: "0.25rem" }}>שגיאת וידאו</div>
                  <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.6)", maxWidth: 200, wordBreak: "break-all" }}>{videoError}</div>
                  <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.4)", marginTop: "0.5rem", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }}>{videoSrc?.substring(0, 60)}</div>
                </div>
              )}
            </>
          ) : (
            <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "0.5rem" }}>
              <span style={{ fontSize: "2rem", opacity: 0.3 }}>🎬</span>
              <span style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.3)" }}>לא נמצא וידאו</span>
            </div>
          )}

          {/* Format badge */}
          {showFormatBadge && <div className="format-frame-label">{format}</div>}

          {/* Play/Pause overlay */}
          {showPlayOverlay && videoReady && !playing && !controls && (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.2)", zIndex: 1 }}>
              <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(255,255,255,0.15)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem" }}>▶</div>
            </div>
          )}

          {/* Overlay children (subtitle previews, etc.) */}
          {children}
        </div>
      </div>
    );
  }

  /* ── Remotion mode ── */
  return (
    <div style={{ maxWidth: effectiveMaxWidth, maxHeight, margin: "0 auto", ...style }} className={className}>
      <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", border: "1px solid var(--border)", background: "#000" }}>
        {remotionProps && !playerError ? (
          <Player
            ref={playerEl}
            component={PixelManageEdit as unknown as React.FC<Record<string, unknown>>}
            inputProps={remotionProps}
            durationInFrames={durationInFrames}
            compositionWidth={dims.width}
            compositionHeight={dims.height}
            fps={FPS}
            style={{ width: "100%", borderRadius: 12 }}
            controls
            autoPlay={false}
            loop
            clickToPlay
            errorFallback={({ error }) => {
              setPlayerError(true);
              return (
                <div style={{ padding: "2rem", textAlign: "center", color: "#fff", background: "#1a1a2e" }}>
                  <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>⚠️</div>
                  <div style={{ fontWeight: 600, marginBottom: "0.5rem" }}>שגיאה בטעינת הנגן</div>
                  <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.6)", marginBottom: "0.75rem" }}>{error.message}</div>
                  <button className="wiz-btn wiz-btn-primary wiz-btn-sm" onClick={() => setPlayerError(false)}>נסה שוב</button>
                </div>
              );
            }}
            renderLoading={() => (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", background: "#1a1a2e" }}>
                <div className="transcript-loading-spinner" />
                <div style={{ fontSize: "0.85rem", color: "#fff", marginTop: "0.75rem" }}>טוען קומפוזיציה...</div>
              </div>
            )}
          />
        ) : (
          /* Fallback: plain video when Remotion fails or props are missing */
          <div style={{ position: "relative" }}>
            {videoSrc ? (
              <video
                ref={videoEl}
                src={videoSrc}
                controls
                playsInline
                style={{ width: "100%", borderRadius: 12, display: "block" }}
                onLoadedData={() => {
                  setVideoReady(true);
                  setVideoError(null);
                  if (process.env.NODE_ENV === "development") {
                    const v = videoEl.current;
                    console.debug("[FormatFrame:fallback] Video loaded:", {
                      src: videoSrc?.substring(0, 80),
                      duration: v?.duration, readyState: v?.readyState,
                      videoWidth: v?.videoWidth, videoHeight: v?.videoHeight,
                    });
                  }
                }}
                onError={(e) => {
                  const v = e.currentTarget;
                  const errMsg = v?.error?.message || `code ${v?.error?.code || "unknown"}`;
                  setVideoError(errMsg);
                  console.error("[FormatFrame:fallback] Video error:", errMsg, "src:", videoSrc?.substring(0, 80));
                }}
              />
            ) : (
              <div style={{ width: "100%", aspectRatio: `${dims.width}/${dims.height}`, borderRadius: 12, background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "2rem", opacity: 0.3 }}>🎬</span>
                <span style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.3)" }}>לא נמצא וידאו</span>
              </div>
            )}
            <div style={{ position: "absolute", top: 8, left: 8, background: "rgba(255,165,0,0.85)", padding: "2px 8px", borderRadius: 4, fontSize: "0.6rem", color: "#fff", fontWeight: 700, zIndex: 5 }}>
              {playerError ? "FALLBACK" : !remotionProps ? "NO COMP" : "PREVIEW"}
            </div>
            {videoError && (
              <div style={{ position: "absolute", bottom: 40, left: 8, right: 8, background: "rgba(220,38,38,0.9)", padding: "4px 8px", borderRadius: 4, fontSize: "0.6rem", color: "#fff", zIndex: 5 }}>
                Error: {videoError}
              </div>
            )}
            {playerError && (
              <button className="wiz-btn wiz-btn-primary wiz-btn-sm" onClick={() => setPlayerError(false)}
                style={{ position: "absolute", bottom: 8, right: 8, zIndex: 5 }}>
                נסה Remotion שוב
              </button>
            )}
          </div>
        )}

        {/* Format badge */}
        {showFormatBadge && (
          <div className="format-frame-label" style={{ position: "absolute", top: 8, right: 8, zIndex: 5, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", padding: "2px 8px", borderRadius: 4, fontSize: "0.65rem", color: "#fff", fontWeight: 600 }}>
            {format}
          </div>
        )}

        {/* Overlay children */}
        {children}
      </div>
    </div>
  );
}
