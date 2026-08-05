"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";

// ── Types ────────────────────────────────────────────────────────────────

interface BulkItem {
  id: string;
  title: string;
  contentType?: string;
  date?: string;
}

type ItemStatus = "pending" | "processing" | "success" | "error";
type ItemStage = "init" | "auto-brief" | "generate" | "awaiting-selection" | "saving" | "done";

interface ItemProgress {
  status: ItemStatus;
  stage: ItemStage;
  error?: string;
  imageUrl?: string;
  variants?: { key: string; url: string }[];
  versions?: { id: string; imageUrl: string; versionNumber: number }[];
  startTime?: number;
  endTime?: number;
}

interface Props {
  clientId: string;
  month?: number;   // 0-based month index
  year?: number;
  onClose: () => void;
  onComplete: () => void;
}

const STAGE_LABELS: Record<ItemStage, string> = {
  init: "מתחיל...",
  "auto-brief": "יוצר בריף AI מותאם...",
  generate: "מייצר 3 אפשרויות עיצוב...",
  "awaiting-selection": "בחר אפשרות מועדפת",
  saving: "שומר...",
  done: "הושלם!",
};

const STAGE_ORDER: ItemStage[] = ["auto-brief", "generate", "saving", "done"];

// ── Helpers ──────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ── Component ────────────────────────────────────────────────────────────

