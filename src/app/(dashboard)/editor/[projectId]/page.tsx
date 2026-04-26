"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import type {
  VideoEditProject,
  Clip,
  Transition,
  MotionEffect,
  CaptionEntry,
  AIEditDraft,
  SafetyReport,
  TransitionType,
  MotionEffectType,
  StylePackId,
  PacingMode,
} from "@/lib/video-editor/types";
import type { Project } from "@/lib/db/schema";
import { useData } from "@/lib/api/use-data";

import SmartVideoTimeline from "@/components/video-editor/SmartVideoTimeline";
import RenderPreviewPanel from "@/components/video-editor/RenderPreviewPanel";
import TransitionPicker from "@/components/video-editor/TransitionPicker";
import MotionEffectPicker from "@/components/video-editor/MotionEffectPicker";
import StylePackSelector from "@/components/video-editor/StylePackSelector";
import CaptionMotionSelector from "@/components/video-editor/CaptionMotionSelector";
import AutoEditButton from "@/components/video-editor/AutoEditButton";
import AIEditDraftPanel from "@/components/video-editor/AIEditDraftPanel";

/* ═══════════════════════════════════════════════════════════════════════
   INITIALIZATION & HELPER FUNCTIONS
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * Initialize a VideoEditProject from a Project record
 * - If project has segments, create clips from them
 * - Otherwise, create a single clip from the source video
 */
