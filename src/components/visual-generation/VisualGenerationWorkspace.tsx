"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface VisualGenerationWorkspaceProps {
  open: boolean;
  onClose: () => void;
  ganttItemId: string;
  clientId: string;
  itemTitle?: string;
}

interface SizePreset {
  label: string;
  width: number;
  height: number;
  platform: string;
  format: string;
}

interface PipelineData {
  creativeStrategy: {
    centralMessage: string;
    creativeIdea: string;
    style: string;
    mood: string;
    directorNotes: string;
  } | null;
  qualityAssessment: {
    passed: boolean;
    score: number;
    issues: string[];
    suggestions: string[];
    assessment: string;
  } | null;
  durationMs: number;
}

interface VersionItem {
  id: string;
  sessionId: string;
  imageUrl: string;
  versionNumber: number;
  durationMs?: number;
  status?: "pending" | "selected" | "rejected" | "completed";
  userInstruction?: string;
  instruction?: string;
  generationMode?: "initial" | "refine" | "single";
  _pipeline?: PipelineData;
}

interface SessionItem {
  id: string;
  ganttItemId: string;
}

type PipelineStage =
  | "brief"
  | "brand"
  | "director"
  | "generating"
  | "quality"
  | "uploading"
  | null;

type WorkspacePhase = "setup" | "choosing" | "chat";

const PIPELINE_STAGES: { key: PipelineStage; label: string; icon: string }[] = [
  { key: "brief", label: "מנתח בריף", icon: "📋" },
  { key: "brand", label: "אוסף מודיעין מותג", icon: "🎨" },
  { key: "director", label: "מנהל קריאייטיב חושב", icon: "🧠" },
  { key: "generating", label: "מייצר תמונות", icon: "✨" },
  { key: "uploading", label: "שומר ומעלה", icon: "💾" },
];

const REFINE_STAGES: { key: PipelineStage; label: string; icon: string }[] = [
  { key: "brief", label: "מנתח הערות", icon: "📝" },
  { key: "director", label: "מנהל קריאייטיב", icon: "🧠" },
  { key: "generating", label: "מייצר שדרוג", icon: "✨" },
  { key: "uploading", label: "שומר", icon: "💾" },
];

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const SIZE_PRESETS: SizePreset[] = [
  { label: "פוסט פייסבוק", width: 1080, height: 1350, platform: "facebook", format: "4:5" },
  { label: "סטורי", width: 1080, height: 1920, platform: "instagram", format: "9:16" },
  { label: "ריבוע", width: 1080, height: 1080, platform: "instagram", format: "1:1" },
  { label: "פיד אינסטגרם", width: 1080, height: 1350, platform: "instagram", format: "4:5" },
  { label: "באנר פייסבוק", width: 1200, height: 628, platform: "facebook", format: "1.91:1" },
  { label: "TikTok", width: 1080, height: 1920, platform: "tiktok", format: "9:16" },
];

const QUALITY_OPTIONS: { value: string; label: string }[] = [
  { value: "auto", label: "אוטומטי" },
  { value: "low", label: "נמוכה" },
  { value: "medium", label: "בינונית" },
  { value: "high", label: "גבוהה" },
];

/* ------------------------------------------------------------------ */
/*  Inline keyframes (injected once)                                   */
/* ------------------------------------------------------------------ */

const KEYFRAMES_ID = "vgw-keyframes";

function ensureKeyframes() {
  if (typeof document === "undefined") return;
  if (document.getElementById(KEYFRAMES_ID)) return;
  const style = document.createElement("style");
  style.id = KEYFRAMES_ID;
  style.textContent = `
    @keyframes vgw-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }
    @keyframes vgw-spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    @keyframes vgw-glow {
      0%, 100% { box-shadow: 0 0 8px rgba(34,197,94,0.4); }
      50% { box-shadow: 0 0 20px rgba(34,197,94,0.7); }
    }
    @keyframes vgw-stage-enter {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes vgw-progress {
      0% { background-position: 100% 0; }
      100% { background-position: -100% 0; }
    }
    @keyframes vgw-chosen-glow {
      0%, 100% { box-shadow: 0 0 12px rgba(0,181,254,0.3); }
      50% { box-shadow: 0 0 30px rgba(0,181,254,0.6); }
    }
  `;
  document.head.appendChild(style);
}

