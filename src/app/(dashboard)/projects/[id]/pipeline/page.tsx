"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { Project } from "@/lib/db/schema";
import type {
  VideoPipelineState,
  PipelineStatus,
  HookSelection,
  TrimCropData,
  AspectRatio,
  HookRecommendation,
} from "@/lib/video-pipeline/types";

/* ═══════════════════════════════════════════════════════════════════════════
   Constants & Helpers
   ═══════════════════════════════════════════════════════════════════════════ */

const PIPELINE_STEPS = [
  { key: "upload", label: "העלאה ואימות", icon: "📤", description: "העלאת קובץ וידאו ואימות פורמט" },
  { key: "hook", label: "בחירת הוק", icon: "🎯", description: "בחירת רגע הפתיחה הוויראלי" },
  { key: "trim_crop", label: "חיתוך ומיקוד", icon: "✂️", description: "חיתוך זמנים ובחירת יחס גובה-רוחב" },
  { key: "finalize", label: "הכנה סופית", icon: "🔒", description: "נעילת המקור והכנת הקובץ לעריכה" },
  { key: "ai_analysis", label: "ניתוח AI", icon: "🤖", description: "ניתוח חכם — סצנות, רגשות, קצב" },
  { key: "ready", label: "מוכן לעריכה", icon: "🎬", description: "הקובץ מוכן — כניסה לעורך" },
] as const;

type StepKey = (typeof PIPELINE_STEPS)[number]["key"];

function statusToStep(status: PipelineStatus): StepKey {
  const map: Record<string, StepKey> = {
    uploaded: "upload",
    validating: "upload",
    proxy_generating: "upload",
    ready_for_hook_selection: "hook",
    hook_selected: "hook",
    hook_generating: "hook",
    hook_ready: "hook",
    ready_for_trim_crop: "trim_crop",
    trim_crop_selected: "trim_crop",
    pre_edit_generating: "finalize",
    pre_edit_ready: "finalize",
    source_locked: "finalize",
    ai_analysis_running: "ai_analysis",
    editing_ready: "ready",
    editing: "ready",
    rendering: "ready",
    exporting: "ready",
    completed: "ready",
    failed: "upload",
    blocked_invalid_source: "upload",
  };
  return map[status] || "upload";
}

function stepIndex(key: StepKey): number {
  return PIPELINE_STEPS.findIndex((s) => s.key === key);
}

function isStepCompleted(currentStep: StepKey, checkStep: StepKey): boolean {
  return stepIndex(currentStep) > stepIndex(checkStep);
}

function isStepActive(currentStep: StepKey, checkStep: StepKey): boolean {
  return currentStep === checkStep;
}

const STATUS_LABELS: Record<string, string> = {
  uploaded: "הועלה",
  validating: "מאמת...",
  proxy_generating: "יוצר פרוקסי...",
  ready_for_hook_selection: "ממתין לבחירת הוק",
  hook_selected: "הוק נבחר",
  hook_generating: "יוצר וידאו הוק...",
  hook_ready: "הוק מוכן",
  ready_for_trim_crop: "ממתין לחיתוך",
  trim_crop_selected: "חיתוך הושלם",
  pre_edit_generating: "מכין קובץ סופי...",
  pre_edit_ready: "קובץ סופי מוכן",
  source_locked: "מקור ננעל",
  ai_analysis_running: "ניתוח AI פעיל...",
  editing_ready: "מוכן לעריכה",
  editing: "בעריכה",
  completed: "הושלם",
  failed: "נכשל",
  blocked_invalid_source: "חסום — מקור לא תקין",
};

/* ═══════════════════════════════════════════════════════════════════════════
   Main Page Component
   ═══════════════════════════════════════════════════════════════════════════ */