function initializeEditProject(project: Project): VideoEditProject {
  const clips: Clip[] = [];

  if (project.segments && typeof project.segments === "object" && !Array.isArray(project.segments)) {
    const segmentEntries = Object.entries(project.segments);
    let startTime = 0;

    segmentEntries.forEach(([index, segment], idx) => {
      const seg = segment as Record<string, unknown>;
      const duration = typeof seg.duration === "number" ? seg.duration : 5;
      const sourceUrl = typeof seg.sourceUrl === "string" ? seg.sourceUrl : project.sourceVideoKey || "";

      const clip: Clip = {
        id: `clip_${idx}`,
        sourceUrl,
        duration,
        start: startTime,
        end: startTime + duration,
        trimStart: 0,
        trimEnd: duration,
        motionEffect: null,
        captions: [],
        order: idx,
        thumbnailUrl: project.thumbnailUrl || "",
        label: `קליפ ${idx + 1}`,
      };

      clips.push(clip);
      startTime += duration;
    });
  } else if (Array.isArray(project.segments) && project.segments.length > 0) {
    let startTime = 0;

    project.segments.forEach((segment, idx) => {
      const seg = segment as Record<string, unknown>;
      const duration = typeof seg.duration === "number" ? seg.duration : 5;
      const sourceUrl = typeof seg.sourceUrl === "string" ? seg.sourceUrl : project.sourceVideoKey || "";

      const clip: Clip = {
        id: `clip_${idx}`,
        sourceUrl,
        duration,
        start: startTime,
        end: startTime + duration,
        trimStart: 0,
        trimEnd: duration,
        motionEffect: null,
        captions: [],
        order: idx,
        thumbnailUrl: project.thumbnailUrl || "",
        label: `קליפ ${idx + 1}`,
      };

      clips.push(clip);
      startTime += duration;
    });
  } else {
    // Single clip from source video
    const duration = project.duration || project.durationSec || 30;
    clips.push({
      id: "clip_0",
      sourceUrl: project.sourceVideoKey || "",
      duration,
      start: 0,
      end: duration,
      trimStart: 0,
      trimEnd: duration,
      motionEffect: null,
      captions: [],
      order: 0,
      thumbnailUrl: project.thumbnailUrl || "",
      label: "קליפ 1",
    });
  }

  const totalDuration = clips.reduce((sum, clip) => sum + (clip.end - clip.start), 0);

  return {
    id: `edit_${project.id}`,
    projectId: project.id,
    clips,
    transitions: [],
    motions: [],
    captions: [],
    stylePack: null,
    pacing: "medium_commercial",
    beatSync: null,
    aiEditDraft: null,
    zoomLevel: 60,
    playheadPosition: 0,
    totalDuration,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/* ═══════════════════════════════════════════════════════════════════════
   MAIN EDITOR COMPONENT
   ═══════════════════════════════════════════════════════════════════════ */

export default function VideoEditorPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = Array.isArray(params.projectId) ? params.projectId[0] : params.projectId;

  // Data fetching
  const { data: projects, loading, error } = useData<Project>("projects");

  // Find project by ID
  const project = useMemo(() => {
    return projects.find((p) => p.id === projectId);
  }, [projects, projectId]);

  // Initialize edit project state
  const [editProject, setEditProject] = useState<VideoEditProject | null>(null);

  useEffect(() => {
    if (project && !editProject) {
      setEditProject(initializeEditProject(project));
    }
  }, [project, editProject]);

  // UI state
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [hoveredClipId, setHoveredClipId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"transitions" | "motion" | "style" | "captions">(
    "transitions"
  );
  const [showTransitionPicker, setShowTransitionPicker] = useState(false);
  const [transitionClipBoundary, setTransitionClipBoundary] = useState<{
    fromClipId: string;
    toClipId: string;
  } | null>(null);
  const [aiDraft, setAiDraft] = useState<AIEditDraft | null>(null);
  const [safetyReport, setSafetyReport] = useState<SafetyReport | null>(null);

  /* ─────────────────────────────────────────────────────────────────────
     TRANSITION HANDLERS
     ───────────────────────────────────────────────────────────────────── */

  const handleTransitionDiamondClick = useCallback(
    (fromClipId: string, toClipId: string) => {
      setTransitionClipBoundary({ fromClipId, toClipId });
      setShowTransitionPicker(true);
      setActiveTab("transitions");
    },
    []
  );

  const handleSelectTransition = useCallback(
    (transitionType: TransitionType, duration: number) => {
      if (!editProject || !transitionClipBoundary) return;

      const existingIndex = editProject.transitions.findIndex(
        (t) =>
          t.fromClipId === transitionClipBoundary.fromClipId &&
          t.toClipId === transitionClipBoundary.toClipId
      );

      const newTransition: Transition = {
        fromClipId: transitionClipBoundary.fromClipId,
        toClipId: transitionClipBoundary.toClipId,
        type: transitionType,
        duration,
        easing: "ease_in_out",
        intensity: "medium",
        cutType: null,
      };

      setEditProject((prev) => {
        if (!prev) return prev;
        const newTransitions =
          existingIndex >= 0
            ? prev.transitions.map((t, i) => (i === existingIndex ? newTransition : t))
            : [...prev.transitions, newTransition];
        return { ...prev, transitions: newTransitions };
      });

      setShowTransitionPicker(false);
    },
    [editProject, transitionClipBoundary]
  );

  /* ─────────────────────────────────────────────────────────────────────
     MOTION EFFECT HANDLERS
     ───────────────────────────────────────────────────────────────────── */

  const handleSelectMotionEffect = useCallback(
    (motionType: MotionEffectType, intensity: "subtle" | "medium" | "strong") => {
      if (!editProject || !selectedClipId) return;

      const clip = editProject.clips.find((c) => c.id === selectedClipId);
      if (!clip) return;

      const newMotion: MotionEffect = {
        clipId: selectedClipId,
        type: motionType,
        intensity,
        startTime: 0,
        endTime: 1,
      };

      setEditProject((prev) => {
        if (!prev) return prev;
        const clipIndex = prev.clips.findIndex((c) => c.id === selectedClipId);
        if (clipIndex === -1) return prev;

        const newClips = [...prev.clips];
        newClips[clipIndex] = { ...newClips[clipIndex], motionEffect: newMotion };

        return { ...prev, clips: newClips };
      });
    },
    [editProject, selectedClipId]
  );

  /* ─────────────────────────────────────────────────────────────────────
     STYLE PACK HANDLERS
     ───────────────────────────────────────────────────────────────────── */

  const handleSelectStylePack = useCallback((stylePackId: StylePackId) => {
    setEditProject((prev) => {
      if (!prev) return prev;
      return { ...prev, stylePack: stylePackId };
    });
  }, []);

  /* ─────────────────────────────────────────────────────────────────────
     AUTO EDIT & DRAFT HANDLERS
     ───────────────────────────────────────────────────────────────────── */

  const handleAutoEdit = useCallback(() => {
    // Simulate draft generation
    const mockDraft: AIEditDraft = {
      clips: editProject?.clips || [],
      transitions: [
        {
          fromClipId: "clip_0",
          toClipId: "clip_1",
          type: "crossfade",
          duration: 300,
          easing: "ease_in_out",
          intensity: "medium",
          cutType: null,
        },
      ],
      motions: [],
      captions: [],
      stylePack: "premium_real_estate",
      pacing: "medium_commercial",
      reasoning: "קידוד אופטימלי להפקה פרימיום עם מעברים חלקים",
      reasoningHe: "קידוד אופטימלי להפקה פרימיום עם מעברים חלקים",
      confidence: 0.85,
      createdAt: new Date().toISOString(),
    };
    setAiDraft(mockDraft);
  }, [editProject?.clips]);

  const handleAcceptDraft = useCallback(() => {
    if (!aiDraft || !editProject) return;

    setEditProject({
      ...editProject,
      clips: aiDraft.clips,
      transitions: aiDraft.transitions,
      motions: aiDraft.motions,
      captions: aiDraft.captions,
      stylePack: aiDraft.stylePack,
      pacing: aiDraft.pacing,
    });

    setAiDraft(null);
  }, [aiDraft, editProject]);

  const handleRejectDraft = useCallback(() => {
    setAiDraft(null);
  }, []);

  /* ─────────────────────────────────────────────────────────────────────
     SAVE HANDLER
     ───────────────────────────────────────────────────────────────────── */

  const handleSave = useCallback(() => {
    if (!editProject) return;

    const renderConfig = {
      projectId: editProject.projectId,
      clips: editProject.clips,
      transitions: editProject.transitions,
      motions: editProject.motions,
      captions: editProject.captions,
      stylePack: editProject.stylePack,
      pacing: editProject.pacing,
      beatMarkers: editProject.beatSync?.markers || [],
      totalDuration: editProject.totalDuration,
      format: "9:16" as const,
      fps: 30,
      quality: "preview" as const,
    };

    console.log("📹 Saving render config:", renderConfig);

    // Toast-like feedback (simple alert for now)
    const savedMsg = document.createElement("div");
    savedMsg.textContent = "✓ נשמר בהצלחה";
    savedMsg.style.cssText = `
      position: fixed;
      bottom: 2rem;
      right: 2rem;
      background: #10b981;
      color: white;
      padding: 1rem 1.5rem;
      border-radius: 0.5rem;
      z-index: 1000;
      font-weight: 600;
    `;
    document.body.appendChild(savedMsg);
    setTimeout(() => savedMsg.remove(), 3000);
  }, [editProject]);

  /* ─────────────────────────────────────────────────────────────────────
     SELECTED CLIP MEMO
     ───────────────────────────────────────────────────────────────────── */

  const selectedClip = useMemo(() => {
    if (!editProject || !selectedClipId) return null;
    return editProject.clips.find((c) => c.id === selectedClipId);
  }, [editProject, selectedClipId]);

  /* ─────────────────────────────────────────────────────────────────────
     RENDER STATES
     ───────────────────────────────────────────────────────────────────── */

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          fontSize: "1.2rem",
          color: "var(--foreground-muted)",
        }}
      >
        טוען פרויקט...
      </div>
    );
  }

  if (error || !project) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          fontSize: "1.2rem",
          color: "var(--destructive)",
          textAlign: "center",
          padding: "2rem",
        }}
      >
        הפרויקט לא נמצא
      </div>
    );
  }

  if (!editProject) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          fontSize: "1.2rem",
          color: "var(--foreground-muted)",
        }}
      >
        אתחול העורך...
      </div>
    );
  }

  const hasClips = editProject.clips.length > 0;

  return (
    <div className="ved-editor" style={{ direction: "rtl", display: "flex", flexDirection: "column", height: "100vh", backgroundColor: "var(--surface-base)" }}>
      {/* ═══════════════════════════════════════════════════════════════════
          TOP TOOLBAR
          ═══════════════════════════════════════════════════════════════════ */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "1rem 1.5rem",
          borderBottom: "1px solid var(--border)",
          backgroundColor: "var(--surface)",
          gap: "1rem",
        }}
      >
        {/* Back button */}
        <button
          onClick={() => router.push("/projects")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.5rem 0.75rem",
            backgroundColor: "transparent",
            border: "1px solid var(--border)",
            borderRadius: "0.375rem",
            cursor: "pointer",
            fontSize: "0.9rem",
            fontWeight: 500,
            color: "var(--foreground)",
            transition: "all 200ms ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "var(--surface-raised)";
            e.currentTarget.style.borderColor = "var(--accent)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
            e.currentTarget.style.borderColor = "var(--border)";
          }}
        >
          <span>←</span>
          חזור
        </button>

        {/* Project name */}
        <div style={{ flex: 1 }}>
          <h1
            style={{
              fontSize: "1.5rem",
              fontWeight: 700,
              margin: 0,
              color: "var(--foreground)",
            }}
          >
            {project.name}
          </h1>
        </div>

        {/* Zoom controls */}
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <button
            onClick={() =>
              setEditProject((prev) => {
                if (!prev) return prev;
                return { ...prev, zoomLevel: Math.max(20, prev.zoomLevel - 10) };
              })
            }
            style={{
              padding: "0.5rem 0.75rem",
              backgroundColor: "transparent",
              border: "1px solid var(--border)",
              borderRadius: "0.375rem",
              cursor: "pointer",
              fontSize: "0.9rem",
              color: "var(--foreground)",
            }}
          >
            −
          </button>
          <span style={{ fontSize: "0.85rem", minWidth: "3rem", textAlign: "center" }}>
            {editProject.zoomLevel}%
          </span>
          <button
            onClick={() =>
              setEditProject((prev) => {
                if (!prev) return prev;
                return { ...prev, zoomLevel: Math.min(200, prev.zoomLevel + 10) };
              })
            }
            style={{
              padding: "0.5rem 0.75rem",
              backgroundColor: "transparent",
              border: "1px solid var(--border)",
              borderRadius: "0.375rem",
              cursor: "pointer",
              fontSize: "0.9rem",
              color: "var(--foreground)",
            }}
          >
            +
          </button>
        </div>

        {/* Save button */}
        <button
          onClick={handleSave}
          style={{
            padding: "0.625rem 1.25rem",
            backgroundColor: "var(--accent)",
            color: "var(--accent-foreground)",
            border: "none",
            borderRadius: "0.375rem",
            cursor: "pointer",
            fontSize: "0.95rem",
            fontWeight: 600,
            transition: "all 200ms ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = "0.9";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = "1";
          }}
        >
          💾 שמור
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          MAIN EDITOR LAYOUT
          ═══════════════════════════════════════════════════════════════════ */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Left: Preview Panel */}
        <div
          style={{
            flex: "1 1 55%",
            display: "flex",
            flexDirection: "column",
            borderRight: "1px solid var(--border)",
            backgroundColor: "var(--surface-base)",
            overflow: "hidden",
          }}
        >
          {hasClips ? (
            <RenderPreviewPanel
              editProject={editProject}
              selectedClipId={selectedClipId}
              onClipSelect={setSelectedClipId}
            />
          ) : (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flex: 1,
                color: "var(--foreground-muted)",
                fontSize: "1.1rem",
              }}
            >
              אין קליפים — העלה מדיה ליצירת וידאו
            </div>
          )}
        </div>

        {/* Right: Sidebar with Tabs */}
        <div
          style={{
            flex: "0 0 25%",
            display: "flex",
            flexDirection: "column",
            borderLeft: "1px solid var(--border)",
            backgroundColor: "var(--surface)",
            overflow: "hidden",
          }}
        >
          {/* Tab buttons */}
          <div
            style={{
              display: "flex",
              borderBottom: "1px solid var(--border)",
              padding: "0.5rem",
              gap: "0.5rem",
              backgroundColor: "var(--surface-raised)",
            }}
          >
            {[
              { id: "transitions" as const, label: "מעברים" },
              { id: "motion" as const, label: "תנועה" },
              { id: "style" as const, label: "סגנון" },
              { id: "captions" as const, label: "כתוביות" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  flex: 1,
                  padding: "0.625rem 0.5rem",
                  backgroundColor: activeTab === tab.id ? "var(--accent)" : "transparent",
                  color:
                    activeTab === tab.id ? "var(--accent-foreground)" : "var(--foreground)",
                  border: "none",
                  borderRadius: "0.375rem",
                  cursor: "pointer",
                  fontSize: "0.85rem",
                  fontWeight: activeTab === tab.id ? 600 : 500,
                  transition: "all 150ms ease",
                }}
                onMouseEnter={(e) => {
                  if (activeTab !== tab.id) {
                    e.currentTarget.style.backgroundColor = "var(--surface-muted)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeTab !== tab.id) {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div style={{ flex: 1, overflow: "auto", padding: "1rem" }}>
            {activeTab === "transitions" && (
              <div>
                <h3 style={{ margin: "0 0 1rem 0", fontSize: "0.95rem", fontWeight: 600 }}>
                  בחר מעבר
                </h3>
                <TransitionPicker
                  onSelectTransition={handleSelectTransition}
                  selectedClipId={selectedClipId}
                />
                {selectedClip && editProject.clips.length > 1 && (
                  <button
                    onClick={() =>
                      handleTransitionDiamondClick(
                        selectedClipId!,
                        editProject.clips[
                          (editProject.clips.findIndex((c) => c.id === selectedClipId!) + 1) %
                            editProject.clips.length
                        ].id
                      )
                    }
                    style={{
                      width: "100%",
                      padding: "0.75rem",
                      marginTop: "1rem",
                      backgroundColor: "var(--accent-muted)",
                      color: "var(--accent)",
                      border: "none",
                      borderRadius: "0.375rem",
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    הוסף מעבר
                  </button>
                )}
              </div>
            )}

            {activeTab === "motion" && (
              <div>
                <h3 style={{ margin: "0 0 1rem 0", fontSize: "0.95rem", fontWeight: 600 }}>
                  בחר אפקט תנועה
                </h3>
                {selectedClip ? (
                  <MotionEffectPicker
                    onSelectMotion={handleSelectMotionEffect}
                    currentMotion={selectedClip.motionEffect}
                  />
                ) : (
                  <p style={{ color: "var(--foreground-muted)", fontSize: "0.9rem" }}>
                    בחר קליפ כדי להוסיף אפקט תנועה
                  </p>
                )}
              </div>
            )}

            {activeTab === "style" && (
              <div>
                <h3 style={{ margin: "0 0 1rem 0", fontSize: "0.95rem", fontWeight: 600 }}>
                  בחר חבילת סגנון
                </h3>
                <StylePackSelector onSelectStylePack={handleSelectStylePack} />
                {editProject.stylePack && (
                  <div
                    style={{
                      marginTop: "1rem",
                      padding: "0.75rem",
                      backgroundColor: "var(--accent-muted)",
                      borderRadius: "0.375rem",
                      fontSize: "0.9rem",
                    }}
                  >
                    סגנון פעיל: <strong>{editProject.stylePack}</strong>
                  </div>
                )}
              </div>
            )}

            {activeTab === "captions" && (
              <div>
                <h3 style={{ margin: "0 0 1rem 0", fontSize: "0.95rem", fontWeight: 600 }}>
                  אנימציות כתוביות
                </h3>
                {selectedClip && selectedClip.captions.length > 0 ? (
                  <CaptionMotionSelector captions={selectedClip.captions} />
                ) : (
                  <p style={{ color: "var(--foreground-muted)", fontSize: "0.9rem" }}>
                    אין כתוביות בקליפ הנבחר
                  </p>
                )}
              </div>
            )}
          </div>

          {/* AI Draft Panel (if exists) */}
          {aiDraft && (
            <AIEditDraftPanel
              draft={aiDraft}
              onAccept={handleAcceptDraft}
              onReject={handleRejectDraft}
            />
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          BOTTOM TIMELINE
          ═══════════════════════════════════════════════════════════════════ */}
      <div
        style={{
          flex: "0 0 auto",
          borderTop: "1px solid var(--border)",
          backgroundColor: "var(--surface)",
          maxHeight: "300px",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Auto Edit Button */}
        {hasClips && (
          <div style={{ padding: "0.75rem 1.5rem", borderBottom: "1px solid var(--border)" }}>
            <AutoEditButton onAutoEdit={handleAutoEdit} />
          </div>
        )}

        {/* Timeline */}
        {hasClips ? (
          <SmartVideoTimeline
            editProject={editProject}
            selectedClipId={selectedClipId}
            hoveredClipId={hoveredClipId}
            onClipSelect={setSelectedClipId}
            onClipHover={setHoveredClipId}
            onTransitionClick={handleTransitionDiamondClick}
            zoomLevel={editProject.zoomLevel}
          />
        ) : (
          <div
            style={{
              padding: "2rem",
              textAlign: "center",
              color: "var(--foreground-muted)",
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            אין קליפים בעדכון
          </div>
        )}
      </div>
    </div>
  );
}
