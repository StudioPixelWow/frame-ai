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
  status?: "pending" | "selected" | "rejected";
  instruction?: string;
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

const PIPELINE_STAGES: { key: PipelineStage; label: string; icon: string }[] = [
  { key: "brief", label: "מנתח בריף", icon: "📋" },
  { key: "brand", label: "אוסף מודיעין מותג", icon: "🎨" },
  { key: "director", label: "מנהל קריאייטיב חושב", icon: "🧠" },
  { key: "generating", label: "מייצר תמונה", icon: "✨" },
  { key: "quality", label: "בדיקת איכות", icon: "🔍" },
  { key: "uploading", label: "שומר ומעלה", icon: "💾" },
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
  maxWidth: "64rem",
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

const versionCard: React.CSSProperties = {
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
};

const versionCardSelected: React.CSSProperties = {
  ...versionCard,
  border: "2px solid #22c55e",
  animation: "vgw-glow 2s ease-in-out infinite",
};

const actionBtnBase: React.CSSProperties = {
  border: "none",
  borderRadius: 8,
  padding: "0.35rem 0.9rem",
  fontSize: "0.76rem",
  fontWeight: 700,
  cursor: "pointer",
  transition: "opacity 150ms",
};

const selectBtn: React.CSSProperties = {
  ...actionBtnBase,
  background: "#22c55e",
  color: "#fff",
};

const refineBtn: React.CSSProperties = {
  ...actionBtnBase,
  background: "var(--accent-muted)",
  color: "var(--accent)",
  border: "1px solid var(--accent)",
};

const spinnerStyle: React.CSSProperties = {
  width: 36,
  height: 36,
  border: "3px solid var(--border)",
  borderTopColor: "var(--accent)",
  borderRadius: "50%",
  animation: "vgw-spin 0.8s linear infinite",
};

const errorBox: React.CSSProperties = {
  background: "rgba(239,68,68,0.08)",
  border: "1px solid rgba(239,68,68,0.3)",
  borderRadius: 10,
  padding: "0.65rem 1rem",
  fontSize: "0.8rem",
  color: "#ef4444",
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

  /* state */
  const [selectedPreset, setSelectedPreset] = useState(0);
  const [instruction, setInstruction] = useState("");
  const [quality, setQuality] = useState<"auto" | "low" | "medium" | "high">("auto");
  const [versions, setVersions] = useState<VersionItem[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pipelineStage, setPipelineStage] = useState<PipelineStage>(null);
  const [pipelineDataMap, setPipelineDataMap] = useState<Record<string, PipelineData>>({});
  const [expandedStrategy, setExpandedStrategy] = useState<string | null>(null);
  const [isAutoBriefing, setIsAutoBriefing] = useState(false);

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
      /* silent — first session */
    }
  }, [ganttItemId, fetchVersions]);

  /* load on open */
  useEffect(() => {
    if (open) {
      setError(null);
      loadExistingSessions();
    }
  }, [open, loadExistingSessions]);

  /* ---- Actions ---- */

  const handleGenerate = async (referenceVersionId?: string) => {
    if (isGenerating) return;
    // Allow empty instruction — server-side BRAND_KIT_DIRECTIVE provides fallback

    const preset = SIZE_PRESETS[selectedPreset];
    setIsGenerating(true);
    setError(null);

    // Simulate pipeline stage progression
    // The actual pipeline runs server-side; we show estimated stages
    const stageTimers: ReturnType<typeof setTimeout>[] = [];
    setPipelineStage("brief");
    stageTimers.push(setTimeout(() => setPipelineStage("brand"), 2000));
    stageTimers.push(setTimeout(() => setPipelineStage("director"), 4500));
    stageTimers.push(setTimeout(() => setPipelineStage("generating"), 9000));
    stageTimers.push(setTimeout(() => setPipelineStage("quality"), 25000));
    stageTimers.push(setTimeout(() => setPipelineStage("uploading"), 35000));

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
          ...(referenceVersionId ? { referenceVersionId } : {}),
        }),
      });

      // Clear stage timers
      stageTimers.forEach(clearTimeout);

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "שגיאה ביצירת ויזואל");
      }

      const result = await res.json();

      // Store pipeline data for this version
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
      setError(err.message || "שגיאה ביצירת ויזואל");
    } finally {
      setIsGenerating(false);
      setPipelineStage(null);
    }
  };

  const handleSelectVersion = async (versionId: string) => {
    try {
      const res = await fetch("/api/visual-generation/versions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionId, action: "select" }),
      });
      if (!res.ok) throw new Error("שגיאה בבחירת גרסה");
      if (sessionId) await fetchVersions(sessionId);
    } catch (err: any) {
      setError(err.message || "שגיאה בבחירת גרסה");
    }
  };

  const handleRefine = (versionId: string) => {
    handleGenerate(versionId);
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
      if (data.instruction) {
        setInstruction(data.instruction);
      }
    } catch (err: any) {
      setError(err.message || "שגיאה ביצירת הוראות אוטומטיות");
    } finally {
      setIsAutoBriefing(false);
    }
  };

  /* ---- Render helpers ---- */

  const formatDuration = (ms?: number) => {
    if (!ms) return null;
    return `${(ms / 1000).toFixed(1)} שניות`;
  };

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      style={overlay}
    >
      <div
        style={centerer}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div style={card}>
          {/* ===== Header ===== */}
          <div style={headerBar}>
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
            <button
              onClick={onClose}
              style={closeBtn}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.color = "var(--foreground)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.color = "var(--foreground-muted)";
              }}
              aria-label="סגור"
            >
              &times;
            </button>
          </div>

          {/* ===== Scrollable body ===== */}
          <div style={bodyScroll}>
            {/* --- Size Preset Selector --- */}
            <div>
              <p style={sectionLabel}>גודל פלטפורמה</p>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "0.5rem",
                }}
              >
                {SIZE_PRESETS.map((preset, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedPreset(idx)}
                    style={idx === selectedPreset ? chipSelected : chipDefault}
                    onMouseEnter={(e) => {
                      if (idx !== selectedPreset) {
                        (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (idx !== selectedPreset) {
                        (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
                      }
                    }}
                  >
                    {preset.label}{" "}
                    <span
                      style={{
                        opacity: 0.6,
                        fontSize: "0.68rem",
                        fontWeight: 400,
                      }}
                    >
                      {preset.width}x{preset.height}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* --- Instruction Input --- */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.4rem" }}>
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
                    transition: "all 150ms ease",
                  }}
                  onMouseEnter={(e) => {
                    if (!isAutoBriefing && !isGenerating) {
                      (e.currentTarget as HTMLElement).style.background = "rgba(240,255,2,0.2)";
                      (e.currentTarget as HTMLElement).style.borderColor = "rgba(240,255,2,0.5)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isAutoBriefing && !isGenerating) {
                      (e.currentTarget as HTMLElement).style.background = "rgba(240,255,2,0.1)";
                      (e.currentTarget as HTMLElement).style.borderColor = "rgba(240,255,2,0.3)";
                    }
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
                    <>
                      {"🤖"} AI בנה הוראות
                    </>
                  )}
                </button>
              </div>
              <div
                style={{
                  display: "flex",
                  gap: "0.75rem",
                  alignItems: "flex-start",
                }}
              >
                <textarea
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  placeholder="תאר את הויזואל שאתה רוצה..."
                  rows={3}
                  style={textareaStyle}
                  onFocus={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)";
                  }}
                  onBlur={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
                  }}
                />
                <button
                  onClick={() => handleGenerate()}
                  disabled={isGenerating}
                  style={
                    isGenerating
                      ? generateBtnDisabled
                      : generateBtn
                  }
                  onMouseEnter={(e) => {
                    if (!isGenerating) {
                      (e.currentTarget as HTMLElement).style.opacity = "0.85";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isGenerating) {
                      (e.currentTarget as HTMLElement).style.opacity = "1";
                    }
                  }}
                >
                  {isGenerating ? (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.4rem",
                      }}
                    >
                      <span
                        style={{
                          width: 14,
                          height: 14,
                          border: "2px solid rgba(255,255,255,0.3)",
                          borderTopColor: "#fff",
                          borderRadius: "50%",
                          animation: "vgw-spin 0.8s linear infinite",
                          display: "inline-block",
                        }}
                      />
                      מייצר...
                    </span>
                  ) : (
                    "צור ויזואל"
                  )}
                </button>
              </div>
            </div>

            {/* --- Quality Selector --- */}
            <div>
              <p style={sectionLabel}>איכות</p>
              <div style={{ display: "flex", gap: "0.4rem" }}>
                {QUALITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() =>
                      setQuality(opt.value as "auto" | "low" | "medium" | "high")
                    }
                    style={{
                      ...qualityRadio,
                      background:
                        quality === opt.value
                          ? "var(--accent)"
                          : "var(--surface)",
                      color:
                        quality === opt.value ? "#fff" : "var(--foreground)",
                      borderColor:
                        quality === opt.value
                          ? "var(--accent)"
                          : "var(--border)",
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* --- Error --- */}
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

            {/* --- Pipeline Progress --- */}
            {isGenerating && (
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
                {/* Animated progress bar */}
                <div
                  style={{
                    height: 3,
                    borderRadius: 2,
                    background: "linear-gradient(90deg, transparent 0%, var(--accent) 50%, transparent 100%)",
                    backgroundSize: "200% 100%",
                    animation: "vgw-progress 1.5s ease-in-out infinite",
                  }}
                />
                {/* Stage list */}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                  {PIPELINE_STAGES.map((stage) => {
                    const stageIdx = PIPELINE_STAGES.findIndex((s) => s.key === stage.key);
                    const currentIdx = PIPELINE_STAGES.findIndex((s) => s.key === pipelineStage);
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
                            color: isDone
                              ? "#22c55e"
                              : isActive
                              ? "var(--accent)"
                              : "var(--foreground-muted)",
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
                  איכות לפני מהירות — זה עשוי לקחת עד 2 דקות
                </p>
              </div>
            )}

            {/* --- Version Gallery --- */}
            {versions.length > 0 && (
              <div>
                <p style={sectionLabel}>
                  גרסאות ({versions.length})
                </p>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, 1fr)",
                    gap: "1rem",
                  }}
                >
                  {versions.map((ver) => {
                    const pd = pipelineDataMap[ver.id];
                    const qa = pd?.qualityAssessment;
                    const cs = pd?.creativeStrategy;
                    const isExpanded = expandedStrategy === ver.id;

                    return (
                    <div
                      key={ver.id}
                      style={
                        ver.status === "selected"
                          ? versionCardSelected
                          : versionCard
                      }
                    >
                      {/* Image */}
                      <div
                        style={{
                          position: "relative",
                          background: "var(--surface-raised)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          minHeight: 180,
                        }}
                      >
                        {ver.imageUrl ? (
                          <img
                            src={ver.imageUrl}
                            alt={`גרסה ${ver.versionNumber}`}
                            style={{
                              width: "100%",
                              height: "auto",
                              maxHeight: 320,
                              objectFit: "contain",
                              display: "block",
                            }}
                          />
                        ) : (
                          <span
                            style={{
                              color: "var(--foreground-muted)",
                              fontSize: "0.8rem",
                            }}
                          >
                            אין תמונה
                          </span>
                        )}
                        {/* Version badge */}
                        <span
                          style={{
                            position: "absolute",
                            top: 8,
                            right: 8,
                            background: "rgba(0,0,0,0.65)",
                            color: "#fff",
                            fontSize: "0.68rem",
                            fontWeight: 700,
                            padding: "0.15rem 0.55rem",
                            borderRadius: 999,
                          }}
                        >
                          v{ver.versionNumber}
                        </span>
                        {ver.status === "selected" && (
                          <span
                            style={{
                              position: "absolute",
                              top: 8,
                              left: 8,
                              background: "#22c55e",
                              color: "#fff",
                              fontSize: "0.64rem",
                              fontWeight: 700,
                              padding: "0.15rem 0.5rem",
                              borderRadius: 999,
                            }}
                          >
                            נבחר
                          </span>
                        )}
                        {/* Quality score badge */}
                        {qa && (
                          <span
                            style={{
                              position: "absolute",
                              bottom: 8,
                              right: 8,
                              background: qa.passed ? "rgba(34,197,94,0.85)" : "rgba(239,68,68,0.85)",
                              color: "#fff",
                              fontSize: "0.64rem",
                              fontWeight: 700,
                              padding: "0.15rem 0.55rem",
                              borderRadius: 999,
                              backdropFilter: "blur(4px)",
                            }}
                          >
                            {qa.score}/100
                          </span>
                        )}
                      </div>

                      {/* Info + Actions */}
                      <div
                        style={{
                          padding: "0.65rem 0.85rem",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                          }}
                        >
                          {formatDuration(ver.durationMs) && (
                            <span
                              style={{
                                fontSize: "0.7rem",
                                color: "var(--foreground-muted)",
                              }}
                            >
                              {formatDuration(ver.durationMs)}
                            </span>
                          )}
                          {cs && (
                            <button
                              onClick={() => setExpandedStrategy(isExpanded ? null : ver.id)}
                              style={{
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                fontSize: "0.68rem",
                                fontWeight: 600,
                                color: "var(--accent)",
                                padding: "0.1rem 0.3rem",
                              }}
                            >
                              {isExpanded ? "▲ אסטרטגיה" : "▼ אסטרטגיה"}
                            </button>
                          )}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            gap: "0.45rem",
                          }}
                        >
                          <button
                            onClick={() => handleSelectVersion(ver.id)}
                            style={selectBtn}
                            onMouseEnter={(e) => {
                              (e.currentTarget as HTMLElement).style.opacity = "0.85";
                            }}
                            onMouseLeave={(e) => {
                              (e.currentTarget as HTMLElement).style.opacity = "1";
                            }}
                          >
                            {"✓"} בחר
                          </button>
                          <button
                            onClick={() => handleRefine(ver.id)}
                            disabled={isGenerating}
                            style={{
                              ...refineBtn,
                              ...(isGenerating
                                ? { opacity: 0.5, cursor: "not-allowed" }
                                : {}),
                            }}
                            onMouseEnter={(e) => {
                              if (!isGenerating) {
                                (e.currentTarget as HTMLElement).style.opacity = "0.85";
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!isGenerating) {
                                (e.currentTarget as HTMLElement).style.opacity = "1";
                              }
                            }}
                          >
                            {"←"} שפר
                          </button>
                        </div>
                      </div>

                      {/* Creative Strategy Panel (collapsible) */}
                      {isExpanded && cs && (
                        <div
                          style={{
                            padding: "0.75rem 0.85rem",
                            borderTop: "1px solid var(--border)",
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.4rem",
                            animation: "vgw-stage-enter 0.25s ease",
                          }}
                        >
                          <div style={{ fontSize: "0.72rem", color: "var(--foreground)" }}>
                            <span style={{ fontWeight: 700, color: "var(--accent)" }}>מסר מרכזי: </span>
                            {cs.centralMessage}
                          </div>
                          <div style={{ fontSize: "0.72rem", color: "var(--foreground)" }}>
                            <span style={{ fontWeight: 700, color: "var(--accent)" }}>רעיון קריאייטיבי: </span>
                            {cs.creativeIdea}
                          </div>
                          <div style={{ fontSize: "0.72rem", color: "var(--foreground)" }}>
                            <span style={{ fontWeight: 700, color: "var(--accent)" }}>סגנון: </span>
                            {cs.style}
                          </div>
                          <div style={{ fontSize: "0.72rem", color: "var(--foreground)" }}>
                            <span style={{ fontWeight: 700, color: "var(--accent)" }}>מצב רוח: </span>
                            {cs.mood}
                          </div>
                          {cs.directorNotes && (
                            <div style={{ fontSize: "0.68rem", color: "var(--foreground-muted)", fontStyle: "italic", marginTop: "0.15rem" }}>
                              {cs.directorNotes}
                            </div>
                          )}
                          {/* Quality assessment */}
                          {qa && (
                            <div
                              style={{
                                marginTop: "0.35rem",
                                padding: "0.5rem",
                                borderRadius: 8,
                                background: qa.passed ? "rgba(34,197,94,0.06)" : "rgba(239,68,68,0.06)",
                                border: `1px solid ${qa.passed ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
                              }}
                            >
                              <div style={{ fontSize: "0.7rem", fontWeight: 700, color: qa.passed ? "#22c55e" : "#ef4444", marginBottom: "0.25rem" }}>
                                {qa.passed ? "✓ עבר בדיקת איכות" : "✗ נכשל בבדיקת איכות"} — ציון {qa.score}/100
                              </div>
                              {qa.assessment && (
                                <div style={{ fontSize: "0.68rem", color: "var(--foreground-muted)" }}>
                                  {qa.assessment}
                                </div>
                              )}
                              {qa.issues.length > 0 && (
                                <div style={{ fontSize: "0.66rem", color: "var(--foreground-muted)", marginTop: "0.2rem" }}>
                                  בעיות: {qa.issues.join(" | ")}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Empty state (no versions, not generating) */}
            {versions.length === 0 && !isGenerating && (
              <div
                style={{
                  textAlign: "center",
                  padding: "2rem 1rem",
                  color: "var(--foreground-muted)",
                }}
              >
                <p style={{ margin: 0, fontSize: "0.85rem" }}>
                  עדיין לא נוצרו ויזואלים. הזן הוראה ולחץ על &quot;צור ויזואל&quot; כדי להתחיל.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </dialog>
  );
}