/* ------------------------------------------------------------------ */
/*  Reusable inline style objects                                      */
/* ------------------------------------------------------------------ */

const overlay: React.CSSProperties = {
  display: "block",
  position: "fixed",
  inset: 0,
  width: "100vw",
  height: "100vh",
  padding: 0,
  margin: 0,
  backgroundColor: "rgba(0, 0, 0, 0.5)",
  backdropFilter: "blur(4px)",
  border: "none",
  zIndex: 1000,
};

const centerer: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "1rem",
};

const card: React.CSSProperties = {
  backgroundColor: "var(--surface-raised)",
  borderRadius: "1rem",
  border: "1px solid rgba(0,181,254,0.12)",
  boxShadow:
    "0 40px 100px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,181,254,0.06), 0 0 80px rgba(0,181,254,0.04)",
  maxWidth: "72rem",
  width: "100%",
  maxHeight: "90vh",
  display: "flex",
  flexDirection: "column",
  backdropFilter: "blur(24px) saturate(1.4)",
  WebkitBackdropFilter: "blur(24px) saturate(1.4)",
  direction: "rtl",
};

const headerBar: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "1.25rem 1.5rem",
  borderBottom: "1px solid var(--border)",
};

const closeBtn: React.CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: "0.25rem",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "var(--foreground-muted)",
  transition: "color 150ms ease",
  fontSize: "1.5rem",
  lineHeight: 1,
};

const bodyScroll: React.CSSProperties = {
  flex: 1,
  overflow: "auto",
  padding: "1.5rem",
  display: "flex",
  flexDirection: "column",
  gap: "1.25rem",
};

const sectionLabel: React.CSSProperties = {
  margin: 0,
  fontSize: "0.78rem",
  fontWeight: 700,
  color: "var(--foreground-muted)",
  marginBottom: "0.4rem",
};

const chipBase: React.CSSProperties = {
  padding: "0.35rem 0.85rem",
  borderRadius: 999,
  fontSize: "0.76rem",
  fontWeight: 600,
  cursor: "pointer",
  border: "1px solid var(--border)",
  transition: "background 150ms, color 150ms, border-color 150ms",
  whiteSpace: "nowrap",
};

const chipSelected: React.CSSProperties = {
  ...chipBase,
  background: "var(--accent)",
  color: "#fff",
  borderColor: "var(--accent)",
};

const chipDefault: React.CSSProperties = {
  ...chipBase,
  background: "var(--surface)",
  color: "var(--foreground)",
};

const textareaStyle: React.CSSProperties = {
  flex: 1,
  minHeight: 80,
  resize: "vertical",
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--foreground)",
  padding: "0.65rem 0.85rem",
  fontSize: "0.85rem",
  fontFamily: "inherit",
  direction: "rtl",
  outline: "none",
};

const generateBtn: React.CSSProperties = {
  background: "var(--accent)",
  color: "#fff",
  fontWeight: 800,
  borderRadius: 8,
  padding: "0.5rem 1.5rem",
  border: "none",
  fontSize: "0.85rem",
  cursor: "pointer",
  whiteSpace: "nowrap",
  transition: "opacity 150ms",
};

const generateBtnDisabled: React.CSSProperties = {
  ...generateBtn,
  opacity: 0.55,
  cursor: "not-allowed",
};

const qualityRadio: React.CSSProperties = {
  padding: "0.3rem 0.75rem",
  borderRadius: 999,
  fontSize: "0.72rem",
  fontWeight: 600,
  cursor: "pointer",
  border: "1px solid var(--border)",
  transition: "background 150ms, color 150ms",
};

const errorBox: React.CSSProperties = {
  background: "rgba(239,68,68,0.08)",
  border: "1px solid rgba(239,68,68,0.3)",
  borderRadius: 10,
  padding: "0.65rem 1rem",
  fontSize: "0.8rem",
  color: "#ef4444",
};

