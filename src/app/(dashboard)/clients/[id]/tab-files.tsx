"use client";

import { useState, useCallback, useRef, useEffect } from "react";
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
  if (bytes === 0) return "0 B";
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

export default function TabFiles({ client, onOpenUgcModal }: TabFilesProps) {
  const { data: allFiles, loading } = useClientFiles();
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showUploadModal, setShowUploadModal] = useState(false);

  const files = (allFiles || [])
    .filter((f) => f.clientId === client.id)
    .filter((f) => categoryFilter === "all" || f.category === categoryFilter)
    .filter((f) => searchQuery === "" || f.fileName.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

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
          style={{
            flex: 1,
            padding: "0.625rem 1rem",
            fontSize: "0.875rem",
          }}
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
                borderBottom: categoryFilter === cat.id ? "none" : `1px solid var(--border)`,
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
              border: `1px solid var(--border)`,
              color: "var(--foreground-muted)",
            }}
          >
            <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📭</div>
            <div style={{ marginBottom: "1.25rem" }}>אין קבצים עדיין — העלה את הקובץ הראשון</div>
            <button
              onClick={() => setShowUploadModal(true)}
              className="mod-btn-primary"
              style={{
                padding: "0.5rem 1rem",
                fontSize: "0.875rem",
              }}
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
            {files.map((file) => (
              <div
                key={file.id}
                style={{
                  background: "var(--surface-raised)",
                  border: `1px solid var(--border)`,
                  borderRadius: "0.75rem",
                  padding: "1.25rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "1rem",
                }}
              >
                {/* File Icon and Name */}
                <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                  <div
                    style={{
                      fontSize: "1.75rem",
                      lineHeight: 1,
                      minWidth: "2rem",
                    }}
                  >
                    {FILE_TYPE_ICONS[file.fileType] || FILE_TYPE_ICONS.other}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h4
                      style={{
                        fontSize: "0.875rem",
                        fontWeight: 600,
                        color: "var(--foreground)",
                        margin: "0 0 0.25rem 0",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={file.fileName}
                    >
                      {file.fileName}
                    </h4>
                    <div style={{ fontSize: "0.75rem", color: "var(--foreground-muted)" }}>
                      {formatFileSize(file.fileSize)}
                    </div>
                  </div>
                </div>

                {/* Category Badge */}
                <div
                  style={{
                    fontSize: "0.65rem",
                    padding: "0.25rem 0.625rem",
                    background: "#f0f9ff",
                    color: "#0369a1",
                    borderRadius: "0.25rem",
                    fontWeight: 600,
                    width: "fit-content",
                  }}
                >
                  {CATEGORY_LABELS[file.category]}
                </div>

                {/* File Metadata */}
                <div style={{ fontSize: "0.75rem", color: "var(--foreground-muted)", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                  <div>📅 {formatDate(file.createdAt)}</div>
                </div>

                {/* Notes Preview */}
                {file.notes && (
                  <div
                    style={{
                      fontSize: "0.8rem",
                      color: "var(--foreground-muted)",
                      lineHeight: 1.4,
                      borderLeft: `2px solid var(--border)`,
                      paddingLeft: "0.75rem",
                      maxHeight: "60px",
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
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button
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
                    className="mod-btn-ghost"
                    style={{
                      flex: 1,
                      padding: "0.5rem 0.75rem",
                      fontSize: "0.75rem",
                    }}
                  >
                    🔗 קשור
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upload Modal */}
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
              border: `1px solid var(--border)`,
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
                style={{
                  width: "100%",
                  padding: "0.625rem",
                  fontSize: "0.875rem",
                }}
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
                style={{
                  width: "100%",
                  padding: "0.625rem",
                  fontSize: "0.875rem",
                  minHeight: "100px",
                  resize: "vertical",
                }}
              />
            </div>

            {/* Buttons */}
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowUploadModal(false)}
                className="mod-btn-ghost"
                style={{
                  padding: "0.625rem 1.125rem",
                  fontSize: "0.875rem",
                }}
              >
                ביטול
              </button>
              <button
                className="mod-btn-primary"
                style={{
                  padding: "0.625rem 1.125rem",
                  fontSize: "0.875rem",
                }}
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
