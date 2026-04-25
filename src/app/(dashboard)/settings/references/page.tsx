"use client";

import { useState, useEffect, useCallback } from "react";
import { useData } from "@/lib/api/use-data";

interface AdReference {
  id: string;
  imageUrl: string;
  description: string;
  source: string;
  sourceUrl: string;
  industry: string;
  contentType: string;
  platform: string;
  style: string;
  tags: string[];
  advertiserName: string;
  engagementScore: number;
  isActive: boolean;
}

const SOURCES = ["Meta Ad Library", "TikTok Creative Center", "Pinterest Ads", "Google Display", "Ads Inspiration"];
const CONTENT_TYPES = ["social_post", "reel", "story", "carousel"];
const PLATFORMS = ["facebook", "instagram", "tiktok", "all"];
const STYLES = ["minimal", "bold_text", "lifestyle", "product_focus", "testimonial", "ugc", "cinematic", "infographic"];

const STYLE_LABELS: Record<string, string> = {
  minimal: "מינימליסטי", bold_text: "טקסט בולט", lifestyle: "לייפסטייל",
  product_focus: "מוצר", testimonial: "עדות לקוח", ugc: "UGC",
  cinematic: "קולנועי", infographic: "אינפוגרפיקה",
};

const CONTENT_LABELS: Record<string, string> = {
  social_post: "פוסט", reel: "ריל", story: "סטורי", carousel: "קרוסלה",
};

const PLATFORM_LABELS: Record<string, string> = {
  facebook: "Facebook", instagram: "Instagram", tiktok: "TikTok", all: "הכל",
};

const emptyForm = {
  imageUrl: "", description: "", source: SOURCES[0], sourceUrl: "",
  industry: "", contentType: "social_post", platform: "instagram",
  style: "lifestyle", tags: "", advertiserName: "", engagementScore: 70,
};