const spinnerInline: React.CSSProperties = {
  width: 14,
  height: 14,
  border: "2px solid rgba(255,255,255,0.3)",
  borderTopColor: "#fff",
  borderRadius: "50%",
  animation: "vgw-spin 0.8s linear infinite",
  display: "inline-block",
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function VisualGenerationWorkspace({
  open,
  onClose,
  ganttItemId,
  clientId,
  itemTitle,
}: VisualGenerationWorkspaceProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  /* state */
  const [selectedPreset, setSelectedPreset] = useState(0);
  const [instruction, setInstruction] = useState("");
  const [quality, setQuality] = useState<"auto" | "low" | "medium" | "high">("auto");
  const [versions, setVersions] = useState<VersionItem[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pipelineStage, setPipelineStage] = useState<PipelineStage>(null);
  const [pipelineDataMap, setPipelineDataMap] = useState<Record<string, PipelineData>>({});
  const [isAutoBriefing, setIsAutoBriefing] = useState(false);
  const [chosenVersionId, setChosenVersionId] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState("");

  /* inject keyframes once */
  useEffect(() => {
    ensureKeyframes();
  }, []);

  /* dialog open/close */
  useEffect(() => {
    if (!dialogRef.current) return;
    if (open) {
      dialogRef.current.showModal();
      document.body.style.overflow = "hidden";
    } else {
      dialogRef.current.close();
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  /* escape & backdrop */
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const handleClick = (e: MouseEvent) => {
      if (e.target === dialog) onClose();
    };
    dialog.addEventListener("keydown", handleKey);
    dialog.addEventListener("click", handleClick);
    return () => {
      dialog.removeEventListener("keydown", handleKey);
      dialog.removeEventListener("click", handleClick);
    };
  }, [onClose]);

  /* ---- Derived state ---- */

  const initialVersions = versions.filter(
    (v) => v.generationMode === "initial" || (!v.generationMode && !chosenVersionId)
  );
  const refineVersions = versions.filter((v) => v.generationMode === "refine");
  const chosenVersion = versions.find((v) => v.id === chosenVersionId) || versions.find((v) => v.status === "selected");

  // Determine phase
  let phase: WorkspacePhase = "setup";
  if (versions.length > 0) {
    if (chosenVersionId || chosenVersion) {
      phase = "chat";
    } else {
      phase = "choosing";
    }
  }

  // Auto-detect chosen from DB on load
  useEffect(() => {
    if (!chosenVersionId && versions.length > 0) {
      const selected = versions.find((v) => v.status === "selected");
      if (selected) {
        setChosenVersionId(selected.id);
      }
    }
  }, [versions, chosenVersionId]);

  // Latest version for refinement reference
  const latestRefineVersion =
    refineVersions.length > 0
      ? refineVersions[refineVersions.length - 1]
      : chosenVersion || null;

  /* ---- API helpers ---- */

  const fetchVersions = useCallback(async (sid: string) => {
    try {
      const res = await fetch(`/api/visual-generation/versions?sessionId=${encodeURIComponent(sid)}`);
      if (!res.ok) throw new Error("שגיאה בטעינת גרסאות");
      const data = await res.json();
      setVersions(Array.isArray(data) ? data : data.versions ?? []);
    } catch (err: any) {
      setError(err.message || "שגיאה בטעינת גרסאות");
    }
  }, []);

  const loadExistingSessions = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/visual-generation/sessions?ganttItemId=${encodeURIComponent(ganttItemId)}`
      );
      if (!res.ok) return;
      const data = await res.json();
      const sessions: SessionItem[] = Array.isArray(data) ? data : data.sessions ?? [];
      if (sessions.length > 0) {
        const latest = sessions[sessions.length - 1];
        setSessionId(latest.id);
        await fetchVersions(latest.id);
      }
    } catch {
      /* silent */
    }
  }, [ganttItemId, fetchVersions]);

  /* load on open */
  useEffect(() => {
    if (open) {
      setError(null);
      loadExistingSessions();
    }
  }, [open, loadExistingSessions]);

  /* scroll to bottom of chat when new messages arrive */
  useEffect(() => {
    if (phase === "chat" && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [refineVersions.length, phase]);

  /* ---- Actions ---- */

  // Generate 3 initial options
  const handleGenerateInitial = async () => {
    if (isGenerating) return;
    const preset = SIZE_PRESETS[selectedPreset];
    setIsGenerating(true);
    setError(null);

    const stageTimers: ReturnType<typeof setTimeout>[] = [];
    setPipelineStage("brief");
    stageTimers.push(setTimeout(() => setPipelineStage("brand"), 2000));
    stageTimers.push(setTimeout(() => setPipelineStage("director"), 4500));
    stageTimers.push(setTimeout(() => setPipelineStage("generating"), 9000));
    stageTimers.push(setTimeout(() => setPipelineStage("uploading"), 50000));

    try {
      const res = await fetch("/api/visual-generation/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ganttItemId,
          clientId,
          instruction: instruction.trim(),
          width: preset.width,
          height: preset.height,
          quality,
          mode: "initial",
        }),
      });

      stageTimers.forEach(clearTimeout);

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "שגיאה ביצירת ויזואלים");
      }

      const result = await res.json();

      // Store pipeline data
      if (result._pipeline && result.versions) {
        for (const ver of result.versions) {
          setPipelineDataMap((prev) => ({
            ...prev,
            [ver.id]: result._pipeline,
          }));
        }
      }

      const sid = result.sessionId || sessionId;
      if (sid) {
        setSessionId(sid);
        await fetchVersions(sid);
      }
    } catch (err: any) {
      stageTimers.forEach(clearTimeout);
      setError(err.message || "שגיאה ביצירת ויזואלים");
    } finally {
      setIsGenerating(false);
      setPipelineStage(null);
    }
  };

  // Choose one of the 3 options → enter chat mode
  const handleChooseVersion = async (versionId: string) => {
    setChosenVersionId(versionId);
    // Mark as selected in DB
    try {
      await fetch("/api/visual-generation/versions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionId, status: "selected" }),
      });
      if (sessionId) await fetchVersions(sessionId);
    } catch {
      /* proceed anyway — local state is set */
    }
  };

  // Send a refinement message in chat mode
  const handleChatRefine = async () => {
    const feedback = chatInput.trim();
    if (!feedback || isRefining || !latestRefineVersion) return;

    setIsRefining(true);
    setError(null);
    setChatInput("");

    const stageTimers: ReturnType<typeof setTimeout>[] = [];
    setPipelineStage("brief");
    stageTimers.push(setTimeout(() => setPipelineStage("director"), 2000));
    stageTimers.push(setTimeout(() => setPipelineStage("generating"), 6000));
    stageTimers.push(setTimeout(() => setPipelineStage("uploading"), 35000));

    const preset = SIZE_PRESETS[selectedPreset];

    try {
      const res = await fetch("/api/visual-generation/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ganttItemId,
          clientId,
          instruction: feedback,
          width: preset.width,
          height: preset.height,
          quality,
          mode: "refine",
          selectedVersionId: latestRefineVersion.id,
        }),
      });

      stageTimers.forEach(clearTimeout);

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "שגיאה בשדרוג");
      }

      const result = await res.json();

      if (result._pipeline && result.id) {
        setPipelineDataMap((prev) => ({
          ...prev,
          [result.id]: result._pipeline,
        }));
      }

      const sid = result.sessionId || sessionId;
      if (sid) {
        setSessionId(sid);
        await fetchVersions(sid);
      }
    } catch (err: any) {
      stageTimers.forEach(clearTimeout);
      setError(err.message || "שגיאה בשדרוג");
    } finally {
      setIsRefining(false);
      setPipelineStage(null);
    }
  };

  const handleAutoBrief = async () => {
    if (isAutoBriefing || isGenerating) return;
    setIsAutoBriefing(true);
    setError(null);
    try {
      const res = await fetch("/api/visual-generation/auto-brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ganttItemId, clientId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "שגיאה ביצירת הוראות אוטומטיות");
      }
      const data = await res.json();
      if (data.instruction) setInstruction(data.instruction);
    } catch (err: any) {
      setError(err.message || "שגיאה ביצירת הוראות אוטומטיות");
    } finally {
      setIsAutoBriefing(false);
    }
  };

  // Back to choosing phase
  const handleBackToChoosing = () => {
    setChosenVersionId(null);
    setChatInput("");
  };

  /* ---- Render helpers ---- */

  const formatDuration = (ms?: number) => {
    if (!ms) return null;
    return `${(ms / 1000).toFixed(1)} שניות`;
  };

  const renderPipelineProgress = (stages: typeof PIPELINE_STAGES, label: string) => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
        padding: "1.5rem",
        background: "var(--surface)",
        borderRadius: 12,
        border: "1px solid var(--border)",
      }}
    >
      <div
        style={{
          height: 3,
          borderRadius: 2,
          background: "linear-gradient(90deg, transparent 0%, var(--accent) 50%, transparent 100%)",
          backgroundSize: "200% 100%",
          animation: "vgw-progress 1.5s ease-in-out infinite",
        }}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
        {stages.map((stage) => {
          const stageIdx = stages.findIndex((s) => s.key === stage.key);
          const currentIdx = stages.findIndex((s) => s.key === pipelineStage);
          const isDone = stageIdx < currentIdx;
          const isActive = stage.key === pipelineStage;
          const isPending = stageIdx > currentIdx;

          return (
            <div
              key={stage.key}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.6rem",
                padding: "0.3rem 0.5rem",
                borderRadius: 8,
                background: isActive ? "rgba(0,181,254,0.08)" : "transparent",
                opacity: isPending ? 0.35 : 1,
                transition: "all 300ms ease",
                ...(isActive ? { animation: "vgw-stage-enter 0.3s ease" } : {}),
              }}
            >
              <span style={{ fontSize: "0.85rem", width: 20, textAlign: "center" }}>
                {isDone ? "✓" : stage.icon}
              </span>
              <span
                style={{
                  fontSize: "0.78rem",
                  fontWeight: isActive ? 700 : 500,
                  color: isDone ? "#22c55e" : isActive ? "var(--accent)" : "var(--foreground-muted)",
                }}
              >
                {stage.label}
              </span>
              {isActive && (
                <span
                  style={{
                    width: 10,
                    height: 10,
                    border: "2px solid transparent",
                    borderTopColor: "var(--accent)",
                    borderRadius: "50%",
                    animation: "vgw-spin 0.6s linear infinite",
                    display: "inline-block",
                    marginRight: "auto",
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
      <p
        style={{
          margin: 0,
          fontSize: "0.7rem",
          color: "var(--foreground-muted)",
          textAlign: "center",
          marginTop: "0.25rem",
        }}
      >
        {label}
      </p>
    </div>
  );

  if (!open) return null;

  // ════════════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════════════

  return (
    <dialog ref={dialogRef} style={overlay}>
      <div
        style={centerer}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div style={card}>
          {/* ===== Header ===== */}
          <div style={headerBar}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <h2
                style={{
                  margin: 0,
                  fontSize: "1.15rem",
                  fontWeight: 700,
                  color: "var(--foreground)",
                }}
              >
                {"יצירת ויזואל" + (itemTitle ? ` — ${itemTitle}` : "")}
              </h2>
              {phase === "chat" && (
                <button
                  onClick={handleBackToChoosing}
                  style={{
                    background: "none",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    padding: "0.2rem 0.6rem",
                    fontSize: "0.7rem",
                    fontWeight: 600,
                    color: "var(--foreground-muted)",
                    cursor: "pointer",
                  }}
                >
                  {"←"} חזור לבחירה
                </button>
              )}
            </div>
            <button
              onClick={onClose}
              style={closeBtn}
              aria-label="סגור"
            >
              &times;
            </button>
          </div>

          {/* ===== Scrollable body ===== */}
          <div style={bodyScroll}>
            {/* ──────────────── SETUP PHASE ──────────────── */}
            {phase === "setup" && (
              <>
                {/* Size Preset */}
                <div>
                  <p style={sectionLabel}>גודל פלטפורמה</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                    {SIZE_PRESETS.map((preset, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedPreset(idx)}
                        style={idx === selectedPreset ? chipSelected : chipDefault}
                      >
                        {preset.label}{" "}
                        <span style={{ opacity: 0.6, fontSize: "0.68rem", fontWeight: 400 }}>
                          {preset.width}x{preset.height}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Instruction */}
                <div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: "0.4rem",
                    }}
                  >
                    <p style={{ ...sectionLabel, marginBottom: 0 }}>הוראה ליצירה</p>
                    <button
                      onClick={handleAutoBrief}
                      disabled={isAutoBriefing || isGenerating}
                      style={{
                        background: isAutoBriefing ? "rgba(240,255,2,0.15)" : "rgba(240,255,2,0.1)",
                        color: "var(--neon-yellow)",
                        border: "1px solid rgba(240,255,2,0.3)",
                        borderRadius: 8,
                        padding: "0.3rem 0.75rem",
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        cursor: isAutoBriefing || isGenerating ? "not-allowed" : "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.35rem",
                        opacity: isAutoBriefing || isGenerating ? 0.6 : 1,
                      }}
                    >
                      {isAutoBriefing ? (
                        <>
                          <span
                            style={{
                              width: 12,
                              height: 12,
                              border: "2px solid rgba(240,255,2,0.3)",
                              borderTopColor: "var(--neon-yellow)",
                              borderRadius: "50%",
                              animation: "vgw-spin 0.8s linear infinite",
                              display: "inline-block",
                            }}
                          />
                          חוקר בריף...
                        </>
                      ) : (
                        <>{"🤖"} AI בנה הוראות</>
                      )}
                    </button>
                  </div>
                  <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                    <textarea
                      value={instruction}
                      onChange={(e) => setInstruction(e.target.value)}
                      placeholder="תאר את הויזואל שאתה רוצה..."
                      rows={3}
                      style={textareaStyle}
                    />
                    <button
                      onClick={handleGenerateInitial}
                      disabled={isGenerating}
                      style={isGenerating ? generateBtnDisabled : generateBtn}
                    >
                      {isGenerating ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
                          <span style={spinnerInline} />
                          מייצר...
                        </span>
                      ) : (
                        "צור 3 אפשרויות"
                      )}
                    </button>
                  </div>
                </div>

                {/* Quality */}
                <div>
                  <p style={sectionLabel}>איכות</p>
                  <div style={{ display: "flex", gap: "0.4rem" }}>
                    {QUALITY_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setQuality(opt.value as any)}
                        style={{
                          ...qualityRadio,
                          background: quality === opt.value ? "var(--accent)" : "var(--surface)",
                          color: quality === opt.value ? "#fff" : "var(--foreground)",
                          borderColor: quality === opt.value ? "var(--accent)" : "var(--border)",
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Error */}
            {error && (
              <div style={errorBox}>
                {error}
                <button
                  onClick={() => setError(null)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#ef4444",
                    cursor: "pointer",
                    marginRight: "0.5rem",
                    fontWeight: 700,
                    fontSize: "0.85rem",
                  }}
                >
                  &times;
                </button>
              </div>
            )}

            {/* Pipeline Progress — initial generation */}
            {isGenerating &&
              renderPipelineProgress(
                PIPELINE_STAGES,
                "מייצר 3 אפשרויות שונות — זה עשוי לקחת עד 2 דקות"
              )}

            {/* Pipeline Progress — refinement */}
            {isRefining &&
              renderPipelineProgress(
                REFINE_STAGES,
                "משדרג את הויזואל לפי ההערות שלך..."
              )}

            {/* ──────────────── CHOOSING PHASE ──────────────── */}
            {phase === "choosing" && !isGenerating && (
              <div>
                <p style={{ ...sectionLabel, fontSize: "0.88rem", marginBottom: "0.75rem" }}>
                  בחר את האפשרות המועדפת
                </p>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: `repeat(${Math.min(initialVersions.length, 3)}, 1fr)`,
                    gap: "1rem",
                  }}
                >
                  {initialVersions.map((ver) => (
                    <div
                      key={ver.id}
                      style={{
                        borderRadius: 12,
                        border: "1px solid var(--border)",
                        background: "var(--surface)",
                        overflow: "hidden",
                        display: "flex",
                        flexDirection: "column",
                        cursor: "pointer",
                        transition: "border-color 200ms, box-shadow 200ms",
                      }}
                      onClick={() => handleChooseVersion(ver.id)}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)";
                        (e.currentTarget as HTMLElement).style.boxShadow = "0 0 20px rgba(0,181,254,0.15)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
                        (e.currentTarget as HTMLElement).style.boxShadow = "none";
                      }}
                    >
                      {/* Image */}
                      <div
                        style={{
                          position: "relative",
                          background: "var(--surface-raised)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          minHeight: 200,
                        }}
                      >
                        {ver.imageUrl ? (
                          <img
                            src={ver.imageUrl}
                            alt={`אפשרות ${ver.versionNumber}`}
                            style={{
                              width: "100%",
                              height: "auto",
                              maxHeight: 350,
                              objectFit: "contain",
                              display: "block",
                            }}
                          />
                        ) : (
                          <span style={{ color: "var(--foreground-muted)", fontSize: "0.8rem" }}>
                            אין תמונה
                          </span>
                        )}
                        <span
                          style={{
                            position: "absolute",
                            top: 8,
                            right: 8,
                            background: "rgba(0,0,0,0.65)",
                            color: "#fff",
                            fontSize: "0.72rem",
                            fontWeight: 700,
                            padding: "0.2rem 0.6rem",
                            borderRadius: 999,
                          }}
                        >
                          אפשרות {ver.versionNumber}
                        </span>
                      </div>

                      {/* Choose button */}
                      <div
                        style={{
                          padding: "0.75rem",
                          display: "flex",
                          justifyContent: "center",
                          borderTop: "1px solid var(--border)",
                        }}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleChooseVersion(ver.id);
                          }}
                          style={{
                            background: "var(--accent)",
                            color: "#fff",
                            border: "none",
                            borderRadius: 8,
                            padding: "0.45rem 1.5rem",
                            fontSize: "0.82rem",
                            fontWeight: 700,
                            cursor: "pointer",
                            width: "100%",
                          }}
                        >
                          {"✓"} בחר אפשרות זו
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                {formatDuration(pipelineDataMap[initialVersions[0]?.id]?.durationMs) && (
                  <p
                    style={{
                      margin: 0,
                      marginTop: "0.5rem",
                      fontSize: "0.7rem",
                      color: "var(--foreground-muted)",
                      textAlign: "center",
                    }}
                  >
                    נוצר ב-{formatDuration(pipelineDataMap[initialVersions[0]?.id]?.durationMs)}
                  </p>
                )}
              </div>
            )}

            {/* ──────────────── CHAT PHASE ──────────────── */}
            {phase === "chat" && !isGenerating && (
              <div style={{ display: "flex", gap: "1.25rem", minHeight: 400 }}>
                {/* Left: Selected image (large) */}
                <div
                  style={{
                    flex: "0 0 55%",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.75rem",
                  }}
                >
                  {/* Show latest version (or chosen if no refinements) */}
                  {(() => {
                    const displayVersion =
                      refineVersions.length > 0
                        ? refineVersions[refineVersions.length - 1]
                        : chosenVersion;
                    if (!displayVersion) return null;
                    return (
                      <div
                        style={{
                          borderRadius: 12,
                          border: "2px solid var(--accent)",
                          overflow: "hidden",
                          background: "var(--surface-raised)",
                          animation: "vgw-chosen-glow 3s ease-in-out infinite",
                        }}
                      >
                        <div style={{ position: "relative" }}>
                          {displayVersion.imageUrl && (
                            <img
                              src={displayVersion.imageUrl}
                              alt="גרסה נוכחית"
                              style={{
                                width: "100%",
                                height: "auto",
                                maxHeight: 500,
                                objectFit: "contain",
                                display: "block",
                              }}
                            />
                          )}
                          <span
                            style={{
                              position: "absolute",
                              top: 8,
                              right: 8,
                              background: "var(--accent)",
                              color: "#fff",
                              fontSize: "0.68rem",
                              fontWeight: 700,
                              padding: "0.2rem 0.6rem",
                              borderRadius: 999,
                            }}
                          >
                            {refineVersions.length > 0
                              ? `שדרוג ${refineVersions.length}`
                              : "נבחר"}
                          </span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Thumbnail strip: chosen + all refinements */}
                  {refineVersions.length > 0 && (
                    <div
                      style={{
                        display: "flex",
                        gap: "0.5rem",
                        overflowX: "auto",
                        paddingBottom: "0.25rem",
                      }}
                    >
                      {chosenVersion && (
                        <div
                          style={{
                            width: 60,
                            height: 60,
                            borderRadius: 8,
                            border: "2px solid var(--border)",
                            overflow: "hidden",
                            flexShrink: 0,
                            opacity: 0.7,
                          }}
                        >
                          <img
                            src={chosenVersion.imageUrl}
                            alt="מקור"
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                            }}
                          />
                        </div>
                      )}
                      {refineVersions.map((rv, idx) => (
                        <div
                          key={rv.id}
                          style={{
                            width: 60,
                            height: 60,
                            borderRadius: 8,
                            border:
                              idx === refineVersions.length - 1
                                ? "2px solid var(--accent)"
                                : "2px solid var(--border)",
                            overflow: "hidden",
                            flexShrink: 0,
                          }}
                        >
                          <img
                            src={rv.imageUrl}
                            alt={`שדרוג ${idx + 1}`}
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Right: Chat interface */}
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.75rem",
                    minWidth: 0,
                  }}
                >
                  <p style={{ ...sectionLabel, marginBottom: 0 }}>
                    הערות לשדרוג
                  </p>

                  {/* Chat messages */}
                  <div
                    style={{
                      flex: 1,
                      overflowY: "auto",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.6rem",
                      minHeight: 120,
                      maxHeight: 350,
                      padding: "0.5rem",
                      background: "var(--surface)",
                      borderRadius: 10,
                      border: "1px solid var(--border)",
                    }}
                  >
                    {refineVersions.length === 0 && !isRefining && (
                      <div
                        style={{
                          textAlign: "center",
                          padding: "2rem 1rem",
                          color: "var(--foreground-muted)",
                          fontSize: "0.8rem",
                        }}
                      >
                        <p style={{ margin: 0, marginBottom: "0.35rem" }}>
                          {"💬"} כתוב הערה לשדרוג הויזואל
                        </p>
                        <p style={{ margin: 0, fontSize: "0.72rem", opacity: 0.7 }}>
                          למשל: &quot;יותר ירוק&quot;, &quot;כותרת גדולה יותר&quot;, &quot;רקע בהיר&quot;
                        </p>
                      </div>
                    )}

                    {refineVersions.map((rv) => (
                      <div key={rv.id} style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                        {/* User feedback bubble */}
                        {rv.userInstruction && (
                          <div
                            style={{
                              alignSelf: "flex-start",
                              background: "var(--accent)",
                              color: "#fff",
                              borderRadius: "12px 12px 4px 12px",
                              padding: "0.5rem 0.75rem",
                              fontSize: "0.78rem",
                              maxWidth: "85%",
                            }}
                          >
                            {rv.userInstruction}
                          </div>
                        )}
                        {/* AI response — small image */}
                        <div
                          style={{
                            alignSelf: "flex-end",
                            borderRadius: "12px 12px 12px 4px",
                            border: "1px solid var(--border)",
                            overflow: "hidden",
                            maxWidth: 120,
                          }}
                        >
                          {rv.imageUrl && (
                            <img
                              src={rv.imageUrl}
                              alt={`שדרוג`}
                              style={{
                                width: "100%",
                                height: "auto",
                                display: "block",
                              }}
                            />
                          )}
                        </div>
                        {formatDuration(rv.durationMs) && (
                          <span
                            style={{
                              alignSelf: "flex-end",
                              fontSize: "0.62rem",
                              color: "var(--foreground-muted)",
                            }}
                          >
                            {formatDuration(rv.durationMs)}
                          </span>
                        )}
                      </div>
                    ))}
                    <div ref={chatEndRef} />
                  </div>

                  {/* Refine pipeline mini-progress */}
                  {isRefining && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        padding: "0.5rem 0.75rem",
                        background: "rgba(0,181,254,0.06)",
                        borderRadius: 8,
                        border: "1px solid rgba(0,181,254,0.15)",
                      }}
                    >
                      <span
                        style={{
                          width: 14,
                          height: 14,
                          border: "2px solid rgba(0,181,254,0.3)",
                          borderTopColor: "var(--accent)",
                          borderRadius: "50%",
                          animation: "vgw-spin 0.8s linear infinite",
                          display: "inline-block",
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ fontSize: "0.75rem", color: "var(--accent)", fontWeight: 600 }}>
                        משדרג את הויזואל...
                      </span>
                    </div>
                  )}

                  {/* Chat input */}
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-end" }}>
                    <textarea
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleChatRefine();
                        }
                      }}
                      placeholder="כתוב הערה לשדרוג..."
                      rows={2}
                      style={{
                        ...textareaStyle,
                        minHeight: 50,
                        fontSize: "0.82rem",
                      }}
                    />
                    <button
                      onClick={handleChatRefine}
                      disabled={isRefining || !chatInput.trim()}
                      style={{
                        ...(isRefining || !chatInput.trim() ? generateBtnDisabled : generateBtn),
                        padding: "0.5rem 1rem",
                        fontSize: "0.8rem",
                      }}
                    >
                      {isRefining ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
                          <span style={spinnerInline} />
                        </span>
                      ) : (
                        "שדרג"
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Empty state */}
            {phase === "setup" && versions.length === 0 && !isGenerating && (
              <div
                style={{
                  textAlign: "center",
                  padding: "1.5rem 1rem",
                  color: "var(--foreground-muted)",
                }}
              >
                <p style={{ margin: 0, fontSize: "0.85rem" }}>
                  הזן הוראה ולחץ &quot;צור 3 אפשרויות&quot; — תקבל 3 ויזואלים שונים לבחירה.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </dialog>
  );
}
