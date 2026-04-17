"use client";

import { useState, useCallback, useRef } from "react";
import { useClientFiles } from "@/lib/api/use-entity";
import type { Client, ClientFile } from "@/lib/db/schema";

interface TabFilesProps {
  client: Client;
  onOpenUgcModal?: () => void;
}

type CategoryFilter = "all" | "social_media" | "agreements" | "branding" | "website" | "accountant" | "approved_final" | "general";

const CATEGORY_OPTIONS: { id: CategoryFilter; label: string; icon: string }[] = [
  { id: "all", label: "הכל", icon: "📂" },
  { id: "social_media", label: "נכסי סושיאל", icon: "📱" },
  { id: "agreements", label: "הסכמים", icon: "📄" },
  { id: "branding", label: "מיתוג", icon: "🎨" },
  { id: "website", label: "אתר", icon: "🌐" },
  { id: "accountant", label: "הנהח״ש", icon: "🧾" },
  { id: "approved_final", label: "מאושר סופי", icon: "✅" },
  { id: "general", label: "כללי", icon: "📋" },
];

const FILE_TYPE_ICONS: Record<string, string> = {
  video: "🎬",
  image: "🖼️",
  document: "📄",
  pdf: "📕",
  draft: "✏️",
  other: "📎",
};

const CATEGORY_LABELS: Record<string, string> = {
  social_media: "נכסי סושיאל",
  agreements: "הסכמים",
  branding: "מיתוג",
  website: "אתר",
  accountant: "הנהח״ש",
  approved_final: "מאושר סופי",
  general: "כללי",
};

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const months = ["ינו", "פבר", "מרץ", "אפר", "מאי", "יונ", "יול", "אוג", "ספט", "אוק", "נוב", "דצמ"];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

function isVideoFile(file: ClientFile): boolean {
  return (
    file.fileType === "video" ||
    /\.(mp4|webm|mov|avi|mkv)$/i.test(file.fileName) ||
    (file.fileUrl || "").includes("heygen")
  );
}

function isImageFile(file: ClientFile): boolean {
  return (
    file.fileType === "image" ||
    /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(file.fileName)
  );
}

