"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useProjects, useClients } from "@/lib/api/use-entity";
import { useToast } from "@/components/ui/toast";
import { Modal } from "@/components/ui/modal";
import type { Project } from "@/lib/db/schema";
import { scoreVideo } from "@/lib/video-engine/ai-scoring";

type ProjectStatus = "draft" | "analysing" | "approved" | "rendering" | "complete" | "failed" | "sent_to_client";
type ProjectFormat = "9:16" | "16:9" | "1:1" | "4:5";

function statusBadgeColor(s: ProjectStatus): string {
  const colors: Record<ProjectStatus, string> = {
    complete: "#22c55e",
    approved: "#38bdf8",
    rendering: "#fbbf24",
    analysing: "#a78bfa",
    draft: "#6b7280",
    failed: "#f87171",
    sent_to_client: "#14b8a6",
  };
  return colors[s] || "#6b7280";
}

function statusLabel(s: ProjectStatus): string {
  const labels: Record<ProjectStatus, string> = {
    draft: "טיוטה",
    analysing: "בניתוח",
    approved: "מאושר",
    rendering: "בייצוא",
    complete: "הושלם",
    failed: "נכשל",
    sent_to_client: "נשלח ללקוח",
  };
  return labels[s] || s;
}

function fmtDuration(sec: number | null): string {
  if (!sec || sec <= 0) return "";
  return sec >= 60
    ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`
    : `${sec}s`;
}

function fmtDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const months = ["ינו", "פבר", "מרץ", "אפר", "מאי", "יונ", "יול", "אוג", "ספט", "אוק", "נוב", "דצמ"];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function getProjectAiScore(project: Project | null | undefined): number | null {
  try {
    if (!project) return null;

    // First check if score was saved with the project
    const saved = (project as any).aiScore;
    if (saved?.overall) return saved.overall;

    const ws = project.wizardState as Record<string, any> | null;
    if (!ws?.segments || !Array.isArray(ws.segments)) return null;

    const segments = (ws.segments || []).map((s: any) => ({
      id: s?.id || "", startSec: s?.startSec || 0, endSec: s?.endSec || 0,
      text: s?.text || "", edited: s?.edited || false,
      highlightWord: s?.highlightWord || "", highlightStyle: s?.highlightStyle || "color",
    }));

    if (!segments || segments.length === 0) return null;

    const result = scoreVideo({
      segments,
      durationSec: project?.durationSec || 30,
      format: (project?.format || "9:16") as any,
      hasMusic: !!ws?.musicEnabled,
      hasBroll: !!ws?.brollEnabled,
      preset: ws?.preset || project?.preset || "",
      subtitleStyle: {
        font: ws?.subtitleFont || "Assistant", fontWeight: ws?.subtitleFontWeight || 600,
        fontSize: ws?.subtitleFontSize || 32, color: ws?.subtitleColor || "#FFFFFF",
        highlightColor: ws?.subtitleHighlightColor || "#FFD700",
        outlineEnabled: !!ws?.subtitleOutlineEnabled, outlineColor: ws?.subtitleOutlineColor || "#000",
        outlineThickness: ws?.subtitleOutlineThickness || 2, shadow: !!ws?.subtitleShadow,
        bgEnabled: !!ws?.subtitleBg, bgColor: ws?.subtitleBgColor || "#000",
        bgOpacity: ws?.subtitleBgOpacity || 65, align: ws?.subtitleAlign || "center",
        position: ws?.subtitlePosition || "bottom", animation: ws?.subtitleAnimation || "none",
        lineBreak: ws?.subtitleLineBreak || "auto",
      },
    });
    return result?.overall || null;
  } catch {
    return null;
  }
}

function aiScoreColor(score: number): string {
  return score >= 80 ? "#22c55e" : score >= 60 ? "#f59e0b" : score >= 40 ? "#f97316" : "#ef4444";
}

interface CreateEditFormState {
  name: string;
  clientId: string;
  format: ProjectFormat;
  preset: string;
  status: ProjectStatus;
}

const DEFAULT_FORM_STATE: CreateEditFormState = {
  name: "",
  clientId: "",
  format: "9:16",
  preset: "",
  status: "draft",
};

export default function ProjectsPage() {
  const { data: projects, loading, create, update, remove } = useProjects();
  const { data: clients } = useClients();
  const toast = useToast();

  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [formState, setFormState] = useState<CreateEditFormState>(DEFAULT_FORM_STATE);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sort newest first, then filter
  const sortedProjects = useMemo(() => {
    const sorted = [...(projects?.filter(p => p != null) || [])];
    sorted.sort((a, b) => {
      if (!a || !b) return 0;
      const da = new Date(a?.updatedAt || a?.createdAt || 0).getTime();
      const db = new Date(b?.updatedAt || b?.createdAt || 0).getTime();
      return db - da; // newest first
    });
    return sorted;
  }, [projects]);

  const filteredProjects = sortedProjects.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return p.name.toLowerCase().includes(q) || (p.clientName || "").toLowerCase().includes(q);
  });

  const total = projects?.length || 0;
  const hasFilter = !!search;
  const countText = hasFilter
    ? `${filteredProjects.length} מתוך ${total} פרויקטים`
    : total > 0
      ? `${total} פרויקטים`
      : "אין פרויקטים";

  const openCreateModal = () => {
    setEditingProject(null);
    setFormState(DEFAULT_FORM_STATE);
    setModalOpen(true);
  };

  const openEditModal = (project: Project) => {
    setEditingProject(project);
    setFormState({
      name: project.name,
      clientId: project.clientId,
      format: project.format,
      preset: project.preset,
      status: project.status,
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingProject(null);
    setFormState(DEFAULT_FORM_STATE);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.name.trim()) {
      toast("שם הפרויקט חובה", "error");
      return;
    }
    if (!formState.clientId.trim()) {
      toast("בחירת לקוח חובה", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingProject) {
        await update(editingProject.id, {
          name: formState.name,
          clientId: formState.clientId,
          format: formState.format,
          preset: formState.preset,
          status: formState.status,
        });
        toast("הפרויקט עודכן בהצלחה", "success");
      } else {
        await create({
          name: formState.name,
          clientId: formState.clientId,
          format: formState.format,
          preset: formState.preset,
          status: formState.status,
        });
        toast("הפרויקט נוצר בהצלחה", "success");
      }
      closeModal();
    } catch (error) {
      toast(error instanceof Error ? error.message : "שגיאה בעדכון הפרויקט", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    setIsSubmitting(true);
    try {
      await remove(id);
      toast("הפרויקט נמחק בהצלחה", "success");
      setDeleteConfirmId(null);
    } catch (error) {
      toast(error instanceof Error ? error.message : "שגיאה במחיקת הפרויקט", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedClient = clients?.find((c) => c.id === formState.clientId);

  return (
    <main className="max-w-[1100px] mx-auto px-6 py-8">
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div style={{ flex: 1 }}>
            <h1 className="mod-page-title">פרויקטים</h1>
            <p style={{ fontSize: "0.875rem", color: "var(--foreground-muted)", marginTop: "0.25rem" }}>
              {countText}
            </p>
          </div>
          <Link
            href="/projects/new"
            className="mod-btn-primary"
            style={{ padding: "0.5rem 1.125rem", textDecoration: "none", display: "inline-block" }}
          >
            + פרויקט חדש
          </Link>
        </div>

        {/* Filter bar */}
        {total > 0 && (
          <div className="proj-filter-bar">
            <div className="proj-filter-search">
              <span className="proj-filter-search-icon">🔍</span>
              <input
                className="form-input"
                type="search"
                placeholder="חיפוש פרויקט…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ paddingInlineStart: "2rem" }}
                autoComplete="off"
              />
            </div>
            {hasFilter && (
              <button
                className="mod-btn-ghost"
                style={{ fontSize: "0.75rem", padding: "0.2rem 0.6rem", height: 36 }}
                onClick={() => setSearch("")}
              >
                ✕ נקה
              </button>
            )}
          </div>
        )}

        {/* Grid */}
        <div className="proj-grid">
          {loading ? (
            <div
              style={{
                gridColumn: "1 / -1",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "4rem 2rem",
              }}
            >
              <div style={{ color: "var(--foreground-muted)" }}>טוען פרויקטים...</div>
            </div>
          ) : filteredProjects.length === 0 && total > 0 ? (
            /* No results from filter */
            <div className="proj-no-results">
              <div style={{ fontSize: "1.75rem", opacity: 0.4 }}>🔍</div>
              <div style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--foreground)" }}>
                לא נמצאו פרויקטים
              </div>
              <div style={{ fontSize: "0.8125rem" }}>&quot;{search}&quot;</div>
              <button
                className="mod-btn-ghost"
                style={{ marginTop: "0.25rem", fontSize: "0.8125rem", padding: "0.375rem 0.875rem" }}
                onClick={() => setSearch("")}
              >
                נקה סינון
              </button>
            </div>
          ) : filteredProjects.length === 0 ? (
            /* Empty state — no projects at all */
            <div
              style={{
                gridColumn: "1 / -1",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "4rem 2rem",
                textAlign: "center",
                gap: "1rem",
                border: "2px dashed var(--border)",
                borderRadius: "0.75rem",
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  background: "var(--surface-raised)",
                  border: "1px solid var(--border)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.5rem",
                }}
              >
                🎬
              </div>
              <div>
                <p style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.375rem" }}>
                  אין פרויקטים עדיין
                </p>
                <p style={{ color: "var(--foreground-muted)", fontSize: "0.875rem" }}>
                  צור פרויקט ראשון כדי להתחיל לעבוד עם AI
                </p>
              </div>
              <button className="mod-btn-primary" style={{ marginTop: "0.5rem", padding: "0.5rem 1.125rem" }} onClick={openCreateModal}>
                + צור פרויקט ראשון
              </button>
            </div>
          ) : (
            /* Project cards */
            filteredProjects.filter(p => p != null).map((p) => {
              if (!p) return null;

              const durLabel = fmtDuration(p?.durationSec || null);
              const dateLabel = fmtDate(p?.createdAt || null);
              const badgeColor = statusBadgeColor((p?.status || "draft") as ProjectStatus);
              const isDeleteConfirming = deleteConfirmId === p.id;

              const hasRender = !!p?.renderOutputKey;
              const hasSource = !!p?.sourceVideoKey;
              // Ensure paths start with / so they resolve as URLs
              const resolveVideoPath = (key: string | null | undefined) => {
                if (!key) return null;
                if (key.startsWith("/") || key.startsWith("http")) return key;
                // Legacy: bare filename stored without path — try /uploads/ prefix
                return `/uploads/${key}`;
              };
              const previewSrc = resolveVideoPath(hasRender ? p?.renderOutputKey : hasSource ? p?.sourceVideoKey : null);

              return (
                <Link key={p.id} href={`/projects/${p.id}`} className="proj-card" style={{ textDecoration: "none", color: "inherit", display: "flex", flexDirection: "column" }}>
                  {/* Thumbnail with real preview */}
                  <div className="proj-thumb">
                    {previewSrc ? (
                      <video
                        src={previewSrc}
                        muted
                        playsInline
                        preload="metadata"
                        style={{ width: "100%", height: "100%", objectFit: "cover", position: "absolute", inset: 0 }}
                        onMouseEnter={(e) => (e.target as HTMLVideoElement).play().catch(() => {})}
                        onMouseLeave={(e) => { const v = e.target as HTMLVideoElement; v.pause(); v.currentTime = 0; }}
                      />
                    ) : (
                      <div className="proj-thumb-empty">
                        <div className="proj-thumb-empty-icon">🎬</div>
                        <div className="proj-thumb-empty-lbl">אין וידאו</div>
                      </div>
                    )}
                    <span className="proj-thumb-badge" style={{ backgroundColor: badgeColor }}>
                      {statusLabel(p.status)}
                    </span>
                    {durLabel && <div className="proj-thumb-dur">{durLabel}</div>}
                    {hasRender && (
                      <div style={{ position: "absolute", top: 6, insetInlineEnd: 6, background: "rgba(34,197,94,0.85)", color: "#fff", padding: "1px 6px", borderRadius: 4, fontSize: "0.6rem", fontWeight: 700 }}>
                        מוכן
                      </div>
                    )}
                  </div>

                  {/* Body */}
                  <div className="proj-card-body">
                    <div className="proj-name" title={p?.name || ''}>
                      {p?.name || 'ללא שם'}
                    </div>
                    <div className="proj-card-meta-row">
                      <span style={{ color: "var(--foreground-muted)" }}>{p?.clientName || clients?.find((c) => c.id === p?.clientId)?.name || 'לקוח לא ידוע'}</span>
                      {p?.format && (
                        <>
                          <span style={{ opacity: 0.35, flexShrink: 0, fontSize: "0.65rem" }}>·</span>
                          <span className="proj-card-chip chip-fmt">{p.format}</span>
                        </>
                      )}
                      {durLabel && (
                        <>
                          <span style={{ opacity: 0.35, flexShrink: 0, fontSize: "0.65rem" }}>·</span>
                          <span className="proj-card-chip">⏱ {durLabel}</span>
                        </>
                      )}
                    </div>
                    {(dateLabel || (Array.isArray(p?.segments) && p.segments.length > 0)) && (
                      <div className="proj-card-info-row">
                        <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                          {dateLabel && (
                            <>
                              <span style={{ opacity: 0.55, fontSize: "0.7rem" }}>📅</span> {dateLabel}
                            </>
                          )}
                        </span>
                        <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                          {Array.isArray(p?.segments) && p.segments.length > 0 && (
                            <>
                              <span style={{ opacity: 0.5, fontSize: "0.7rem" }}>✂</span> {p.segments.length} קטעים
                            </>
                          )}
                        </span>
                      </div>
                    )}
                    {(() => {
                      const aiScore = getProjectAiScore(p);
                      if (aiScore === null) return null;
                      return (
                        <div style={{
                          display: "flex", alignItems: "center", gap: "0.375rem",
                          marginTop: "0.375rem",
                        }}>
                          <div style={{
                            display: "inline-flex", alignItems: "center", gap: "0.25rem",
                            padding: "0.125rem 0.5rem", borderRadius: 10,
                            background: `${aiScoreColor(aiScore)}15`,
                            border: `1px solid ${aiScoreColor(aiScore)}30`,
                            fontSize: "0.7rem", fontWeight: 600,
                            color: aiScoreColor(aiScore),
                          }}>
                            <span>AI</span>
                            <span style={{ fontWeight: 800 }}>{aiScore}</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Actions — stopPropagation to prevent Link navigation */}
                  <div className="proj-card-actions" onClick={(e) => e.preventDefault()}>
                    {isDeleteConfirming ? (
                      <>
                        <button
                          className="proj-card-act-btn"
                          style={{ flex: 1, background: "#f87171" }}
                          onClick={(e) => { e.preventDefault(); handleDelete(p.id); }}
                          disabled={isSubmitting}
                        >
                          {isSubmitting ? "מוחק..." : "אישור מחיקה"}
                        </button>
                        <button
                          className="proj-card-act-btn"
                          style={{ flex: 1 }}
                          onClick={(e) => { e.preventDefault(); setDeleteConfirmId(null); }}
                          disabled={isSubmitting}
                        >
                          ביטול
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className="proj-card-act-btn act-open"
                          onClick={(e) => { e.preventDefault(); openEditModal(p); }}
                        >
                          עריכה
                        </button>
                        <button
                          className="proj-card-act-btn"
                          onClick={(e) => { e.preventDefault(); setDeleteConfirmId(p.id); }}
                        >
                          🗑 מחק
                        </button>
                      </>
                    )}
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </div>

      {/* Create/Edit Modal */}
      <Modal open={modalOpen} onClose={closeModal} title={editingProject ? "עריכת פרויקט" : "יצירת פרויקט חדש"}>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {/* Name */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
            <label style={{ fontSize: "0.875rem", fontWeight: 600 }}>שם הפרויקט</label>
            <input
              type="text"
              className="form-input"
              value={formState.name}
              onChange={(e) => setFormState({ ...formState, name: e.target.value })}
              placeholder="הכנס שם פרויקט"
              disabled={isSubmitting}
            />
          </div>

          {/* Client Select */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
            <label style={{ fontSize: "0.875rem", fontWeight: 600 }}>לקוח</label>
            <select
              className="form-select"
              value={formState.clientId}
              onChange={(e) => setFormState({ ...formState, clientId: e.target.value })}
              disabled={isSubmitting}
            >
              <option value="">בחר לקוח...</option>
              {clients?.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </div>

          {/* Format Select */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
            <label style={{ fontSize: "0.875rem", fontWeight: 600 }}>פורמט</label>
            <select
              className="form-select"
              value={formState.format}
              onChange={(e) => setFormState({ ...formState, format: e.target.value as ProjectFormat })}
              disabled={isSubmitting}
            >
              <option value="9:16">9:16 (וידאו אנכי)</option>
              <option value="16:9">16:9 (וידאו אופקי)</option>
              <option value="1:1">1:1 (ריבוע)</option>
              <option value="4:5">4:5</option>
            </select>
          </div>

          {/* Preset */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
            <label style={{ fontSize: "0.875rem", fontWeight: 600 }}>קדם-הגדר (סגנון)</label>
            <input
              type="text"
              className="form-input"
              value={formState.preset}
              onChange={(e) => setFormState({ ...formState, preset: e.target.value })}
              placeholder="e.g., minimal, modern, cinematic"
              disabled={isSubmitting}
            />
          </div>

          {/* Status Select */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
            <label style={{ fontSize: "0.875rem", fontWeight: 600 }}>סטטוס</label>
            <select
              className="form-select"
              value={formState.status}
              onChange={(e) => setFormState({ ...formState, status: e.target.value as ProjectStatus })}
              disabled={isSubmitting}
            >
              <option value="draft">טיוטה</option>
              <option value="analysing">בניתוח</option>
              <option value="approved">מאושר</option>
              <option value="rendering">בייצוא</option>
              <option value="complete">הושלם</option>
              <option value="failed">נכשל</option>
            </select>
          </div>

          {/* Action Buttons */}
          <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
            <button
              type="submit"
              className="mod-btn-primary"
              style={{ flex: 1 }}
              disabled={isSubmitting}
            >
              {isSubmitting ? "שומר..." : editingProject ? "עדכן" : "צור"}
            </button>
            <button
              type="button"
              className="mod-btn-ghost"
              style={{ flex: 1 }}
              onClick={closeModal}
              disabled={isSubmitting}
            >
              ביטול
            </button>
          </div>
        </form>
      </Modal>
    </main>
  );
}
