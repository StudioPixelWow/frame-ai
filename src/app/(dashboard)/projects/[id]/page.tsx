"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Player, type PlayerRef } from "@remotion/player";
import { PixelManageEdit } from "@/remotion/PixelManageEdit";
import { FPS, FORMAT_DIMENSIONS } from "@/remotion/types";
import { useProjects, useClients } from "@/lib/api/use-entity";
import { useToast } from "@/components/ui/toast";
import { Modal } from "@/components/ui/modal";
import type { Project } from "@/lib/db/schema";
import { compositionToProps } from "@/lib/video-engine/composition-to-props";
import type { FinalCompositionData } from "@/lib/video-engine/composition-data";
import { scoreVideo, generateHooks, predictPerformance, generateReEditSuggestions } from "@/lib/video-engine/ai-scoring";
import type { VideoScore, GeneratedHook, PerformancePrediction, ReEditSuggestion } from "@/lib/video-engine/types";

type ProjectStatus = "draft" | "analysing" | "approved" | "rendering" | "complete" | "failed";
type ProjectFormat = "9:16" | "16:9" | "1:1" | "4:5";

function statusColor(s: string): string {
  const c: Record<string, string> = {
    complete: "#22c55e",
    approved: "#38bdf8",
    rendering: "#fbbf24",
    analysing: "#a78bfa",
    draft: "#6b7280",
    failed: "#f87171",
  };
  return c[s] || "#6b7280";
}

function statusLabel(s: string): string {
  const l: Record<string, string> = {
    draft: "טיוטה",
    analysing: "בניתוח",
    approved: "מאושר",
    rendering: "בייצוא",
    complete: "הושלם",
    failed: "נכשל",
  };
  return l[s] || s;
}

function getWS(ws: Record<string, unknown> | null, key: string, fallback: any = null) {
  if (!ws) return fallback;
  return ws[key] ?? fallback;
}

function fmtDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const months = ["ינו", "פבר", "מרץ", "אפר", "מאי", "יונ", "יול", "אוג", "ספט", "אוק", "נוב", "דצמ"];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function fmtDuration(sec: number | null): string {
  if (!sec || sec <= 0) return "";
  return sec >= 60
    ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`
    : `${sec}s`;
}

function getAspectRatioPadding(format: ProjectFormat): string {
  const ratios: Record<ProjectFormat, string> = {
    "9:16": "177.78%",
    "16:9": "56.25%",
    "1:1": "100%",
    "4:5": "125%",
  };
  return ratios[format] || "56.25%";
}

function scoreColor(score: number): string {
  return score >= 80 ? "#22c55e" : score >= 60 ? "#f59e0b" : score >= 40 ? "#f97316" : "#ef4444";
}

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = (params?.id as string) || "";

  const { data: projects, loading, remove } = useProjects();
  const { data: clients } = useClients();
  const toast = useToast();

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const playerRef = useRef<PlayerRef>(null);

  const project = projects?.find((p) => p.id === id);

  // Extract saved composition data from wizardState
  const savedComposition = useMemo(() => {
    if (!project?.wizardState) return null;
    const ws = project.wizardState as Record<string, any>;
    const compData = ws.compositionData as FinalCompositionData | undefined;
    if (!compData) return null;
    try {
      const remotionProps = compositionToProps(compData);
      const dims = FORMAT_DIMENSIONS[project.format as keyof typeof FORMAT_DIMENSIONS] || FORMAT_DIMENSIONS["9:16"];
      const durationFrames = Math.round((compData.timeline?.durationSec || project.durationSec || 30) * FPS);
      return { remotionProps, dims, durationFrames, compData };
    } catch (e) {
      console.warn("Failed to build remotion props from saved compositionData:", e);
      return null;
    }
  }, [project]);

  const editStateVersion = useMemo(() => {
    if (!project?.wizardState) return 0;
    return (project.wizardState as Record<string, any>).editStateVersion || 0;
  }, [project]);

  const savedActiveLayers = useMemo(() => {
    if (!project?.wizardState) return [];
    return (project.wizardState as Record<string, any>).activeLayers || [];
  }, [project]);

  // ── Video URL resolver — ONLY rendered output, NEVER source ──
  const wsAny = project?.wizardState as Record<string, any> | null;

  const forceStr = (v: unknown): string => {
    if (!v) return "";
    if (typeof v === "string") return v;
    if (typeof v === "object") {
      const o = v as Record<string, any>;
      return o.publicUrl || o.url || o.data?.publicUrl || "";
    }
    return String(v);
  };

  // STRICT priority: rendered output ONLY. Source video is NEVER used for preview/download.
  const videoUrl: string =
    forceStr(project?.renderOutputKey) ||
    forceStr(project?.videoUrl) ||
    "";

  // Debug logs
  if (typeof window !== "undefined" && project) {
    const sourceVideoUrl = forceStr(project?.sourceVideoKey) || forceStr(wsAny?.videoUrl) || forceStr(wsAny?.uploadedVideoUrl) || "";
    console.log(`[project-detail] resolved video url: ${videoUrl || "(empty)"}`);
    console.log(`[project-detail] renderOutputKey=${forceStr(project?.renderOutputKey) || "(empty)"} videoUrl=${forceStr(project?.videoUrl) || "(empty)"} source=${sourceVideoUrl || "(empty)"} status=${project?.status}`);
    if (videoUrl && videoUrl === sourceVideoUrl) {
      console.error("[project-detail] BUG: Active video URL matches source video! Rendered output should differ from source.");
    }
    if (!videoUrl && sourceVideoUrl) {
      console.warn("[project-detail] No rendered output available — video preview is empty. Source exists but is excluded from preview.");
    }
  }

  // AI Analysis
  const aiAnalysis = useMemo(() => {
    if (!project?.wizardState) return null;
    const ws = project.wizardState as Record<string, any>;
    const segments = (ws.segments || []).map((s: any) => ({
      id: s.id || "", startSec: s.startSec || 0, endSec: s.endSec || 0,
      text: s.text || "", edited: s.edited || false,
      highlightWord: s.highlightWord || "", highlightStyle: s.highlightStyle || "color",
    }));
    const durationSec = project.durationSec || 30;
    const format = project.format || "9:16";

    try {
      const score = scoreVideo({
        segments, durationSec, format,
        hasMusic: !!ws.musicEnabled,
        hasBroll: !!ws.brollEnabled,
        preset: ws.preset || project.preset || "",
        subtitleStyle: {
          font: ws.subtitleFont || "Assistant", fontWeight: ws.subtitleFontWeight || 600,
          fontSize: ws.subtitleFontSize || 32, color: ws.subtitleColor || "#FFFFFF",
          highlightColor: ws.subtitleHighlightColor || "#FFD700",
          outlineEnabled: !!ws.subtitleOutlineEnabled, outlineColor: ws.subtitleOutlineColor || "#000",
          outlineThickness: ws.subtitleOutlineThickness || 2, shadow: !!ws.subtitleShadow,
          bgEnabled: !!ws.subtitleBg, bgColor: ws.subtitleBgColor || "#000",
          bgOpacity: ws.subtitleBgOpacity || 65, align: ws.subtitleAlign || "center",
          position: ws.subtitlePosition || "bottom", animation: ws.subtitleAnimation || "none",
          lineBreak: ws.subtitleLineBreak || "auto",
        },
      });

      const hooks = generateHooks({
        segments,
        clientTone: "professional",
        topic: project.name,
        language: (ws.language as string) || "he",
      });
      const performance = predictPerformance({
        score, durationSec, format,
        hasMusic: !!ws.musicEnabled, hasBroll: !!ws.brollEnabled,
        preset: ws.preset || project.preset || "",
      });

      const reEdits = generateReEditSuggestions({
        durationSec, segments,
        preset: ws.preset || project.preset || "",
        format,
      });

      return { score, hooks, performance, reEdits };
    } catch (e) {
      console.warn("AI analysis failed:", e);
      return null;
    }
  }, [project]);

  const handleDelete = async () => {
    if (!project) return;
    setIsDeleting(true);
    try {
      await remove(project.id);
      toast("הפרויקט נמחק בהצלחה", "success");
      router.push("/projects");
    } catch (error) {
      toast(
        error instanceof Error ? error.message : "שגיאה במחיקת הפרויקט",
        "error"
      );
    } finally {
      setIsDeleting(false);
      setDeleteConfirmOpen(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <main style={{ maxWidth: "1400px", margin: "0 auto", padding: "2rem 1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
          <div style={{ color: "var(--foreground-muted)" }}>טוען פרויקט...</div>
        </div>
      </main>
    );
  }

  // Error/Not found state
  if (!project) {
    return (
      <main style={{ maxWidth: "1400px", margin: "0 auto", padding: "2rem 1.5rem" }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "60vh",
            gap: "1.5rem",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "3rem" }}>❌</div>
          <div>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "0.5rem" }}>
              הפרויקט לא נמצא
            </h2>
            <p style={{ color: "var(--foreground-muted)", marginBottom: "1.5rem" }}>
              לא יכולנו למצוא את הפרויקט שחיפשת.
            </p>
          </div>
          <Link
            href="/projects"
            style={{
              display: "inline-block",
              padding: "0.5rem 1.125rem",
              backgroundColor: "var(--accent)",
              color: "white",
              borderRadius: "0.5rem",
              textDecoration: "none",
              fontSize: "0.875rem",
              fontWeight: 600,
            }}
          >
            ← חזור לפרויקטים
          </Link>
        </div>
      </main>
    );
  }

  const ws = project.wizardState as Record<string, unknown> | null;
  const subtitleConfig = getWS(ws, "subtitles", {});
  const musicConfig = getWS(ws, "music", {});
  const brollConfig = getWS(ws, "broll", {});
  const cleanupConfig = getWS(ws, "cleanup", {});
  const creativePrompt = getWS(ws, "creativePrompt", "");

  return (
    <main style={{ maxWidth: "1400px", margin: "0 auto", padding: "2rem 1.5rem" }}>
      {/* Header with Actions */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "2rem",
          gap: "1rem",
        }}
      >
        <h1 style={{ fontSize: "2rem", fontWeight: 700, color: "var(--foreground)", margin: 0 }}>
          {project.name}
        </h1>
        <div className="proj-actions" style={{ display: "flex", gap: "0.5rem", flexShrink: 0 }}>
          {project.status === "draft" && (
            <Link
              href={`/projects/new?id=${project.id}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.375rem",
                padding: "0.5rem 1.125rem",
                backgroundColor: "var(--accent)",
                color: "white",
                borderRadius: "0.5rem",
                textDecoration: "none",
                fontSize: "0.875rem",
                fontWeight: 600,
                border: "none",
                cursor: "pointer",
                transition: "opacity 150ms ease",
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLElement).style.opacity = "0.9";
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLElement).style.opacity = "1";
              }}
            >
              📝 המשך עריכה
            </Link>
          )}
          {(project.sourceVideoKey || wsAny?.videoUrl || wsAny?.uploadedVideoUrl) && (
            <Link
              href={`/editor/${project.id}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.375rem",
                padding: "0.5rem 1.125rem",
                backgroundColor: "#8b5cf6",
                color: "white",
                borderRadius: "0.5rem",
                textDecoration: "none",
                fontSize: "0.875rem",
                fontWeight: 600,
                border: "none",
                cursor: "pointer",
                transition: "opacity 150ms ease",
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLElement).style.opacity = "0.9";
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLElement).style.opacity = "1";
              }}
            >
              🎬 עריכת וידאו מתקדמת
            </Link>
          )}
          {videoUrl && (
            <button
              onClick={() => {
                const isFinal = !!(forceStr(project?.renderOutputKey) || forceStr(project?.videoUrl));
                console.log(`[download] using ${isFinal ? "final" : "source"}: ${videoUrl}`);
                const link = document.createElement("a");
                link.href = videoUrl;
                link.download = `${project.name || "video"}.mp4`;
                link.target = "_blank";
                link.rel = "noopener noreferrer";
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.375rem",
                padding: "0.5rem 1.125rem",
                backgroundColor: "#22c55e",
                color: "white",
                borderRadius: "0.5rem",
                textDecoration: "none",
                fontSize: "0.875rem",
                fontWeight: 600,
                border: "none",
                cursor: "pointer",
                transition: "opacity 150ms ease",
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLElement).style.opacity = "0.9";
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLElement).style.opacity = "1";
              }}
            >
              ⬇ הורד MP4
            </button>
          )}
          <button
            onClick={() => setDeleteConfirmOpen(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.375rem",
              padding: "0.5rem 1.125rem",
              backgroundColor: "transparent",
              color: "#f87171",
              borderRadius: "0.5rem",
              fontSize: "0.875rem",
              fontWeight: 600,
              border: "1px solid #f87171",
              cursor: "pointer",
              transition: "all 150ms ease",
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLButtonElement).style.backgroundColor = "rgba(248, 113, 113, 0.1)";
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLButtonElement).style.backgroundColor = "transparent";
            }}
          >
            🗑 מחק
          </button>
          <Link
            href="/projects"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.375rem",
              padding: "0.5rem 1.125rem",
              backgroundColor: "var(--surface-raised)",
              color: "var(--foreground)",
              borderRadius: "0.5rem",
              textDecoration: "none",
              fontSize: "0.875rem",
              fontWeight: 600,
              border: "1px solid var(--border)",
              transition: "background-color 150ms ease",
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.backgroundColor = "var(--surface)";
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.backgroundColor = "var(--surface-raised)";
            }}
          >
            ← חזור
          </Link>
        </div>
      </div>

      {/* Main Content - Two Column Layout */}
      <div className="proj-layout">
        {/* Left Column - Video Area */}
        <div className="proj-video-area" style={{ display: "flex", flexDirection: "column", gap: "1.5rem", maxWidth: "900px", margin: "0 auto" }}>
          {/* Video Player — simple, direct, always renders if URL exists */}
          {videoUrl ? (
            <div style={{ position: "relative" }}>
              <video
                src={videoUrl}
                controls
                autoPlay
                playsInline
                style={{
                  width: "100%",
                  maxWidth: "900px",
                  borderRadius: "16px",
                  margin: "0 auto",
                  display: "block",
                  backgroundColor: "#1a1a1a",
                }}
              />
              {/* Status Badge */}
              <div style={{
                position: "absolute", top: "1rem", insetInlineStart: "1rem",
                backgroundColor: statusColor(project.status), color: "white",
                padding: "0.375rem 0.875rem", borderRadius: "9999px",
                fontSize: "0.75rem", fontWeight: 600,
              }}>
                {statusLabel(project.status)}
              </div>
              {/* Rendered badge */}
              <div style={{
                position: "absolute", top: "0.75rem", insetInlineEnd: "0.75rem",
                backgroundColor: "rgba(34, 197, 94, 0.9)", color: "white",
                padding: "0.25rem 0.625rem", borderRadius: "6px",
                fontSize: "0.7rem", fontWeight: 700, backdropFilter: "blur(8px)",
              }}>
                פלט מיוצא
              </div>
            </div>
          ) : savedComposition ? (
            <div style={{ position: "relative", borderRadius: "16px", overflow: "hidden", backgroundColor: "#1a1a1a" }}>
              <Player
                ref={playerRef}
                component={PixelManageEdit as unknown as React.FC<Record<string, unknown>>}
                inputProps={savedComposition.remotionProps as unknown as Record<string, unknown>}
                durationInFrames={Math.max(1, savedComposition.durationFrames)}
                compositionWidth={savedComposition.dims.width}
                compositionHeight={savedComposition.dims.height}
                fps={FPS}
                style={{ width: "100%", borderRadius: "16px" }}
                controls
                loop
                autoPlay={false}
              />
            </div>
          ) : (
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              flexDirection: "column", gap: "0.75rem", padding: "4rem 2rem",
              backgroundColor: "#1a1a1a", borderRadius: "16px",
              color: "var(--foreground-muted)",
            }}>
              <div style={{ fontSize: "2rem", opacity: 0.6 }}>🎬</div>
              <div style={{ fontSize: "0.875rem" }}>תצוגה מקדימה של פרויקט</div>
            </div>
          )}
        </div>

          {/* Edit State Info — shown when compositionData is saved */}
          {editStateVersion > 0 && (
            <div
              style={{
                backgroundColor: "var(--surface-raised)",
                border: "1px solid var(--border)",
                borderRadius: "0.75rem",
                padding: "1rem 1.25rem",
                display: "flex",
                alignItems: "center",
                gap: "1rem",
                flexWrap: "wrap",
              }}
            >
              <div style={{ fontSize: "0.75rem", color: "var(--foreground-muted)" }}>
                גרסת עריכה: <span style={{ fontWeight: 700, color: "var(--foreground)" }}>v{editStateVersion}</span>
              </div>
              {savedActiveLayers.length > 0 && (
                <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap" }}>
                  {savedActiveLayers.map((layer: string) => (
                    <span
                      key={layer}
                      style={{
                        fontSize: "0.65rem",
                        padding: "0.125rem 0.5rem",
                        borderRadius: "9999px",
                        backgroundColor: "rgba(167, 139, 250, 0.15)",
                        color: "#a78bfa",
                        fontWeight: 600,
                      }}
                    >
                      {layer}
                    </span>
                  ))}
                </div>
              )}
              {savedComposition && (
                <div style={{ fontSize: "0.7rem", color: "var(--foreground-muted)", marginInlineStart: "auto" }}>
                  {Math.round(savedComposition.compData.timeline.durationSec)}s • {savedComposition.dims.width}×{savedComposition.dims.height}
                </div>
              )}
            </div>
          )}

        {/* Right Column - Project Details */}
        <div className="proj-details" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {/* Header Card */}
          <div
            className="proj-detail-card"
            style={{
              backgroundColor: "var(--surface-raised)",
              border: "1px solid var(--border)",
              borderRadius: "0.75rem",
              padding: "1.5rem",
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <div
                style={{
                  backgroundColor: statusColor(project.status),
                  width: "12px",
                  height: "12px",
                  borderRadius: "50%",
                }}
              />
              <div style={{ flex: 1 }}>
                <div
                  className="proj-detail-label"
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--foreground-muted)",
                    textTransform: "uppercase",
                    fontWeight: 600,
                    marginBottom: "0.25rem",
                  }}
                >
                  סטטוס
                </div>
                <div
                  className="proj-detail-value"
                  style={{ fontSize: "1rem", fontWeight: 600, color: statusColor(project.status) }}
                >
                  {statusLabel(project.status)}
                </div>
              </div>
            </div>
            <div style={{ borderTop: "1px solid var(--border)" }} />
            <div>
              <div
                className="proj-detail-label"
                style={{
                  fontSize: "0.75rem",
                  color: "var(--foreground-muted)",
                  textTransform: "uppercase",
                  fontWeight: 600,
                  marginBottom: "0.25rem",
                }}
              >
                לקוח
              </div>
              <div className="proj-detail-value" style={{ fontSize: "0.95rem" }}>
                {project.clientName || clients?.find((c) => c.id === project.clientId)?.name || "—"}
              </div>
            </div>
          </div>

          {/* General Info Card */}
          <div
            className="proj-detail-card"
            style={{
              backgroundColor: "var(--surface-raised)",
              border: "1px solid var(--border)",
              borderRadius: "0.75rem",
              padding: "1.5rem",
            }}
          >
            <h3
              className="proj-detail-title"
              style={{
                fontSize: "0.9375rem",
                fontWeight: 600,
                marginBottom: "1rem",
                color: "var(--foreground)",
              }}
            >
              מידע כללי
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div className="proj-detail-row" style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="proj-detail-label" style={{ color: "var(--foreground-muted)", fontSize: "0.875rem" }}>
                  פורמט
                </span>
                <span className="proj-detail-value" style={{ fontWeight: 600 }}>
                  {project.format}
                </span>
              </div>
              <div className="proj-detail-row" style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="proj-detail-label" style={{ color: "var(--foreground-muted)", fontSize: "0.875rem" }}>
                  קדם-הגדר
                </span>
                <span className="proj-detail-value" style={{ fontWeight: 600 }}>
                  {project.preset || "—"}
                </span>
              </div>
              <div className="proj-detail-row" style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="proj-detail-label" style={{ color: "var(--foreground-muted)", fontSize: "0.875rem" }}>
                  משך זמן
                </span>
                <span className="proj-detail-value" style={{ fontWeight: 600 }}>
                  {fmtDuration(project.durationSec) || "—"}
                </span>
              </div>
              <div className="proj-detail-row" style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="proj-detail-label" style={{ color: "var(--foreground-muted)", fontSize: "0.875rem" }}>
                  קטעים
                </span>
                <span className="proj-detail-value" style={{ fontWeight: 600 }}>
                  {Array.isArray(project.segments) ? project.segments.length : "—"}
                </span>
              </div>
              <div className="proj-detail-row" style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="proj-detail-label" style={{ color: "var(--foreground-muted)", fontSize: "0.875rem" }}>
                  תאריך יצירה
                </span>
                <span className="proj-detail-value" style={{ fontWeight: 600 }}>
                  {fmtDate(project.createdAt) || "—"}
                </span>
              </div>
            </div>
          </div>

          {/* Subtitles Card */}
          {subtitleConfig && Object.keys(subtitleConfig).length > 0 && (
            <div
              className="proj-detail-card"
              style={{
                backgroundColor: "var(--surface-raised)",
                border: "1px solid var(--border)",
                borderRadius: "0.75rem",
                padding: "1.5rem",
              }}
            >
              <h3
                className="proj-detail-title"
                style={{
                  fontSize: "0.9375rem",
                  fontWeight: 600,
                  marginBottom: "1rem",
                  color: "var(--foreground)",
                }}
              >
                כתוביות
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {(subtitleConfig.mode || subtitleConfig.enabled) && (
                  <div className="proj-detail-row" style={{ display: "flex", justifyContent: "space-between" }}>
                    <span
                      className="proj-detail-label"
                      style={{ color: "var(--foreground-muted)", fontSize: "0.875rem" }}
                    >
                      מצב
                    </span>
                    <span className="proj-detail-value" style={{ fontWeight: 600 }}>
                      {(subtitleConfig.mode as string) || (subtitleConfig.enabled ? "פעיל" : "כבוי")}
                    </span>
                  </div>
                )}
                {subtitleConfig.font && (
                  <div className="proj-detail-row" style={{ display: "flex", justifyContent: "space-between" }}>
                    <span
                      className="proj-detail-label"
                      style={{ color: "var(--foreground-muted)", fontSize: "0.875rem" }}
                    >
                      גופן
                    </span>
                    <span className="proj-detail-value" style={{ fontWeight: 600 }}>
                      {subtitleConfig.font as string}
                    </span>
                  </div>
                )}
                {subtitleConfig.size && (
                  <div className="proj-detail-row" style={{ display: "flex", justifyContent: "space-between" }}>
                    <span
                      className="proj-detail-label"
                      style={{ color: "var(--foreground-muted)", fontSize: "0.875rem" }}
                    >
                      גודל
                    </span>
                    <span className="proj-detail-value" style={{ fontWeight: 600 }}>
                      {subtitleConfig.size}
                    </span>
                  </div>
                )}
                {subtitleConfig.animation && (
                  <div className="proj-detail-row" style={{ display: "flex", justifyContent: "space-between" }}>
                    <span
                      className="proj-detail-label"
                      style={{ color: "var(--foreground-muted)", fontSize: "0.875rem" }}
                    >
                      אנימציה
                    </span>
                    <span className="proj-detail-value" style={{ fontWeight: 600 }}>
                      {subtitleConfig.animation as string}
                    </span>
                  </div>
                )}
                {subtitleConfig.language && (
                  <div className="proj-detail-row" style={{ display: "flex", justifyContent: "space-between" }}>
                    <span
                      className="proj-detail-label"
                      style={{ color: "var(--foreground-muted)", fontSize: "0.875rem" }}
                    >
                      שפה
                    </span>
                    <span className="proj-detail-value" style={{ fontWeight: 600 }}>
                      {subtitleConfig.language as string}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Music Card */}
          {musicConfig && Object.keys(musicConfig).length > 0 && (
            <div
              className="proj-detail-card"
              style={{
                backgroundColor: "var(--surface-raised)",
                border: "1px solid var(--border)",
                borderRadius: "0.75rem",
                padding: "1.5rem",
              }}
            >
              <h3
                className="proj-detail-title"
                style={{
                  fontSize: "0.9375rem",
                  fontWeight: 600,
                  marginBottom: "1rem",
                  color: "var(--foreground)",
                }}
              >
                מוזיקה
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {musicConfig.track && (
                  <div className="proj-detail-row" style={{ display: "flex", justifyContent: "space-between" }}>
                    <span
                      className="proj-detail-label"
                      style={{ color: "var(--foreground-muted)", fontSize: "0.875rem" }}
                    >
                      שיר
                    </span>
                    <span className="proj-detail-value" style={{ fontWeight: 600 }}>
                      {musicConfig.track as string}
                    </span>
                  </div>
                )}
                {musicConfig.volume !== undefined && (
                  <div className="proj-detail-row" style={{ display: "flex", justifyContent: "space-between" }}>
                    <span
                      className="proj-detail-label"
                      style={{ color: "var(--foreground-muted)", fontSize: "0.875rem" }}
                    >
                      עוצמה
                    </span>
                    <span className="proj-detail-value" style={{ fontWeight: 600 }}>
                      {musicConfig.volume}%
                    </span>
                  </div>
                )}
                {musicConfig.ducking !== undefined && (
                  <div className="proj-detail-row" style={{ display: "flex", justifyContent: "space-between" }}>
                    <span
                      className="proj-detail-label"
                      style={{ color: "var(--foreground-muted)", fontSize: "0.875rem" }}
                    >
                      הנמכת עוצמה
                    </span>
                    <span className="proj-detail-value" style={{ fontWeight: 600 }}>
                      {musicConfig.ducking ? "פעיל" : "כבוי"}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* B-Roll Card */}
          {brollConfig && Object.keys(brollConfig).length > 0 && (
            <div
              className="proj-detail-card"
              style={{
                backgroundColor: "var(--surface-raised)",
                border: "1px solid var(--border)",
                borderRadius: "0.75rem",
                padding: "1.5rem",
              }}
            >
              <h3
                className="proj-detail-title"
                style={{
                  fontSize: "0.9375rem",
                  fontWeight: 600,
                  marginBottom: "1rem",
                  color: "var(--foreground)",
                }}
              >
                B-Roll
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {brollConfig.enabled !== undefined && (
                  <div className="proj-detail-row" style={{ display: "flex", justifyContent: "space-between" }}>
                    <span
                      className="proj-detail-label"
                      style={{ color: "var(--foreground-muted)", fontSize: "0.875rem" }}
                    >
                      סטטוס
                    </span>
                    <span className="proj-detail-value" style={{ fontWeight: 600 }}>
                      {brollConfig.enabled ? "מופעל" : "מכובה"}
                    </span>
                  </div>
                )}
                {brollConfig.placements && (
                  <div className="proj-detail-row" style={{ display: "flex", justifyContent: "space-between" }}>
                    <span
                      className="proj-detail-label"
                      style={{ color: "var(--foreground-muted)", fontSize: "0.875rem" }}
                    >
                      מיקומים
                    </span>
                    <span className="proj-detail-value" style={{ fontWeight: 600 }}>
                      {brollConfig.placements}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Cleanup Card */}
          {cleanupConfig && Object.keys(cleanupConfig).length > 0 && (
            <div
              className="proj-detail-card"
              style={{
                backgroundColor: "var(--surface-raised)",
                border: "1px solid var(--border)",
                borderRadius: "0.75rem",
                padding: "1.5rem",
              }}
            >
              <h3
                className="proj-detail-title"
                style={{
                  fontSize: "0.9375rem",
                  fontWeight: 600,
                  marginBottom: "1rem",
                  color: "var(--foreground)",
                }}
              >
                ניקוי
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {cleanupConfig.fillersCleaned !== undefined && (
                  <div className="proj-detail-row" style={{ display: "flex", justifyContent: "space-between" }}>
                    <span
                      className="proj-detail-label"
                      style={{ color: "var(--foreground-muted)", fontSize: "0.875rem" }}
                    >
                      מילויים שנוקו
                    </span>
                    <span className="proj-detail-value" style={{ fontWeight: 600 }}>
                      {cleanupConfig.fillersCleaned}
                    </span>
                  </div>
                )}
                {cleanupConfig.silencesRemoved !== undefined && (
                  <div className="proj-detail-row" style={{ display: "flex", justifyContent: "space-between" }}>
                    <span
                      className="proj-detail-label"
                      style={{ color: "var(--foreground-muted)", fontSize: "0.875rem" }}
                    >
                      דממות שהוסרו
                    </span>
                    <span className="proj-detail-value" style={{ fontWeight: 600 }}>
                      {cleanupConfig.silencesRemoved}
                    </span>
                  </div>
                )}
                {cleanupConfig.intensity && (
                  <div className="proj-detail-row" style={{ display: "flex", justifyContent: "space-between" }}>
                    <span
                      className="proj-detail-label"
                      style={{ color: "var(--foreground-muted)", fontSize: "0.875rem" }}
                    >
                      עוצמה
                    </span>
                    <span className="proj-detail-value" style={{ fontWeight: 600 }}>
                      {cleanupConfig.intensity as string}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Creative Instructions Card */}
          {creativePrompt && (
            <div
              className="proj-detail-card"
              style={{
                backgroundColor: "var(--surface-raised)",
                border: "1px solid var(--border)",
                borderRadius: "0.75rem",
                padding: "1.5rem",
              }}
            >
              <h3
                className="proj-detail-title"
                style={{
                  fontSize: "0.9375rem",
                  fontWeight: 600,
                  marginBottom: "1rem",
                  color: "var(--foreground)",
                }}
              >
                הנחיות יצירתיות
              </h3>
              <p
                className="proj-detail-value"
                style={{
                  fontSize: "0.875rem",
                  lineHeight: 1.6,
                  color: "var(--foreground)",
                  margin: 0,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {creativePrompt as string}
              </p>
            </div>
          )}

          {/* AI Analysis Section */}
          {aiAnalysis && (
            <div style={{ marginTop: "2rem" }}>
              <h3 style={{ fontSize: "1.125rem", fontWeight: 700, marginBottom: "1rem", color: "var(--foreground)" }}>
                ניתוח AI
              </h3>

              {/* Overall Score */}
              <div className="proj-detail-card" style={{ marginBottom: "1rem" }}>
                <div className="proj-detail-title">ציון כולל</div>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1rem" }}>
                  <div style={{
                    width: 64, height: 64, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "1.5rem", fontWeight: 800, color: "white",
                    background: scoreColor(aiAnalysis.score.overall),
                  }}>
                    {aiAnalysis.score.overall}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>
                      {aiAnalysis.score.overall >= 80 ? "מצוין!" : aiAnalysis.score.overall >= 60 ? "טוב" : "יש מקום לשיפור"}
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "var(--foreground-muted)" }}>
                      ציון מבוסס על ניתוח Hook, בהירות, אינגייג׳מנט, קצב ו-CTA
                    </div>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                  {aiAnalysis.score.breakdown.map((b: any) => (
                    <div key={b.category} style={{
                      display: "flex", alignItems: "center", gap: "0.5rem",
                      padding: "0.5rem", borderRadius: 8, background: "var(--surface)",
                    }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: "50%", fontSize: "0.75rem", fontWeight: 700,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: scoreColor(b.score), border: `2px solid ${scoreColor(b.score)}`,
                      }}>
                        {b.score}
                      </div>
                      <div style={{ fontSize: "0.8rem" }}>
                        <div style={{ fontWeight: 600 }}>{b.feedbackHe?.split(" — ")[0] || b.category}</div>
                        <div style={{ color: "var(--foreground-muted)", fontSize: "0.7rem" }}>
                          {b.feedbackHe?.split(" — ")[1] || b.feedback}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Performance Prediction */}
              {aiAnalysis.performance && (
                <div className="proj-detail-card" style={{ marginBottom: "1rem" }}>
                  <div className="proj-detail-title">תחזית ביצועים</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                    {[
                      { label: "אינגייג׳מנט", val: aiAnalysis.performance.engagementPotential },
                      { label: "עצירת גלילה", val: aiAnalysis.performance.scrollStoppingStrength },
                      { label: "ויראליות", val: aiAnalysis.performance.viralityLikelihood },
                      { label: "צפייה עד הסוף", val: aiAnalysis.performance.watchThroughRate },
                    ].map((m) => (
                      <div key={m.label}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: "0.8rem" }}>
                          <span style={{ color: "var(--foreground-muted)" }}>{m.label}</span>
                          <span style={{ fontWeight: 600, color: scoreColor(m.val) }}>{m.val}%</span>
                        </div>
                        <div style={{ height: 6, borderRadius: 3, background: "var(--surface)" }}>
                          <div style={{ height: "100%", borderRadius: 3, width: `${m.val}%`, background: scoreColor(m.val), transition: "width 0.5s" }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  {aiAnalysis.performance.factors.length > 0 && (
                    <div style={{ marginTop: "0.75rem", borderTop: "1px solid var(--border)", paddingTop: "0.75rem" }}>
                      <div style={{ fontSize: "0.75rem", fontWeight: 600, marginBottom: "0.5rem" }}>גורמים משפיעים</div>
                      {aiAnalysis.performance.factors.slice(0, 4).map((f: any, i: number) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.75rem", marginBottom: "0.25rem" }}>
                          <span>{f.impact === "positive" ? "🟢" : f.impact === "negative" ? "🔴" : "🟡"}</span>
                          <span style={{ color: "var(--foreground-muted)" }}>{f.nameHe || f.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* AI Hooks */}
              {aiAnalysis.hooks.length > 0 && (
                <div className="proj-detail-card" style={{ marginBottom: "1rem" }}>
                  <div className="proj-detail-title">Hooks מוצעים</div>
                  {aiAnalysis.hooks.slice(0, 3).map((h: any) => (
                    <div key={h.id} style={{
                      padding: "0.625rem 0.75rem", borderRadius: 8, background: "var(--surface)",
                      marginBottom: "0.5rem",
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontWeight: 600, fontSize: "0.8rem" }}>
                          {h.style === "question" ? "❓" : h.style === "statistic" ? "📊" : h.style === "bold_claim" ? "💥" : h.style === "pain_point" ? "🎯" : "✨"} {h.style}
                        </span>
                        <span style={{ fontSize: "0.7rem", fontWeight: 600, color: scoreColor(h.estimatedStrength * 100) }}>
                          {Math.round(h.estimatedStrength * 100)}%
                        </span>
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "var(--foreground-muted)" }}>{h.text}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Re-Edit Suggestions */}
              {aiAnalysis.reEdits.length > 0 && (
                <div className="proj-detail-card">
                  <div className="proj-detail-title">הצעות לעריכה מחדש</div>
                  {aiAnalysis.reEdits.map((s: any) => (
                    <div key={s.id} style={{
                      padding: "0.625rem 0.75rem", borderRadius: 8, background: "var(--surface)",
                      marginBottom: "0.5rem",
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <span style={{ fontWeight: 600, fontSize: "0.8rem" }}>{s.titleHe || s.title}</span>
                        <span style={{
                          fontSize: "0.65rem", fontWeight: 600, padding: "2px 8px", borderRadius: 10,
                          background: `${scoreColor(s.estimatedImpact * 100)}22`, color: scoreColor(s.estimatedImpact * 100),
                        }}>
                          +{Math.round(s.estimatedImpact * 100)}% השפעה
                        </span>
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--foreground-muted)" }}>{s.descriptionHe || s.description}</div>
                      {s.changes.length > 0 && (
                        <div style={{ marginTop: "0.375rem", display: "flex", flexWrap: "wrap", gap: "0.25rem" }}>
                          {s.changes.map((c: any, i: number) => (
                            <span key={i} style={{
                              fontSize: "0.65rem", padding: "2px 6px", borderRadius: 4,
                              background: "var(--surface-raised)", color: "var(--foreground-muted)",
                            }}>
                              {c.field}: {c.from} → {c.to}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        title="אישור מחיקה"
        footer={
          <>
            <button
              onClick={() => setDeleteConfirmOpen(false)}
              disabled={isDeleting}
              style={{
                padding: "0.5rem 1.125rem",
                backgroundColor: "var(--surface-raised)",
                color: "var(--foreground)",
                border: "1px solid var(--border)",
                borderRadius: "0.5rem",
                fontSize: "0.875rem",
                fontWeight: 600,
                cursor: "pointer",
                transition: "background-color 150ms ease",
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLButtonElement).style.backgroundColor = "var(--surface)";
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLButtonElement).style.backgroundColor = "var(--surface-raised)";
              }}
            >
              ביטול
            </button>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              style={{
                padding: "0.5rem 1.125rem",
                backgroundColor: "#f87171",
                color: "white",
                border: "none",
                borderRadius: "0.5rem",
                fontSize: "0.875rem",
                fontWeight: 600,
                cursor: "pointer",
                transition: "opacity 150ms ease",
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLButtonElement).style.opacity = "0.9";
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLButtonElement).style.opacity = "1";
              }}
            >
              {isDeleting ? "מוחק..." : "מחק"}
            </button>
          </>
        }
      >
        <div style={{ color: "var(--foreground-muted)", marginBottom: "1rem" }}>
          האם אתה בטוח שברצונך למחוק את הפרויקט "{project.name}"? פעולה זו לא ניתנת לביטול.
        </div>
      </Modal>
    </main>
  );
}