export default function ReferencesSettingsPage() {
  const { data: refs, refresh, create, remove } = useData<AdReference>("/api/data/ad-references");
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterIndustry, setFilterIndustry] = useState("");
  const [filterPlatform, setFilterPlatform] = useState("");

  const handleSubmit = async () => {
    if (!form.imageUrl || !form.description) return;
    setSaving(true);
    try {
      await create({
        ...form,
        tags: form.tags.split(",").map(t => t.trim()).filter(Boolean),
        addedBy: "admin",
      } as any);
      setForm(emptyForm);
      setShowForm(false);
      refresh();
    } catch (err) {
      console.error("Failed to create reference:", err);
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("למחוק רפרנס זה?")) return;
    try {
      await remove(id);
      refresh();
    } catch (err) {
      console.error("Failed to delete:", err);
    }
  };

  const filtered = (refs || []).filter(r => {
    if (filterIndustry && !r.industry?.toLowerCase().includes(filterIndustry.toLowerCase())) return false;
    if (filterPlatform && r.platform !== filterPlatform && r.platform !== "all") return false;
    return true;
  });

  return (
    <div style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--foreground)", margin: 0 }}>
            ניהול רפרנסים
          </h1>
          <p style={{ fontSize: "0.85rem", color: "var(--foreground-muted)", margin: "0.25rem 0 0" }}>
            הוסף מודעות מתחרים אמיתיות מ-Meta Ad Library ומקורות אחרים
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            padding: "0.6rem 1.2rem", borderRadius: "10px",
            background: "var(--accent)", color: "#fff", border: "none",
            fontWeight: 600, cursor: "pointer", fontSize: "0.85rem",
          }}
        >
          {showForm ? "ביטול" : "+ הוסף רפרנס"}
        </button>
      </div>

      {/* Add Form */}
      {showForm && (
        <div style={{
          padding: "1.5rem", borderRadius: "14px",
          background: "var(--surface)", border: "1px solid var(--border)",
          marginBottom: "1.5rem",
        }}>
          <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "1rem", color: "var(--foreground)" }}>
            רפרנס חדש
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div>
              <label style={labelStyle}>כתובת תמונה *</label>
              <input style={inputStyle} value={form.imageUrl} onChange={e => setForm({ ...form, imageUrl: e.target.value })} placeholder="https://..." />
            </div>
            <div>
              <label style={labelStyle}>שם מפרסם</label>
              <input style={inputStyle} value={form.advertiserName} onChange={e => setForm({ ...form, advertiserName: e.target.value })} placeholder="שם החברה/מפרסם" />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>תיאור *</label>
              <textarea style={{ ...inputStyle, minHeight: "60px", resize: "vertical" }} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="תיאור המודעה..." />
            </div>
            <div>
              <label style={labelStyle}>מקור</label>
              <select style={inputStyle} value={form.source} onChange={e => setForm({ ...form, source: e.target.value })}>
                {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>קישור למקור</label>
              <input style={inputStyle} value={form.sourceUrl} onChange={e => setForm({ ...form, sourceUrl: e.target.value })} placeholder="https://..." />
            </div>
            <div>
              <label style={labelStyle}>תעשייה</label>
              <input style={inputStyle} value={form.industry} onChange={e => setForm({ ...form, industry: e.target.value })} placeholder="נדל\"ן, מזון, טכנולוגיה..." />
            </div>
            <div>
              <label style={labelStyle}>סוג תוכן</label>
              <select style={inputStyle} value={form.contentType} onChange={e => setForm({ ...form, contentType: e.target.value })}>
                {CONTENT_TYPES.map(c => <option key={c} value={c}>{CONTENT_LABELS[c] || c}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>פלטפורמה</label>
              <select style={inputStyle} value={form.platform} onChange={e => setForm({ ...form, platform: e.target.value })}>
                {PLATFORMS.map(p => <option key={p} value={p}>{PLATFORM_LABELS[p] || p}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>סגנון</label>
              <select style={inputStyle} value={form.style} onChange={e => setForm({ ...form, style: e.target.value })}>
                {STYLES.map(s => <option key={s} value={s}>{STYLE_LABELS[s] || s}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>תגיות (מופרדות בפסיק)</label>
              <input style={inputStyle} value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} placeholder="מודעה, מתחרים, השראה" />
            </div>
            <div>
              <label style={labelStyle}>ציון מעורבות (0-100)</label>
              <input style={inputStyle} type="number" min={0} max={100} value={form.engagementScore} onChange={e => setForm({ ...form, engagementScore: Number(e.target.value) })} />
            </div>
          </div>
          <div style={{ marginTop: "1rem", display: "flex", gap: "0.75rem" }}>
            <button onClick={handleSubmit} disabled={saving || !form.imageUrl || !form.description} style={{
              padding: "0.5rem 1.5rem", borderRadius: "8px",
              background: !form.imageUrl || !form.description ? "var(--border)" : "var(--accent)",
              color: "#fff", border: "none", fontWeight: 600, cursor: "pointer",
            }}>
              {saving ? "שומר..." : "שמור"}
            </button>
            <button onClick={() => { setShowForm(false); setForm(emptyForm); }} style={{
              padding: "0.5rem 1.5rem", borderRadius: "8px",
              background: "transparent", color: "var(--foreground-muted)", border: "1px solid var(--border)",
              cursor: "pointer",
            }}>
              ביטול
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
        <input
          style={{ ...inputStyle, maxWidth: "200px" }}
          value={filterIndustry}
          onChange={e => setFilterIndustry(e.target.value)}
          placeholder="סנן לפי תעשייה..."
        />
        <select style={{ ...inputStyle, maxWidth: "160px" }} value={filterPlatform} onChange={e => setFilterPlatform(e.target.value)}>
          <option value="">כל הפלטפורמות</option>
          {PLATFORMS.map(p => <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>)}
        </select>
        <span style={{ fontSize: "0.8rem", color: "var(--foreground-muted)", alignSelf: "center" }}>
          {filtered.length} רפרנסים
        </span>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div style={{
          padding: "3rem 2rem", textAlign: "center", borderRadius: "14px",
          background: "var(--surface)", border: "1px solid var(--border)",
        }}>
          <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📷</div>
          <h3 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--foreground)", margin: "0 0 0.5rem" }}>
            אין רפרנסים עדיין
          </h3>
          <p style={{ fontSize: "0.85rem", color: "var(--foreground-muted)", margin: 0 }}>
            הוסף מודעות אמיתיות מ-Meta Ad Library או מקורות אחרים כדי להציגן בגאנט
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1rem" }}>
          {filtered.map(ref => (
            <div key={ref.id} style={{
              borderRadius: "12px", overflow: "hidden",
              background: "var(--surface)", border: "1px solid var(--border)",
              transition: "box-shadow 0.2s",
            }}>
              {ref.imageUrl && (
                <div style={{ width: "100%", aspectRatio: "5/4", overflow: "hidden", background: "var(--background)" }}>
                  <img
                    src={ref.imageUrl}
                    alt={ref.description}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                </div>
              )}
              <div style={{ padding: "0.75rem" }}>
                <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
                  <span style={badgeStyle}>{PLATFORM_LABELS[ref.platform] || ref.platform}</span>
                  <span style={badgeStyle}>{CONTENT_LABELS[ref.contentType] || ref.contentType}</span>
                  <span style={badgeStyle}>{STYLE_LABELS[ref.style] || ref.style}</span>
                </div>
                {ref.advertiserName && (
                  <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--foreground)", marginBottom: "0.25rem" }}>
                    {ref.advertiserName}
                  </div>
                )}
                <p style={{ fontSize: "0.78rem", color: "var(--foreground-muted)", margin: "0 0 0.5rem", lineHeight: 1.4 }}>
                  {ref.description}
                </p>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "0.7rem", color: "var(--foreground-muted)" }}>
                    {ref.source} · ⚡ {ref.engagementScore}%
                  </span>
                  <button
                    onClick={() => handleDelete(ref.id)}
                    style={{
                      fontSize: "0.7rem", padding: "0.2rem 0.5rem",
                      background: "transparent", border: "1px solid var(--border)",
                      borderRadius: "6px", color: "#ef4444", cursor: "pointer",
                    }}
                  >
                    מחק
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: "0.78rem", fontWeight: 600,
  color: "var(--foreground)", marginBottom: "0.3rem",
};

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "0.5rem 0.75rem", borderRadius: "8px",
  border: "1px solid var(--border)", background: "var(--background)",
  color: "var(--foreground)", fontSize: "0.85rem", boxSizing: "border-box",
};

const badgeStyle: React.CSSProperties = {
  padding: "0.15rem 0.5rem", borderRadius: "999px",
  background: "var(--accent-muted)", color: "var(--accent)",
  fontSize: "0.65rem", fontWeight: 600,
};