/** Trigger a real browser download for any URL */
function triggerDownload(url: string, fileName: string) {
  // For cross-origin URLs (like HeyGen), open in new tab which triggers browser download
  // For same-origin URLs, use the anchor trick
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export default function TabFiles({ client, onOpenUgcModal }: TabFilesProps) {
  const { data: allFiles, loading } = useClientFiles();
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [videoModalFile, setVideoModalFile] = useState<ClientFile | null>(null);
  const [imageModalFile, setImageModalFile] = useState<ClientFile | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const files = (allFiles || [])
    .filter((f) => f.clientId === client.id)
    .filter((f) => categoryFilter === "all" || f.category === categoryFilter)
    .filter((f) => searchQuery === "" || f.fileName.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const handleDownload = useCallback((file: ClientFile) => {
    if (!file.fileUrl) return;
    triggerDownload(file.fileUrl, file.fileName);
  }, []);

  const handleOpenFile = useCallback((file: ClientFile) => {
    if (isVideoFile(file)) {
      setVideoModalFile(file);
    } else if (isImageFile(file)) {
      setImageModalFile(file);
    } else if (file.fileUrl) {
      window.open(file.fileUrl, "_blank", "noopener,noreferrer");
    }
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      {/* Actions Bar */}
      <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
        <button
          onClick={() => setShowUploadModal(true)}
          className="mod-btn-primary"
          style={{
            padding: "0.625rem 1.125rem",
            fontSize: "0.875rem",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.375rem",
            whiteSpace: "nowrap",
          }}
        >
          📤 העלה קובץ
        </button>

        {onOpenUgcModal && (
          <button
            onClick={onOpenUgcModal}
            className="mod-btn-ghost"
            style={{
              padding: "0.625rem 1.125rem",
              fontSize: "0.875rem",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.375rem",
              whiteSpace: "nowrap",
              color: "#8b5cf6",
              borderColor: "rgba(139,92,246,0.3)",
              background: "rgba(139,92,246,0.06)",
            }}
          >
            🎬 צור סרטון UGC
          </button>
        )}

        {/* Search Input */}
        <input
          type="text"
          placeholder="חפש לפי שם קובץ..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="form-input"
          style={{ flex: 1, padding: "0.625rem 1rem", fontSize: "0.875rem" }}
        />
      </div>

      {/* Category Filter */}
      <div>
        <h3 style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-muted)", marginBottom: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          סנן לפי קטגוריה
        </h3>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {CATEGORY_OPTIONS.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategoryFilter(cat.id)}
              style={{
                padding: "0.5rem 0.875rem",
                borderRadius: "0.375rem",
                border: "none",
                fontSize: "0.8rem",
                fontWeight: 500,
                cursor: "pointer",
                transition: "all 150ms",
                background: categoryFilter === cat.id ? "var(--accent)" : "var(--surface-raised)",
                color: categoryFilter === cat.id ? "white" : "var(--foreground)",
                borderBottom: categoryFilter === cat.id ? "none" : "1px solid var(--border)",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.375rem",
              }}
            >
              {cat.icon} {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* File Grid */}
      <div>
        {loading ? (
          <div style={{ textAlign: "center", padding: "2rem", color: "var(--foreground-muted)" }}>
            טוען קבצים...
          </div>
        ) : files.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "3rem 2rem",
              background: "var(--surface-raised)",
              borderRadius: "0.75rem",
              border: "1px solid var(--border)",
              color: "var(--foreground-muted)",
            }}
          >
            <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📭</div>
            <div style={{ marginBottom: "1.25rem" }}>אין קבצים עדיין — העלה את הקובץ הראשון</div>
            <button
              onClick={() => setShowUploadModal(true)}
              className="mod-btn-primary"
              style={{ padding: "0.5rem 1rem", fontSize: "0.875rem" }}
            >
              📤 העלה קובץ
            </button>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: "1rem",
            }}
          >
            {files.map((file) => {
              const isVideo = isVideoFile(file);
              const isImage = isImageFile(file);

              return (
                <div
                  key={file.id}
                  style={{
                    background: "var(--surface-raised)",
                    border: "1px solid var(--border)",
                    borderRadius: "0.75rem",
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                    transition: "border-color 150ms, box-shadow 150ms",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = isVideo ? "rgba(139,92,246,0.4)" : "var(--accent)";
                    e.currentTarget.style.boxShadow = isVideo ? "0 0 16px rgba(139,92,246,0.08)" : "0 0 12px rgba(0,0,0,0.06)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "var(--border)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  {/* Video Preview Thumbnail */}
                  {isVideo && file.fileUrl && (
                    <div
                      onClick={() => handleOpenFile(file)}
                      style={{
                        position: "relative",
                        width: "100%",
                        height: "160px",
                        background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
                        cursor: "pointer",
                        overflow: "hidden",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {/* Silhouette video element for thumbnail */}
                      <video
                        src={file.fileUrl}
                        preload="metadata"
                        muted
                        playsInline
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          opacity: 0.6,
                        }}
                        onLoadedData={(e) => {
                          // Seek to 1s to get a meaningful frame
                          const v = e.currentTarget;
                          if (v.duration > 1) v.currentTime = 1;
                        }}
                      />
                      {/* Play overlay */}
                      <div style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "rgba(0,0,0,0.15)",
                      }}>
                        <div style={{
                          width: "48px",
                          height: "48px",
                          borderRadius: "50%",
                          background: "rgba(139,92,246,0.9)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          boxShadow: "0 4px 20px rgba(139,92,246,0.4)",
                          transition: "transform 150ms",
                        }}>
                          <span style={{ color: "#fff", fontSize: "1.25rem", marginRight: "-2px" }}>▶</span>
                        </div>
                      </div>
                      {/* Duration badge */}
                      <div style={{
                        position: "absolute",
                        bottom: "8px",
                        left: "8px",
                        background: "rgba(0,0,0,0.7)",
                        color: "#fff",
                        fontSize: "0.65rem",
                        fontWeight: 600,
                        padding: "2px 6px",
                        borderRadius: "4px",
                      }}>
                        UGC Video
                      </div>
                    </div>
                  )}

                  {/* Image Preview */}
                  {isImage && file.fileUrl && (
                    <div
                      onClick={() => handleOpenFile(file)}
                      style={{
                        width: "100%",
                        height: "160px",
                        cursor: "pointer",
                        overflow: "hidden",
                        background: "var(--surface)",
                      }}
                    >
                      <img
                        src={file.fileUrl}
                        alt={file.fileName}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    </div>
                  )}

                  {/* Card Content */}
                  <div style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "0.75rem", flex: 1 }}>
                    {/* File Icon and Name */}
                    <div style={{ display: "flex", gap: "0.625rem", alignItems: "flex-start" }}>
                      {!isVideo && !isImage && (
                        <div style={{ fontSize: "1.5rem", lineHeight: 1, minWidth: "1.75rem" }}>
                          {FILE_TYPE_ICONS[file.fileType] || FILE_TYPE_ICONS.other}
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h4
                          style={{
                            fontSize: "0.85rem",
                            fontWeight: 600,
                            color: "var(--foreground)",
                            margin: "0 0 0.125rem 0",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          title={file.fileName}
                        >
                          {file.fileName}
                        </h4>
                        <div style={{ fontSize: "0.7rem", color: "var(--foreground-muted)", display: "flex", gap: "0.5rem", alignItems: "center" }}>
                          {formatFileSize(file.fileSize) && <span>{formatFileSize(file.fileSize)}</span>}
                          <span>📅 {formatDate(file.createdAt)}</span>
                          {(file as any).uploadedBy && (
                            <span style={{ color: "#a78bfa" }}>{(file as any).uploadedBy}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Category Badge */}
                    <div
                      style={{
                        fontSize: "0.625rem",
                        padding: "0.2rem 0.5rem",
                        background: isVideo ? "rgba(139,92,246,0.1)" : "#f0f9ff",
                        color: isVideo ? "#a78bfa" : "#0369a1",
                        borderRadius: "0.25rem",
                        fontWeight: 600,
                        width: "fit-content",
                      }}
                    >
                      {isVideo ? "🎬 סרטון UGC" : (CATEGORY_LABELS[file.category] || file.category)}
                    </div>

                    {/* Notes Preview */}
                    {file.notes && (
                      <div
                        style={{
                          fontSize: "0.75rem",
                          color: "var(--foreground-muted)",
                          lineHeight: 1.4,
                          borderRight: "2px solid var(--border)",
                          paddingRight: "0.625rem",
                          maxHeight: "52px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                        }}
                      >
                        {file.notes}
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div style={{ display: "flex", gap: "0.5rem", marginTop: "auto" }}>
                      {isVideo && (
                        <button
                          onClick={() => handleOpenFile(file)}
                          className="mod-btn-ghost"
                          style={{
                            flex: 1,
                            padding: "0.5rem 0.75rem",
                            fontSize: "0.75rem",
                            color: "#8b5cf6",
                            borderColor: "rgba(139,92,246,0.2)",
                          }}
                        >
                          ▶ צפה
                        </button>
                      )}
                      <button
                        onClick={() => handleDownload(file)}
                        className="mod-btn-ghost"
                        style={{
                          flex: 1,
                          padding: "0.5rem 0.75rem",
                          fontSize: "0.75rem",
                        }}
                      >
                        📥 הורד
                      </button>
                      <button
                        onClick={() => {
                          if (file.fileUrl) {
                            window.open(file.fileUrl, "_blank", "noopener,noreferrer");
                          }
                        }}
                        className="mod-btn-ghost"
                        style={{
                          flex: 1,
                          padding: "0.5rem 0.75rem",
                          fontSize: "0.75rem",
                        }}
                      >
                        🔗 פתח
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ═══ Video Player Modal ═══ */}
      {videoModalFile && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
          }}
          onClick={() => { setVideoModalFile(null); }}
        >
          <div
            style={{
              background: "#111",
              borderRadius: "1rem",
              maxWidth: "900px",
              width: "95%",
              maxHeight: "90vh",
              overflow: "hidden",
              border: "1px solid rgba(139,92,246,0.2)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "1rem 1.25rem",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "1.25rem" }}>🎬</span>
                <h3 style={{ fontSize: "0.9rem", fontWeight: 600, color: "#e2e8f0", margin: 0 }}>
                  {videoModalFile.fileName}
                </h3>
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  onClick={() => handleDownload(videoModalFile)}
                  style={{
                    background: "rgba(139,92,246,0.15)",
                    border: "1px solid rgba(139,92,246,0.25)",
                    borderRadius: "0.375rem",
                    padding: "0.375rem 0.75rem",
                    color: "#c4b5fd",
                    fontSize: "0.75rem",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  📥 הורד
                </button>
                <button
                  onClick={() => setVideoModalFile(null)}
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "0.375rem",
                    padding: "0.375rem 0.75rem",
                    color: "rgba(255,255,255,0.5)",
                    fontSize: "0.8rem",
                    cursor: "pointer",
                  }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Video Player */}
            <div style={{ padding: "0", background: "#000" }}>
              <video
                ref={videoRef}
                src={videoModalFile.fileUrl}
                controls
                autoPlay
                playsInline
                style={{
                  width: "100%",
                  maxHeight: "70vh",
                  display: "block",
                }}
              />
            </div>

            {/* Video Info */}
            {videoModalFile.notes && (
              <div style={{
                padding: "0.75rem 1.25rem",
                borderTop: "1px solid rgba(255,255,255,0.06)",
                fontSize: "0.75rem",
                color: "rgba(255,255,255,0.4)",
                lineHeight: 1.5,
                whiteSpace: "pre-wrap",
                maxHeight: "80px",
                overflow: "auto",
              }}>
                {videoModalFile.notes}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ Image Viewer Modal ═══ */}
      {imageModalFile && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
          }}
          onClick={() => setImageModalFile(null)}
        >
          <div
            style={{
              position: "relative",
              maxWidth: "90vw",
              maxHeight: "90vh",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setImageModalFile(null)}
              style={{
                position: "absolute", top: "-40px", left: "0",
                background: "rgba(255,255,255,0.1)",
                border: "none", borderRadius: "0.375rem",
                padding: "0.375rem 0.75rem", color: "#fff",
                fontSize: "0.8rem", cursor: "pointer",
              }}
            >
              ✕ סגור
            </button>
            <img
              src={imageModalFile.fileUrl}
              alt={imageModalFile.fileName}
              style={{ maxWidth: "90vw", maxHeight: "85vh", borderRadius: "0.5rem" }}
            />
          </div>
        </div>
      )}

      {/* ═══ Upload Modal ═══ */}
      {showUploadModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
          }}
          onClick={() => setShowUploadModal(false)}
        >
          <div
            style={{
              background: "var(--surface-raised)",
              borderRadius: "0.75rem",
              padding: "2rem",
              maxWidth: "500px",
              width: "90%",
              maxHeight: "90vh",
              overflowY: "auto",
              border: "1px solid var(--border)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--foreground)", marginBottom: "1.5rem" }}>
              📤 העלה קובץ
            </h2>

            {/* File Drop Zone */}
            <div
              style={{
                border: "2px dashed var(--border)",
                borderRadius: "0.5rem",
                padding: "2rem",
                textAlign: "center",
                marginBottom: "1.5rem",
                cursor: "pointer",
                transition: "all 150ms",
                background: "var(--surface-raised)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--accent)";
                e.currentTarget.style.background = "rgba(0, 181, 254, 0.05)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--border)";
                e.currentTarget.style.background = "var(--surface-raised)";
              }}
            >
              <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📁</div>
              <div style={{ fontSize: "0.875rem", color: "var(--foreground)", marginBottom: "0.25rem" }}>
                גרור קובץ או לחץ להעלאה
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--foreground-muted)" }}>
                עד 100MB
              </div>
            </div>

            {/* Category Selector */}
            <div style={{ marginBottom: "1.5rem" }}>
              <label style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--foreground)", display: "block", marginBottom: "0.5rem" }}>
                קטגוריה
              </label>
              <select
                className="form-select"
                style={{ width: "100%", padding: "0.625rem", fontSize: "0.875rem" }}
              >
                {CATEGORY_OPTIONS.filter((c) => c.id !== "all").map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Notes Textarea */}
            <div style={{ marginBottom: "1.5rem" }}>
              <label style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--foreground)", display: "block", marginBottom: "0.5rem" }}>
                הערות (אופציונלי)
              </label>
              <textarea
                className="form-input"
                placeholder="הוסף הערות על הקובץ..."
                style={{ width: "100%", padding: "0.625rem", fontSize: "0.875rem", minHeight: "100px", resize: "vertical" }}
              />
            </div>

            {/* Buttons */}
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowUploadModal(false)}
                className="mod-btn-ghost"
                style={{ padding: "0.625rem 1.125rem", fontSize: "0.875rem" }}
              >
                ביטול
              </button>
              <button
                className="mod-btn-primary"
                style={{ padding: "0.625rem 1.125rem", fontSize: "0.875rem" }}
              >
                📤 העלה
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