export default function PipelinePage() {
  const params = useParams();
  const router = useRouter();
  const projectId = (params?.id as string) || "";

  // ── State ──
  const [project, setProject] = useState<Project | null>(null);
  const [pipeline, setPipeline] = useState<VideoPipelineState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // ── Hook Selection State ──
  const [hookStart, setHookStart] = useState(0);
  const [hookEnd, setHookEnd] = useState(3);
  const [hookRecommendations, setHookRecommendations] = useState<HookRecommendation[]>([]);

  // ── Trim & Crop State ──
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [cropX, setCropX] = useState(0);
  const [cropY, setCropY] = useState(0);
  const [cropWidth, setCropWidth] = useState(100);
  const [cropHeight, setCropHeight] = useState(100);
  const [targetAspectRatio, setTargetAspectRatio] = useState<AspectRatio>("9:16");

  // ── Load Project ──
  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/data/projects/${projectId}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject("Project not found")))
      .then((data) => setProject(data))
      .catch((err) => setError(typeof err === "string" ? err : "שגיאה בטעינת פרויקט"));
  }, [projectId]);

  // ── Load / Initialize Pipeline ──
  const loadPipeline = useCallback(async () => {
    if (!projectId) return;
    try {
      const res = await fetch(`/api/video-pipeline/${projectId}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.pipelineStatus) {
          setPipeline(data);
          // Sync trim defaults from project duration
          if (data.pipelineStatus === "uploaded" && project?.durationSec) {
            setTrimEnd(project.durationSec);
          }
        }
      }
    } catch {
      // Pipeline might not exist yet — that's fine
    } finally {
      setLoading(false);
    }
  }, [projectId, project?.durationSec]);

  useEffect(() => {
    if (project) loadPipeline();
  }, [project, loadPipeline]);

  // ── Initialize Pipeline ──
  const initPipeline = async () => {
    if (!project) return;
    setActionLoading(true);
    setError(null);
    try {
      const sourceVideoKey = project.sourceVideoKey || (project as any).wizardState?.uploadedVideoUrl || "";
      if (!sourceVideoKey) {
        setError("לא נמצא קובץ וידאו מקורי בפרויקט");
        return;
      }
      const res = await fetch(`/api/video-pipeline/${projectId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ originalVideoId: sourceVideoKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "שגיאה באתחול הצינור");
      setPipeline(data);
    } catch (err: any) {
      setError(err.message || "שגיאה באתחול");
    } finally {
      setActionLoading(false);
    }
  };

  // ── Submit Hook Selection ──
  const submitHook = async () => {
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/video-pipeline/${projectId}/hook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startTime: hookStart,
          endTime: hookEnd,
          duration: hookEnd - hookStart,
          aiRecommended: false,
          viralScore: 0,
          engagementScore: 0,
          confidenceScore: 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "שגיאה בשמירת הוק");
      setPipeline(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // ── Skip Hook ──
  const skipHook = async () => {
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/video-pipeline/${projectId}/hook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startTime: 0,
          endTime: 0,
          duration: 0,
          aiRecommended: false,
          skipped: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "שגיאה בדילוג על הוק");
      setPipeline(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // ── Submit Trim & Crop ──
  const submitTrimCrop = async () => {
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/video-pipeline/${projectId}/trim-crop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trimStart,
          trimEnd,
          cropX,
          cropY,
          cropWidth,
          cropHeight,
          targetAspectRatio,
          faceTrackingEnabled: false,
          subjectTrackingEnabled: false,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "שגיאה בחיתוך");
      setPipeline(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // ── Skip Trim & Crop ──
  const skipTrimCrop = async () => {
    setActionLoading(true);
    setError(null);
    try {
      const duration = project?.durationSec || 30;
      const res = await fetch(`/api/video-pipeline/${projectId}/trim-crop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trimStart: 0,
          trimEnd: duration,
          cropX: 0,
          cropY: 0,
          cropWidth: 100,
          cropHeight: 100,
          targetAspectRatio: (project?.format as AspectRatio) || "9:16",
          faceTrackingEnabled: false,
          subjectTrackingEnabled: false,
          skipped: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "שגיאה בדילוג על חיתוך");
      setPipeline(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // ── Finalize (Lock Source) ──
  const finalize = async () => {
    setActionLoading(true);
    setError(null);
    try {
      const finalVideoId = pipeline?.trimCropVideoId || pipeline?.hookGeneratedVideoId || pipeline?.originalVideoId || "";
      const res = await fetch(`/api/video-pipeline/${projectId}/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ finalVideoId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "שגיאה בנעילת מקור");
      setPipeline(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // ── Start AI Analysis ──
  const startAnalysis = async () => {
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/video-pipeline/${projectId}/ai-analysis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceVideoId: pipeline?.finalPreEditVideoId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "שגיאה בהפעלת ניתוח AI");
      setPipeline(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // ── Skip AI Analysis ──
  const skipAnalysis = async () => {
    // Directly mark as editing ready by updating pipeline
    setActionLoading(true);
    setError(null);
    try {
      // Use validate-source to check, then navigate to editor
      setPipeline((prev) =>
        prev ? { ...prev, aiAnalysisStatus: "skipped", pipelineStatus: "editing_ready" } : prev,
      );
      router.push(`/editor/${projectId}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // ── Go To Editor ──
  const goToEditor = () => {
    router.push(`/editor/${projectId}`);
  };

  // ── Derived State ──
  const currentStep = useMemo<StepKey>(() => {
    if (!pipeline) return "upload";
    return statusToStep(pipeline.pipelineStatus);
  }, [pipeline]);

  const statusLabel = pipeline ? STATUS_LABELS[pipeline.pipelineStatus] || pipeline.pipelineStatus : "";

  // ── Render ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0a0f" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 48, height: 48, border: "3px solid rgba(0,245,255,0.3)", borderTop: "3px solid #00f5ff", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 16px" }} />
          <p style={{ color: "#94a3b8", fontSize: 14 }}>טוען צינור עיבוד...</p>
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" style={{ minHeight: "100vh", background: "#0a0a0f", color: "#e2e8f0", padding: "24px 32px" }}>
      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 32 }}>
        <Link
          href={`/projects/${projectId}`}
          style={{ color: "#00f5ff", textDecoration: "none", fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}
        >
          ← חזרה לפרויקט
        </Link>
        <div style={{ flex: 1 }} />
        {pipeline && (
          <span
            style={{
              padding: "6px 16px",
              borderRadius: 20,
              fontSize: 13,
              fontWeight: 600,
              background: pipeline.sourceLocked ? "rgba(34,197,94,0.15)" : "rgba(0,245,255,0.1)",
              color: pipeline.sourceLocked ? "#22c55e" : "#00f5ff",
              border: `1px solid ${pipeline.sourceLocked ? "rgba(34,197,94,0.3)" : "rgba(0,245,255,0.2)"}`,
            }}
          >
            {pipeline.sourceLocked ? "🔒 מקור נעול" : statusLabel}
          </span>
        )}
      </div>

      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>
        צינור עיבוד וידאו {project?.name ? `— ${project.name}` : ""}
      </h1>
      <p style={{ color: "#64748b", marginBottom: 32, fontSize: 14 }}>
        הצינור מנחה אותך בשלבים מ-העלאה ועד לעריכה. כל שלב מייצר גרסת וידאו חדשה.
      </p>

      {/* ── Error Banner ── */}
      {error && (
        <div
          style={{
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: 12,
            padding: "12px 20px",
            marginBottom: 24,
            color: "#f87171",
            fontSize: 14,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          ⚠️ {error}
          <button
            onClick={() => setError(null)}
            style={{ marginRight: "auto", background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: 18 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Step Progress Bar ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 40, padding: "0 20px" }}>
        {PIPELINE_STEPS.map((step, i) => {
          const completed = isStepCompleted(currentStep, step.key);
          const active = isStepActive(currentStep, step.key);
          return (
            <div key={step.key} style={{ display: "flex", alignItems: "center", flex: 1 }}>
              {/* Step circle */}
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 18,
                  fontWeight: 700,
                  flexShrink: 0,
                  background: completed
                    ? "linear-gradient(135deg, #22c55e, #16a34a)"
                    : active
                      ? "linear-gradient(135deg, #00f5ff, #0ea5e9)"
                      : "rgba(255,255,255,0.05)",
                  color: completed || active ? "#fff" : "#64748b",
                  border: active ? "2px solid #00f5ff" : "2px solid transparent",
                  boxShadow: active ? "0 0 20px rgba(0,245,255,0.3)" : "none",
                  transition: "all 0.3s ease",
                }}
              >
                {completed ? "✓" : step.icon}
              </div>

              {/* Step label */}
              <div style={{ marginRight: 8, minWidth: 70 }}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: active ? 700 : 500,
                    color: completed ? "#22c55e" : active ? "#00f5ff" : "#64748b",
                    whiteSpace: "nowrap",
                  }}
                >
                  {step.label}
                </div>
              </div>

              {/* Connector line */}
              {i < PIPELINE_STEPS.length - 1 && (
                <div
                  style={{
                    flex: 1,
                    height: 2,
                    background: completed
                      ? "linear-gradient(90deg, #22c55e, #22c55e)"
                      : "rgba(255,255,255,0.1)",
                    margin: "0 8px",
                    borderRadius: 1,
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* ── Step Content ── */}
      <div
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 16,
          padding: 32,
          minHeight: 300,
        }}
      >
        {/* ──── STEP: UPLOAD ──── */}
        {currentStep === "upload" && !pipeline && (
          <div style={{ textAlign: "center", maxWidth: 500, margin: "0 auto" }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>📤</div>
            <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>התחלת צינור עיבוד</h2>
            <p style={{ color: "#94a3b8", marginBottom: 24, lineHeight: 1.6 }}>
              לחץ כדי לאתחל את צינור העיבוד עבור הוידאו של הפרויקט.
              הצינור ינחה אותך דרך כל שלב עד שהקובץ מוכן לעריכה.
            </p>
            {project?.sourceVideoKey ? (
              <button onClick={initPipeline} disabled={actionLoading} style={btnPrimary(actionLoading)}>
                {actionLoading ? "מאתחל..." : "🚀 התחל צינור עיבוד"}
              </button>
            ) : (
              <div style={{ color: "#f59e0b", fontSize: 14 }}>
                ⚠️ לא נמצא וידאו מקורי בפרויקט — יש להעלות וידאו תחילה
              </div>
            )}
          </div>
        )}

        {currentStep === "upload" && pipeline && (
          <div style={{ textAlign: "center", maxWidth: 500, margin: "0 auto" }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
            <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>הוידאו הועלה בהצלחה</h2>
            <p style={{ color: "#94a3b8", marginBottom: 8 }}>
              מזהה מקור: <code style={{ color: "#00f5ff", fontSize: 12 }}>{pipeline.originalVideoId?.slice(0, 30)}...</code>
            </p>
            <p style={{ color: "#94a3b8", marginBottom: 24 }}>
              המשך לשלב הבא — בחירת הוק או דילוג.
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button
                onClick={() =>
                  setPipeline((prev) =>
                    prev ? { ...prev, pipelineStatus: "ready_for_hook_selection" } : prev,
                  )
                }
                style={btnPrimary(false)}
              >
                ← המשך לבחירת הוק
              </button>
            </div>
          </div>
        )}

        {/* ──── STEP: HOOK SELECTION ──── */}
        {currentStep === "hook" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
              <span style={{ fontSize: 32 }}>🎯</span>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>בחירת הוק — רגע הפתיחה</h2>
                <p style={{ color: "#94a3b8", fontSize: 13, margin: 0 }}>
                  בחר את הרגע הכי חזק לפתיחה. ה-AI יכול להמליץ על הרגע הוויראלי ביותר.
                </p>
              </div>
              <div style={{ flex: 1 }} />
              <button onClick={skipHook} disabled={actionLoading} style={btnSecondary(actionLoading)}>
                דלג על הוק ←
              </button>
            </div>

            {/* Hook selector form */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              <div style={cardStyle}>
                <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>⏱️ טווח זמנים</h3>
                <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
                  <label style={labelStyle}>
                    התחלה (שניות)
                    <input
                      type="number"
                      value={hookStart}
                      onChange={(e) => setHookStart(Number(e.target.value))}
                      min={0}
                      step={0.1}
                      style={inputStyle}
                    />
                  </label>
                  <label style={labelStyle}>
                    סיום (שניות)
                    <input
                      type="number"
                      value={hookEnd}
                      onChange={(e) => setHookEnd(Number(e.target.value))}
                      min={0}
                      step={0.1}
                      style={inputStyle}
                    />
                  </label>
                </div>
                <p style={{ color: "#64748b", fontSize: 13 }}>
                  אורך הוק: <strong style={{ color: "#00f5ff" }}>{(hookEnd - hookStart).toFixed(1)}s</strong>
                </p>
                <button onClick={submitHook} disabled={actionLoading || hookEnd <= hookStart} style={btnPrimary(actionLoading)}>
                  {actionLoading ? "שומר..." : "✓ אישור הוק"}
                </button>
              </div>

              <div style={cardStyle}>
                <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>🤖 המלצות AI</h3>
                {hookRecommendations.length > 0 ? (
                  hookRecommendations.map((rec, i) => (
                    <div
                      key={i}
                      onClick={() => {
                        setHookStart(rec.startTime);
                        setHookEnd(rec.endTime);
                      }}
                      style={{
                        padding: "10px 14px",
                        borderRadius: 8,
                        background: "rgba(0,245,255,0.05)",
                        border: "1px solid rgba(0,245,255,0.15)",
                        marginBottom: 8,
                        cursor: "pointer",
                        transition: "all 0.2s",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>
                          {rec.startTime.toFixed(1)}s – {rec.endTime.toFixed(1)}s
                        </span>
                        <span style={{ color: "#22c55e", fontSize: 13, fontWeight: 700 }}>
                          {rec.score}%
                        </span>
                      </div>
                      <p style={{ color: "#94a3b8", fontSize: 12, margin: 0 }}>{rec.reason}</p>
                    </div>
                  ))
                ) : (
                  <p style={{ color: "#64748b", fontSize: 13, textAlign: "center", padding: "20px 0" }}>
                    המלצות AI יופיעו כאן לאחר ניתוח הוידאו.<br />
                    ניתן לבחור ידנית בינתיים.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ──── STEP: TRIM & CROP ──── */}
        {currentStep === "trim_crop" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
              <span style={{ fontSize: 32 }}>✂️</span>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>חיתוך ומיקוד</h2>
                <p style={{ color: "#94a3b8", fontSize: 13, margin: 0 }}>
                  הגדר את טווח הזמנים ואזור המיקוד. בחר יחס גובה-רוחב ליעד.
                </p>
              </div>
              <div style={{ flex: 1 }} />
              <button onClick={skipTrimCrop} disabled={actionLoading} style={btnSecondary(actionLoading)}>
                דלג ←
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              {/* Time trim */}
              <div style={cardStyle}>
                <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>⏱️ חיתוך זמנים</h3>
                <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
                  <label style={labelStyle}>
                    התחלה (שניות)
                    <input type="number" value={trimStart} onChange={(e) => setTrimStart(Number(e.target.value))} min={0} step={0.1} style={inputStyle} />
                  </label>
                  <label style={labelStyle}>
                    סיום (שניות)
                    <input type="number" value={trimEnd} onChange={(e) => setTrimEnd(Number(e.target.value))} min={0} step={0.1} style={inputStyle} />
                  </label>
                </div>
                <p style={{ color: "#64748b", fontSize: 13 }}>
                  אורך סופי: <strong style={{ color: "#00f5ff" }}>{(trimEnd - trimStart).toFixed(1)}s</strong>
                </p>
              </div>

              {/* Aspect ratio */}
              <div style={cardStyle}>
                <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>📐 יחס גובה-רוחב</h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                  {(["9:16", "1:1", "4:5", "16:9", "free"] as AspectRatio[]).map((ar) => (
                    <button
                      key={ar}
                      onClick={() => setTargetAspectRatio(ar)}
                      style={{
                        padding: "12px 8px",
                        borderRadius: 10,
                        border: targetAspectRatio === ar ? "2px solid #00f5ff" : "1px solid rgba(255,255,255,0.1)",
                        background: targetAspectRatio === ar ? "rgba(0,245,255,0.1)" : "rgba(255,255,255,0.03)",
                        color: targetAspectRatio === ar ? "#00f5ff" : "#94a3b8",
                        cursor: "pointer",
                        fontSize: 14,
                        fontWeight: 600,
                        transition: "all 0.2s",
                      }}
                    >
                      {ar === "free" ? "חופשי" : ar}
                      <div style={{ fontSize: 10, marginTop: 4, color: "#64748b" }}>
                        {ar === "9:16" ? "סטורי/ריל" : ar === "1:1" ? "ריבוע" : ar === "4:5" ? "פיד" : ar === "16:9" ? "YouTube" : "ידני"}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ marginTop: 20, display: "flex", justifyContent: "center" }}>
              <button onClick={submitTrimCrop} disabled={actionLoading} style={btnPrimary(actionLoading)}>
                {actionLoading ? "שומר..." : "✓ אישור חיתוך ומיקוד"}
              </button>
            </div>
          </div>
        )}

        {/* ──── STEP: FINALIZE ──── */}
        {currentStep === "finalize" && (
          <div style={{ textAlign: "center", maxWidth: 500, margin: "0 auto" }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>🔒</div>
            <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>הכנה סופית — נעילת מקור</h2>
            <p style={{ color: "#94a3b8", marginBottom: 8, lineHeight: 1.6 }}>
              שלב זה יוצר את הקובץ הסופי לפני עריכה ונועל את הוידאו המקורי.
            </p>
            <p style={{ color: "#f59e0b", fontSize: 13, marginBottom: 24 }}>
              ⚠️ לאחר נעילה, לא ניתן לחזור לוידאו המקורי. רק הקובץ הסופי ישמש לעריכה.
            </p>

            {pipeline?.sourceLocked ? (
              <div>
                <div style={{ color: "#22c55e", fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
                  ✅ המקור ננעל בהצלחה
                </div>
                <button
                  onClick={() =>
                    setPipeline((prev) =>
                      prev ? { ...prev, pipelineStatus: "ai_analysis_running" as PipelineStatus } : prev,
                    )
                  }
                  style={btnPrimary(false)}
                >
                  ← המשך לניתוח AI
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                <button onClick={finalize} disabled={actionLoading} style={btnPrimary(actionLoading)}>
                  {actionLoading ? "נועל..." : "🔒 נעל מקור והכן קובץ סופי"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ──── STEP: AI ANALYSIS ──── */}
        {currentStep === "ai_analysis" && (
          <div style={{ textAlign: "center", maxWidth: 600, margin: "0 auto" }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>🤖</div>
            <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>ניתוח AI חכם</h2>
            <p style={{ color: "#94a3b8", marginBottom: 24, lineHeight: 1.6 }}>
              הניתוח סורק את הוידאו ומזהה סצנות, רגשות, רגעי שקט, קצב ועוד.
              התוצאות ישמשו לעריכה חכמה.
            </p>

            {pipeline?.aiAnalysisStatus === "completed" && pipeline.aiAnalysis ? (
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
                  <div style={metricCard}>
                    <div style={{ fontSize: 28, fontWeight: 800, color: "#00f5ff" }}>
                      {pipeline.aiAnalysis.viralScore}%
                    </div>
                    <div style={{ fontSize: 12, color: "#94a3b8" }}>Viral Score</div>
                  </div>
                  <div style={metricCard}>
                    <div style={{ fontSize: 28, fontWeight: 800, color: "#22c55e" }}>
                      {pipeline.aiAnalysis.pacingScore}%
                    </div>
                    <div style={{ fontSize: 12, color: "#94a3b8" }}>Pacing Score</div>
                  </div>
                  <div style={metricCard}>
                    <div style={{ fontSize: 28, fontWeight: 800, color: "#f59e0b" }}>
                      {pipeline.aiAnalysis.scenes?.length || 0}
                    </div>
                    <div style={{ fontSize: 12, color: "#94a3b8" }}>סצנות שזוהו</div>
                  </div>
                </div>
                <button onClick={goToEditor} style={btnPrimary(false)}>
                  🎬 כניסה לעורך
                </button>
              </div>
            ) : pipeline?.aiAnalysisStatus === "running" ? (
              <div>
                <div style={{ width: 48, height: 48, border: "3px solid rgba(0,245,255,0.3)", borderTop: "3px solid #00f5ff", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 16px" }} />
                <p style={{ color: "#00f5ff", fontWeight: 600 }}>מנתח... זה עשוי לקחת מספר דקות</p>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                <button onClick={startAnalysis} disabled={actionLoading} style={btnPrimary(actionLoading)}>
                  {actionLoading ? "מפעיל..." : "🤖 הפעל ניתוח AI"}
                </button>
                <button onClick={skipAnalysis} disabled={actionLoading} style={btnSecondary(actionLoading)}>
                  דלג וכנס לעורך ←
                </button>
              </div>
            )}
          </div>
        )}

        {/* ──── STEP: READY ──── */}
        {currentStep === "ready" && (
          <div style={{ textAlign: "center", maxWidth: 500, margin: "0 auto" }}>
            <div style={{ fontSize: 80, marginBottom: 16 }}>🎬</div>
            <h2 style={{ fontSize: 26, fontWeight: 700, marginBottom: 12 }}>הוידאו מוכן לעריכה!</h2>
            <p style={{ color: "#94a3b8", marginBottom: 32 }}>
              כל השלבים הושלמו. הקובץ הסופי מוכן — לחץ לכניסה לעורך.
            </p>
            <button onClick={goToEditor} style={{ ...btnPrimary(false), fontSize: 18, padding: "16px 40px" }}>
              🎬 כניסה לעורך הוידאו
            </button>

            {/* Audit log */}
            {pipeline && pipeline.auditLog.length > 0 && (
              <div style={{ marginTop: 40, textAlign: "right" }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: "#94a3b8" }}>📋 יומן פעולות</h3>
                <div style={{ maxHeight: 200, overflowY: "auto" }}>
                  {pipeline.auditLog.slice(-10).reverse().map((entry, i) => (
                    <div
                      key={i}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 8,
                        background: "rgba(255,255,255,0.02)",
                        marginBottom: 6,
                        fontSize: 12,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span style={{ color: "#94a3b8" }}>{entry.action.replace(/_/g, " ")}</span>
                      <span style={{ color: "#64748b", fontSize: 11 }}>
                        {new Date(entry.timestamp).toLocaleTimeString("he-IL")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Spin animation ── */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Shared Styles
   ═══════════════════════════════════════════════════════════════════════════ */

function btnPrimary(disabled: boolean): React.CSSProperties {
  return {
    padding: "12px 28px",
    borderRadius: 10,
    border: "none",
    background: disabled ? "rgba(0,245,255,0.1)" : "linear-gradient(135deg, #00f5ff, #0ea5e9)",
    color: disabled ? "#64748b" : "#000",
    fontWeight: 700,
    fontSize: 15,
    cursor: disabled ? "not-allowed" : "pointer",
    transition: "all 0.2s",
    opacity: disabled ? 0.5 : 1,
  };
}

function btnSecondary(disabled: boolean): React.CSSProperties {
  return {
    padding: "12px 28px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.15)",
    background: "rgba(255,255,255,0.05)",
    color: disabled ? "#64748b" : "#94a3b8",
    fontWeight: 600,
    fontSize: 14,
    cursor: disabled ? "not-allowed" : "pointer",
    transition: "all 0.2s",
    opacity: disabled ? 0.5 : 1,
  };
}

const cardStyle: React.CSSProperties = {
  padding: 24,
  borderRadius: 14,
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.08)",
};

const labelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  fontSize: 13,
  color: "#94a3b8",
  flex: 1,
};

const inputStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.15)",
  background: "rgba(255,255,255,0.05)",
  color: "#e2e8f0",
  fontSize: 15,
  fontWeight: 600,
  outline: "none",
  width: "100%",
};

const metricCard: React.CSSProperties = {
  padding: 20,
  borderRadius: 12,
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.08)",
  textAlign: "center",
};