export default function BulkVisualGeneration({ clientId, month, year, onClose, onComplete }: Props) {
  const [items, setItems] = useState<BulkItem[]>([]);
  const [logoUrl, setLogoUrl] = useState("");
  const [progress, setProgress] = useState<Record<string, ItemProgress>>({});
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isRunning, setIsRunning] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [refiningVersionId, setRefiningVersionId] = useState<string | null>(null);
  const [refineNotes, setRefineNotes] = useState("");
  const [isRefining, setIsRefining] = useState(false);
  const abortRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const selectionResolverRef = useRef<(() => void) | null>(null);

  // ── Load items ───────────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      try {
        const params = new URLSearchParams({ clientId });
        if (month !== undefined) params.set('month', String(month + 1)); // convert 0-based to 1-based
        if (year !== undefined) params.set('year', String(year));
        const resp = await fetch(`/api/visual-generation/bulk-generate-item?${params.toString()}`);
        if (!resp.ok) throw new Error("Failed to load items");
        const data = await resp.json();
        setItems(data.items || []);
        setLogoUrl(data.logoUrl || "");

        // Initialize progress
        const init: Record<string, ItemProgress> = {};
        for (const item of data.items || []) {
          init[item.id] = { status: "pending", stage: "init" };
        }
        setProgress(init);
      } catch (err) {
        console.error("[BulkVG] Failed to load items:", err);
      }
    })();
  }, [clientId]);

  // ── Timer ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (startTime) {
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [startTime]);

  // ── Process items ────────────────────────────────────────────────────

  function waitForSelection(): Promise<void> {
    return new Promise(resolve => {
      selectionResolverRef.current = resolve;
    });
  }

  const handleSelectOption = useCallback(async (
    itemId: string,
    versionId: string,
    mode: "save-with-variants" | "save-single",
  ) => {
    // Update stage to saving
    setProgress(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], stage: "saving" },
    }));

    try {
      const resp = await fetch("/api/visual-generation/bulk-generate-item", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          ganttItemId: itemId,
          action: mode,
          versionId,
        }),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`Server error ${resp.status}: ${errText.substring(0, 200)}`);
      }

      const data = await resp.json();

      if (!data.success) {
        throw new Error(data.error || "Unknown error");
      }

      // Mark as done
      setProgress(prev => ({
        ...prev,
        [itemId]: {
          status: "success",
          stage: "done",
          imageUrl: data.imageUrls?.[0] || "",
          variants: data.variants || [],
          endTime: Date.now(),
        },
      }));
    } catch (err: any) {
      console.error(`[BulkVG] Save failed for ${itemId}:`, err.message);
      setProgress(prev => ({
        ...prev,
        [itemId]: {
          status: "error",
          stage: "saving",
          error: err.message || "שגיאה בשמירה",
          endTime: Date.now(),
        },
      }));
    }

    // Resolve the waiting promise to continue to next item
    if (selectionResolverRef.current) {
      selectionResolverRef.current();
      selectionResolverRef.current = null;
    }
  }, [clientId]);

  const handleRefine = useCallback(async (itemId: string, versionId: string, userNotes: string) => {
    if (!userNotes.trim()) return;
    setIsRefining(true);

    try {
      const resp = await fetch("/api/visual-generation/bulk-generate-item", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          ganttItemId: itemId,
          action: "refine",
          versionId,
          notes: userNotes.trim(),
        }),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`Server error ${resp.status}: ${errText.substring(0, 200)}`);
      }

      const data = await resp.json();
      if (!data.success) throw new Error(data.error || "Refinement failed");

      // Replace the refined version in the versions array
      setProgress(prev => {
        const curr = prev[itemId];
        if (!curr?.versions) return prev;
        const updatedVersions = curr.versions.map(v =>
          v.id === versionId
            ? { id: data.version.id, imageUrl: data.version.imageUrl, versionNumber: data.version.versionNumber }
            : v
        );
        return { ...prev, [itemId]: { ...curr, versions: updatedVersions } };
      });

      setRefiningVersionId(null);
      setRefineNotes("");
    } catch (err: any) {
      console.error(`[BulkVG] Refine failed:`, err.message);
    } finally {
      setIsRefining(false);
    }
  }, [clientId]);

  const processAllItems = useCallback(async () => {
    if (items.length === 0) return;
    setIsRunning(true);
    setStartTime(Date.now());
    abortRef.current = false;

    for (let i = 0; i < items.length; i++) {
      if (abortRef.current) break;

      const item = items[i];
      setCurrentIndex(i);

      // Stage: auto-brief
      setProgress(prev => ({
        ...prev,
        [item.id]: { status: "processing", stage: "auto-brief", startTime: Date.now() },
      }));

      try {
        // After a short delay, show the generate stage while the API runs both steps
        const stageTimer = setTimeout(() => {
          if (!abortRef.current) {
            setProgress(prev => ({
              ...prev,
              [item.id]: { ...prev[item.id], stage: "generate" },
            }));
          }
        }, 8000);

        // Call generate API (steps 1 + 2)
        const resp = await fetch("/api/visual-generation/bulk-generate-item", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientId, ganttItemId: item.id, action: "generate" }),
        });

        clearTimeout(stageTimer);

        if (!resp.ok) {
          const errText = await resp.text();
          throw new Error(`Server error ${resp.status}: ${errText.substring(0, 200)}`);
        }

        const data = await resp.json();

        if (!data.success) {
          throw new Error(data.error || "Unknown error");
        }

        // Set to awaiting-selection with versions
        setProgress(prev => ({
          ...prev,
          [item.id]: {
            ...prev[item.id],
            stage: "awaiting-selection",
            versions: data.versions || [],
          },
        }));

        // PAUSE — wait for user to pick an option
        await waitForSelection();

        // After selection, the handler already marked the item as done or error
      } catch (err: any) {
        console.error(`[BulkVG] Item ${i + 1} failed:`, err.message);
        setProgress(prev => ({
          ...prev,
          [item.id]: {
            status: "error",
            stage: prev[item.id]?.stage || "init",
            error: err.message || "שגיאה לא צפויה",
            endTime: Date.now(),
          },
        }));
      }
    }

    setIsFinished(true);
    setIsRunning(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }, [items, clientId]);

  // Auto-start when items load
  useEffect(() => {
    if (items.length > 0 && !isRunning && !isFinished && currentIndex === -1) {
      processAllItems();
    }
  }, [items, isRunning, isFinished, currentIndex, processAllItems]);

  // ── Computed values ──────────────────────────────────────────────────

  const completedCount = Object.values(progress).filter(p => p.status === "success").length;
  const failedCount = Object.values(progress).filter(p => p.status === "error").length;
  const totalProcessed = completedCount + failedCount;
  const pct = items.length > 0 ? Math.round((totalProcessed / items.length) * 100) : 0;

  // ETA calculation
  const avgTimePerItem = totalProcessed > 0 && startTime
    ? (Date.now() - startTime) / totalProcessed / 1000
    : 90; // default estimate: 90 seconds per item
  const remainingItems = items.length - totalProcessed;
  const estimatedRemaining = Math.round(remainingItems * avgTimePerItem);

  const currentItem = currentIndex >= 0 && currentIndex < items.length ? items[currentIndex] : null;
  const currentProgress = currentItem ? progress[currentItem.id] : null;

  // ── Render ───────────────────────────────────────────────────────────

  return createPortal(
    <div style={{
      position: "fixed",
      inset: 0,
      zIndex: 10000,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "rgba(0,0,0,0.75)",
      backdropFilter: "blur(12px)",
      direction: "rtl",
    }}>
      <div style={{
        width: "min(95vw, 1100px)",
        maxHeight: "90vh",
        background: "#ffffff",
        borderRadius: "1.2rem",
        boxShadow: "0 40px 120px rgba(0,0,0,0.4), 0 0 0 1px rgba(0,181,254,0.2)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}>
        {/* ── Header ─────────────────────────────────────── */}
        <div style={{
          padding: "1.5rem 2rem 1.2rem",
          borderBottom: "1px solid #e5e7eb",
          background: "linear-gradient(135deg, #f8faff 0%, #f0f7ff 100%)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <span style={{ fontSize: "1.8rem" }}>🎨</span>
              <div>
                <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, color: "#111" }}>
                  יצירת עיצובים גרפיים אוטומטית
                </h2>
                <p style={{ margin: "0.15rem 0 0", fontSize: "0.78rem", color: "#6b7280" }}>
                  {isFinished
                    ? `הושלם! ${completedCount} הצליחו · ${failedCount} נכשלו`
                    : `מעבד ${totalProcessed + 1} מתוך ${items.length} פריטים`}
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                abortRef.current = true;
                if (isFinished) onComplete();
                onClose();
              }}
              style={{
                background: isFinished ? "linear-gradient(135deg, #00B5FE, #0090cc)" : "#f3f4f6",
                color: isFinished ? "#fff" : "#374151",
                border: "none",
                borderRadius: "0.6rem",
                padding: "0.5rem 1.2rem",
                fontSize: "0.82rem",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              {isFinished ? "סגור וחזור ללוח" : "ביטול"}
            </button>
          </div>

          {/* Progress bar */}
          <div style={{
            height: "8px",
            borderRadius: "4px",
            background: "#e5e7eb",
            overflow: "hidden",
            position: "relative",
          }}>
            <div style={{
              height: "100%",
              width: `${pct}%`,
              borderRadius: "4px",
              background: isFinished
                ? (failedCount === 0 ? "linear-gradient(90deg, #22c55e, #16a34a)" : "linear-gradient(90deg, #f59e0b, #d97706)")
                : "linear-gradient(90deg, #00B5FE, #6366f1, #00B5FE)",
              backgroundSize: "200% 100%",
              animation: isFinished ? "none" : "shimmer 2s ease infinite",
              transition: "width 0.6s ease-out",
            }} />
          </div>

          {/* Stats row */}
          <div style={{
            display: "flex",
            gap: "1.5rem",
            marginTop: "0.7rem",
            fontSize: "0.75rem",
            color: "#6b7280",
          }}>
            <span>✅ {completedCount} הושלמו</span>
            {failedCount > 0 && <span style={{ color: "#ef4444" }}>❌ {failedCount} נכשלו</span>}
            <span>⏱ {formatTime(elapsed)}</span>
            {!isFinished && remainingItems > 0 && (
              <span>~{formatTime(estimatedRemaining)} נותרו</span>
            )}
            <span style={{ marginRight: "auto", fontWeight: 600, color: "#111" }}>{pct}%</span>
          </div>
        </div>

        {/* ── Body ────────────────────────────────────────── */}
        <div style={{
          display: "flex",
          flex: 1,
          overflow: "hidden",
          minHeight: "420px",
        }}>
          {/* Item list sidebar */}
          <div style={{
            width: "260px",
            borderLeft: "1px solid #e5e7eb",
            overflowY: "auto",
            padding: "0.75rem 0",
            background: "#fafbfc",
          }}>
            {items.map((item, idx) => {
              const p = progress[item.id];
              const isCurrent = idx === currentIndex && isRunning;
              return (
                <div key={item.id} style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.6rem",
                  padding: "0.55rem 1rem",
                  background: isCurrent ? "rgba(0,181,254,0.08)" : "transparent",
                  borderRight: isCurrent ? "3px solid #00B5FE" : "3px solid transparent",
                  transition: "all 0.3s",
                }}>
                  {/* Status icon */}
                  <div style={{
                    width: "24px",
                    height: "24px",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.7rem",
                    flexShrink: 0,
                    ...(p?.status === "success" ? {
                      background: "#dcfce7",
                      color: "#16a34a",
                    } : p?.status === "error" ? {
                      background: "#fef2f2",
                      color: "#ef4444",
                    } : p?.status === "processing" ? {
                      background: "rgba(0,181,254,0.15)",
                      color: "#00B5FE",
                      animation: "pulse 1.5s ease infinite",
                    } : {
                      background: "#f3f4f6",
                      color: "#9ca3af",
                    }),
                  }}>
                    {p?.status === "success" ? "✓" :
                     p?.status === "error" ? "✕" :
                     p?.status === "processing" ? "⟳" :
                     (idx + 1)}
                  </div>

                  {/* Title + status */}
                  <div style={{ overflow: "hidden", flex: 1 }}>
                    <div style={{
                      fontSize: "0.72rem",
                      fontWeight: isCurrent ? 600 : 400,
                      color: isCurrent ? "#111" : "#374151",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}>
                      {item.title}
                    </div>
                    {p?.status === "processing" && (
                      <div style={{ fontSize: "0.62rem", color: "#00B5FE", marginTop: "0.1rem" }}>
                        {STAGE_LABELS[p.stage]}
                      </div>
                    )}
                    {p?.status === "error" && (
                      <div style={{ fontSize: "0.62rem", color: "#ef4444", marginTop: "0.1rem" }}>
                        שגיאה
                      </div>
                    )}
                  </div>

                  {/* Thumbnail if completed */}
                  {p?.status === "success" && p.imageUrl && (
                    <img
                      src={p.imageUrl}
                      alt=""
                      style={{
                        width: "32px",
                        height: "32px",
                        borderRadius: "4px",
                        objectFit: "cover",
                        flexShrink: 0,
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Main content area */}
          <div style={{
            flex: 1,
            padding: "1.5rem 2rem",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "1.5rem",
          }}>
            {/* Current item processing card — pipeline stages (not shown during awaiting-selection) */}
            {currentItem && currentProgress && isRunning && currentProgress.stage !== "awaiting-selection" && currentProgress.stage !== "done" && (
              <div style={{
                background: "linear-gradient(135deg, rgba(0,181,254,0.04), rgba(99,102,241,0.04))",
                border: "1px solid rgba(0,181,254,0.2)",
                borderRadius: "1rem",
                padding: "1.5rem",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
                  <div style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #00B5FE, #6366f1)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                    fontSize: "1.1rem",
                    animation: "spin 2s linear infinite",
                  }}>⟳</div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 600, color: "#111" }}>
                      {currentItem.title}
                    </h3>
                    <p style={{ margin: "0.1rem 0 0", fontSize: "0.72rem", color: "#6b7280" }}>
                      פריט {currentIndex + 1} מתוך {items.length}
                    </p>
                  </div>
                </div>

                {/* Stage pipeline — 3 stages: בריף AI, 3 אפשרויות, שמירה */}
                <div style={{ display: "flex", gap: "0.3rem", alignItems: "center" }}>
                  {(["auto-brief", "generate", "saving"] as ItemStage[]).map((stage, si) => {
                    const pipelineStages: ItemStage[] = ["auto-brief", "generate", "saving"];
                    const stageIdx = pipelineStages.indexOf(currentProgress.stage);
                    const thisIdx = si;
                    const isActive = thisIdx === stageIdx;
                    const isDone = thisIdx < stageIdx;
                    const shortLabels = ["בריף AI", "3 אפשרויות", "שמירה"];

                    return (
                      <div key={stage} style={{ display: "flex", alignItems: "center", gap: "0.3rem", flex: 1 }}>
                        <div style={{
                          flex: 1,
                          background: isDone ? "#dcfce7" : isActive ? "rgba(0,181,254,0.12)" : "#f3f4f6",
                          borderRadius: "0.5rem",
                          padding: "0.5rem 0.6rem",
                          textAlign: "center",
                          border: isActive ? "1px solid rgba(0,181,254,0.3)" : "1px solid transparent",
                          transition: "all 0.4s",
                        }}>
                          <div style={{
                            fontSize: "0.85rem",
                            marginBottom: "0.15rem",
                          }}>
                            {isDone ? "✅" : isActive ? "⏳" : "○"}
                          </div>
                          <div style={{
                            fontSize: "0.62rem",
                            fontWeight: isActive ? 600 : 400,
                            color: isDone ? "#16a34a" : isActive ? "#00B5FE" : "#9ca3af",
                          }}>
                            {shortLabels[si]}
                          </div>
                        </div>
                        {si < 2 && (
                          <div style={{
                            width: "12px",
                            height: "2px",
                            background: isDone ? "#22c55e" : "#e5e7eb",
                            flexShrink: 0,
                          }} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 3-option selection grid — shown when awaiting-selection */}
            {currentItem && currentProgress && currentProgress.stage === "awaiting-selection" && currentProgress.versions && (
              <div style={{
                background: "#fff",
                border: "1px solid rgba(0,181,254,0.2)",
                borderRadius: "1rem",
                padding: "1.5rem",
              }}>
                <h3 style={{
                  margin: "0 0 1.2rem",
                  fontSize: "1rem",
                  fontWeight: 700,
                  color: "#111",
                  textAlign: "center",
                }}>
                  {currentItem.title} — בחר אפשרות
                </h3>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: `repeat(${currentProgress.versions.length}, 1fr)`,
                  gap: "1rem",
                }}>
                  {currentProgress.versions.map((ver, vi) => (
                    <div key={ver.id} style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "0.6rem",
                    }}>
                      <div style={{
                        width: "100%",
                        aspectRatio: "1 / 1",
                        borderRadius: "0.75rem",
                        overflow: "hidden",
                        boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
                        background: "#f9fafb",
                      }}>
                        <img
                          src={ver.imageUrl}
                          alt={`אפשרות ${vi + 1}`}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            display: "block",
                          }}
                        />
                      </div>
                      <div style={{
                        fontSize: "0.78rem",
                        fontWeight: 600,
                        color: "#374151",
                      }}>
                        אפשרות {vi + 1}
                      </div>
                      <button
                        onClick={() => handleSelectOption(currentItem.id, ver.id, "save-with-variants")}
                        style={{
                          width: "100%",
                          padding: "0.5rem 0.6rem",
                          background: "#00B5FE",
                          color: "#fff",
                          border: "none",
                          borderRadius: "0.5rem",
                          fontSize: "0.72rem",
                          fontWeight: 600,
                          cursor: "pointer",
                          transition: "all 0.2s",
                        }}
                      >
                        צור התאמות גודל
                      </button>
                      <button
                        onClick={() => handleSelectOption(currentItem.id, ver.id, "save-single")}
                        style={{
                          width: "100%",
                          padding: "0.5rem 0.6rem",
                          background: "transparent",
                          color: "#374151",
                          border: "1px solid #d1d5db",
                          borderRadius: "0.5rem",
                          fontSize: "0.72rem",
                          fontWeight: 500,
                          cursor: "pointer",
                          transition: "all 0.2s",
                        }}
                      >
                        שמור כגודל בודד
                      </button>
                      <button
                        onClick={() => {
                          setRefiningVersionId(refiningVersionId === ver.id ? null : ver.id);
                          setRefineNotes("");
                        }}
                        disabled={isRefining}
                        style={{
                          width: "100%",
                          padding: "0.5rem 0.6rem",
                          background: refiningVersionId === ver.id ? "rgba(240,255,2,0.15)" : "transparent",
                          color: "#6b7280",
                          border: `1px solid ${refiningVersionId === ver.id ? "var(--neon-yellow, #F0FF02)" : "#e5e7eb"}`,
                          borderRadius: "0.5rem",
                          fontSize: "0.68rem",
                          fontWeight: 500,
                          cursor: isRefining ? "wait" : "pointer",
                          transition: "all 0.2s",
                        }}
                      >
                        ✏️ שלח הערות
                      </button>

                      {/* Inline notes input — shown when this version is selected for refinement */}
                      {refiningVersionId === ver.id && (
                        <div style={{
                          width: "100%",
                          display: "flex",
                          flexDirection: "column",
                          gap: "0.4rem",
                          marginTop: "0.2rem",
                        }}>
                          <textarea
                            value={refineNotes}
                            onChange={(e) => setRefineNotes(e.target.value)}
                            placeholder="כתוב הערות לתיקון... (למשל: שנה צבע רקע, הגדל לוגו, הוסף טקסט)"
                            disabled={isRefining}
                            style={{
                              width: "100%",
                              minHeight: "60px",
                              padding: "0.5rem",
                              border: "1px solid #d1d5db",
                              borderRadius: "0.4rem",
                              fontSize: "0.72rem",
                              fontFamily: "inherit",
                              resize: "vertical",
                              direction: "rtl",
                              outline: "none",
                            }}
                          />
                          <button
                            onClick={() => handleRefine(currentItem.id, ver.id, refineNotes)}
                            disabled={isRefining || !refineNotes.trim()}
                            style={{
                              width: "100%",
                              padding: "0.5rem 0.6rem",
                              background: isRefining
                                ? "#9ca3af"
                                : !refineNotes.trim()
                                ? "#e5e7eb"
                                : "linear-gradient(135deg, #F0FF02, #d4e000)",
                              color: isRefining || !refineNotes.trim() ? "#9ca3af" : "#111",
                              border: "none",
                              borderRadius: "0.5rem",
                              fontSize: "0.72rem",
                              fontWeight: 700,
                              cursor: isRefining || !refineNotes.trim() ? "not-allowed" : "pointer",
                              transition: "all 0.2s",
                            }}
                          >
                            {isRefining ? "מייצר תיקון..." : "שלח ויצר מחדש"}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Saving indicator — shown when saving after user selection */}
            {currentItem && currentProgress && currentProgress.stage === "saving" && (
              <div style={{
                background: "linear-gradient(135deg, rgba(0,181,254,0.04), rgba(99,102,241,0.04))",
                border: "1px solid rgba(0,181,254,0.2)",
                borderRadius: "1rem",
                padding: "2rem",
                textAlign: "center",
              }}>
                <div style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #00B5FE, #6366f1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  fontSize: "1.1rem",
                  animation: "spin 2s linear infinite",
                  margin: "0 auto 0.75rem",
                }}>⟳</div>
                <p style={{ margin: 0, fontSize: "0.85rem", color: "#6b7280" }}>
                  שומר את האפשרות שנבחרה...
                </p>
              </div>
            )}

            {/* Finished summary */}
            {isFinished && (
              <div style={{
                textAlign: "center",
                padding: "2rem",
                background: failedCount === 0
                  ? "linear-gradient(135deg, rgba(34,197,94,0.06), rgba(22,163,106,0.06))"
                  : "linear-gradient(135deg, rgba(245,158,11,0.06), rgba(217,119,6,0.06))",
                borderRadius: "1rem",
                border: `1px solid ${failedCount === 0 ? "rgba(34,197,94,0.2)" : "rgba(245,158,11,0.2)"}`,
              }}>
                <div style={{ fontSize: "3rem", marginBottom: "0.5rem" }}>
                  {failedCount === 0 ? "🎉" : "⚠️"}
                </div>
                <h3 style={{ margin: "0 0 0.5rem", fontSize: "1.3rem", fontWeight: 700, color: "#111" }}>
                  {failedCount === 0 ? "כל העיצובים נוצרו בהצלחה!" : "התהליך הסתיים"}
                </h3>
                <p style={{ margin: 0, fontSize: "0.85rem", color: "#6b7280" }}>
                  {completedCount} עיצובים נוצרו בהצלחה
                  {failedCount > 0 ? ` · ${failedCount} נכשלו` : ""}
                  {` · ${formatTime(elapsed)} סה"כ`}
                </p>
              </div>
            )}

            {/* Completed gallery */}
            {completedCount > 0 && (
              <div>
                <h4 style={{
                  margin: "0 0 0.75rem",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  color: "#374151",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                }}>
                  <span>📸</span>
                  עיצובים שנוצרו ({completedCount})
                </h4>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                  gap: "1rem",
                }}>
                  {items.map(item => {
                    const p = progress[item.id];
                    if (p?.status !== "success" || !p.imageUrl) return null;

                    return (
                      <div key={item.id} style={{
                        borderRadius: "0.75rem",
                        overflow: "hidden",
                        border: "1px solid #e5e7eb",
                        background: "#fff",
                        transition: "all 0.3s",
                        cursor: "default",
                      }}>
                        <div style={{
                          position: "relative",
                          paddingTop: "52.5%",
                          background: "#f9fafb",
                          overflow: "hidden",
                        }}>
                          <img
                            src={p.imageUrl}
                            alt={item.title}
                            style={{
                              position: "absolute",
                              inset: 0,
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                            }}
                          />
                          {/* Size variant badges */}
                          {p.variants && p.variants.length > 0 && (
                            <div style={{
                              position: "absolute",
                              bottom: "6px",
                              left: "6px",
                              display: "flex",
                              gap: "3px",
                            }}>
                              {p.variants.map(v => (
                                <span key={v.key} style={{
                                  background: "rgba(0,0,0,0.65)",
                                  color: "#fff",
                                  fontSize: "0.55rem",
                                  padding: "1px 5px",
                                  borderRadius: "3px",
                                  backdropFilter: "blur(4px)",
                                }}>
                                  {v.key === "facebook" ? "FB" : v.key === "instagram" ? "IG" : "Story"}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div style={{ padding: "0.5rem 0.65rem" }}>
                          <div style={{
                            fontSize: "0.68rem",
                            fontWeight: 500,
                            color: "#111",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}>
                            {item.title}
                          </div>
                          <div style={{
                            fontSize: "0.58rem",
                            color: "#16a34a",
                            marginTop: "0.15rem",
                          }}>
                            {p.variants && p.variants.length > 0
                              ? "✅ 3 גרסאות גודל נוצרו"
                              : "✅ נשמר כגודל בודד"}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Error details */}
            {failedCount > 0 && isFinished && (
              <div>
                <h4 style={{
                  margin: "0 0 0.5rem",
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  color: "#ef4444",
                }}>
                  פריטים שנכשלו ({failedCount})
                </h4>
                {items.map(item => {
                  const p = progress[item.id];
                  if (p?.status !== "error") return null;
                  return (
                    <div key={item.id} style={{
                      padding: "0.6rem 0.8rem",
                      background: "#fef2f2",
                      borderRadius: "0.5rem",
                      marginBottom: "0.4rem",
                      fontSize: "0.72rem",
                    }}>
                      <strong>{item.title}</strong>
                      <span style={{ color: "#ef4444", marginRight: "0.5rem" }}>
                        {p.error || "שגיאה לא ידועה"}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Loading state */}
            {items.length === 0 && (
              <div style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "3rem",
                gap: "1rem",
              }}>
                <div style={{
                  width: "48px",
                  height: "48px",
                  border: "3px solid #e5e7eb",
                  borderTopColor: "#00B5FE",
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite",
                }} />
                <p style={{ fontSize: "0.85rem", color: "#6b7280" }}>טוען פריטים...</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Animations */}
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>,
    document.body
  );
}
