"use client";

/**
 * Brand Kit tab — the client's visual foundation that all AI graphics build on:
 *   • Logo (saved on the client record as logoUrl)
 *   • Brand Colors (primary, secondary, accent, forbidden)
 *   • Typography (preferred & forbidden fonts)
 *   • Visual Personality (description, preferred/rejected styles)
 *   • Brand Rules (do's and don'ts)
 *   • Brand-assets folder (product shots, brand language, references) stored as
 *     client-files with category 'brand_asset' — this is the library Higgsfield
 *     Cloud learns the client's visual language from.
 * Pure browser uploads via the signed-URL pipeline; no server body limit.
 */

import { useCallback, useEffect, useState } from "react";
import type { Client } from "@/lib/db/schema";

const C = {
  primary: "#00B5FE", primaryDark: "#0095D0", text: "#1A1A2E", sub: "#5A5A7A",
  muted: "#9A9AB0", border: "#E8EAF0", card: "#FFFFFF", bg: "#F7F9FC", danger: "#EF4444", success: "#10B981",
  neonYellow: "#F0FF02",
};

interface BrandFile { id: string; fileName: string; fileUrl: string; category?: string; clientId: string }

interface BrandProfileData {
  clientId: string;
  profileStatus: string;
  primaryColors: string[];
  secondaryColors: string[];
  accentColors: string[];
  forbiddenColors: string[];
  preferredTypography: { fonts: string };
  forbiddenTypography: { fonts: string };
  visualPersonality: string;
  preferredVisualStyles: string[];
  rejectedVisualStyles: string[];
  brandRules: string[];
  avoidRules: string[];
}

async function signedUpload(file: File, prefix: string): Promise<{ name: string; url: string }> {
  const init = await fetch("/api/upload", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName: `${prefix}/${Date.now()}_${file.name}`, contentType: file.type, fileSize: file.size }),
  });
  if (!init.ok) throw new Error("קבלת כתובת העלאה נכשלה");
  const { uploadUrl, publicUrl } = await init.json();
  const put = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file });
  if (!put.ok) throw new Error("ההעלאה נכשלה");
  return { name: file.name, url: publicUrl };
}

/* ── Color Swatch + Remove ── */
function ColorSwatch({ color, onRemove, forbidden }: { color: string; onRemove: () => void; forbidden?: boolean }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: C.bg, border: `1.5px solid ${forbidden ? C.danger : C.border}`, borderRadius: 8, padding: "4px 8px 4px 4px" }}>
      <div style={{ width: 22, height: 22, borderRadius: 6, background: color, border: `1px solid ${C.border}`, flexShrink: 0 }} />
      <span style={{ fontSize: 12, fontFamily: "monospace", color: C.text }}>{color}</span>
      <button
        onClick={onRemove}
        style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 14, fontWeight: 800, padding: "0 2px", lineHeight: 1 }}
        title="הסר"
      >
        &times;
      </button>
    </div>
  );
}

/* ── Add-Color mini form ── */
function AddColorButton({ onAdd }: { onAdd: (hex: string) => void }) {
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState("#");

  const submit = () => {
    const hex = val.trim();
    if (/^#[0-9a-fA-F]{3,8}$/.test(hex)) {
      onAdd(hex);
      setVal("#");
      setOpen(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{ background: "none", border: `1.5px dashed ${C.border}`, borderRadius: 8, padding: "4px 10px", fontSize: 12, color: C.primary, fontWeight: 700, cursor: "pointer" }}
      >
        + הוסף צבע
      </button>
    );
  }

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <input
        autoFocus
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") { setOpen(false); setVal("#"); } }}
        placeholder="#FF00AA"
        style={{ width: 90, fontSize: 12, fontFamily: "monospace", padding: "4px 6px", border: `1px solid ${C.border}`, borderRadius: 6, outline: "none" }}
      />
      <button onClick={submit} style={{ background: C.primary, color: "#fff", border: "none", borderRadius: 6, padding: "4px 8px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
        +
      </button>
      <button onClick={() => { setOpen(false); setVal("#"); }} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 13, fontWeight: 800 }}>
        &times;
      </button>
    </div>
  );
}

/* ── Color Group Row ── */
function ColorGroup({ label, colors, onChange, forbidden }: { label: string; colors: string[]; onChange: (c: string[]) => void; forbidden?: boolean }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: forbidden ? C.danger : C.sub, marginBottom: 6 }}>{label}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
        {colors.map((c, i) => (
          <ColorSwatch key={`${c}-${i}`} color={c} forbidden={forbidden} onRemove={() => onChange(colors.filter((_, idx) => idx !== i))} />
        ))}
        <AddColorButton onAdd={(hex) => onChange([...colors, hex])} />
      </div>
    </div>
  );
}

/* ── Section card wrapper ── */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "1.1rem 1.25rem", marginBottom: 16 }}>
      <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 12 }}>{title}</div>
      {children}
    </div>
  );
}

/* ── Label + Input helper ── */
function LabeledInput({ label, value, onChange, placeholder, multiline }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean }) {
  const shared = {
    width: "100%",
    fontSize: 13,
    padding: "8px 10px",
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    outline: "none",
    fontFamily: "inherit",
    color: C.text,
    background: C.bg,
    resize: "vertical" as const,
  };
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: C.sub, marginBottom: 4 }}>{label}</div>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          style={shared}
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={shared}
        />
      )}
    </div>
  );
}

export default function TabBrandKit({ client }: { client: Client }) {
  const [logoUrl, setLogoUrl] = useState<string>((client as any).logoUrl || "");
  const [assets, setAssets] = useState<BrandFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");

  /* ── Brand profile state ── */
  const [profileId, setProfileId] = useState<string | null>(null);
  const [primaryColors, setPrimaryColors] = useState<string[]>([]);
  const [secondaryColors, setSecondaryColors] = useState<string[]>([]);
  const [accentColors, setAccentColors] = useState<string[]>([]);
  const [forbiddenColors, setForbiddenColors] = useState<string[]>([]);
  const [preferredFonts, setPreferredFonts] = useState("");
  const [forbiddenFonts, setForbiddenFonts] = useState("");
  const [visualPersonality, setVisualPersonality] = useState("");
  const [preferredStyles, setPreferredStyles] = useState("");
  const [rejectedStyles, setRejectedStyles] = useState("");
  const [brandRules, setBrandRules] = useState("");
  const [avoidRules, setAvoidRules] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  /* ── Load assets ── */
  const loadAssets = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/data/client-files`, { cache: "no-store" });
      const all = await r.json();
      setAssets((Array.isArray(all) ? all : []).filter((f: any) => f.clientId === client.id && f.category === "brand_asset"));
    } catch { setAssets([]); } finally { setLoading(false); }
  }, [client.id]);
  useEffect(() => { loadAssets(); }, [loadAssets]);

  /* ── Load brand profile ── */
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/api/data/brand-style-profiles`, { cache: "no-store" });
        const all = await r.json();
        const profiles: any[] = Array.isArray(all) ? all : [];
        const match = profiles.find((p: any) => p.clientId === client.id);
        if (match) {
          setProfileId(match.id);
          setPrimaryColors(Array.isArray(match.primaryColors) ? match.primaryColors : []);
          setSecondaryColors(Array.isArray(match.secondaryColors) ? match.secondaryColors : []);
          setAccentColors(Array.isArray(match.accentColors) ? match.accentColors : []);
          setForbiddenColors(Array.isArray(match.forbiddenColors) ? match.forbiddenColors : []);
          setPreferredFonts(match.preferredTypography?.fonts || "");
          setForbiddenFonts(match.forbiddenTypography?.fonts || "");
          setVisualPersonality(match.visualPersonality || "");
          setPreferredStyles(Array.isArray(match.preferredVisualStyles) ? match.preferredVisualStyles.join(", ") : "");
          setRejectedStyles(Array.isArray(match.rejectedVisualStyles) ? match.rejectedVisualStyles.join(", ") : "");
          setBrandRules(Array.isArray(match.brandRules) ? match.brandRules.join("\n") : "");
          setAvoidRules(Array.isArray(match.avoidRules) ? match.avoidRules.join("\n") : "");
        }
      } catch { /* no profile yet — that's fine */ }
    })();
  }, [client.id]);

  /* ── Save brand profile ── */
  const saveBrandProfile = async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      const splitCsv = (s: string) => s.split(",").map((v) => v.trim()).filter(Boolean);
      const splitLines = (s: string) => s.split("\n").map((v) => v.trim()).filter(Boolean);

      const payload: BrandProfileData = {
        clientId: client.id,
        profileStatus: "active",
        primaryColors,
        secondaryColors,
        accentColors,
        forbiddenColors,
        preferredTypography: { fonts: preferredFonts },
        forbiddenTypography: { fonts: forbiddenFonts },
        visualPersonality,
        preferredVisualStyles: splitCsv(preferredStyles),
        rejectedVisualStyles: splitCsv(rejectedStyles),
        brandRules: splitLines(brandRules),
        avoidRules: splitLines(avoidRules),
      };

      let res: Response;
      if (profileId) {
        res = await fetch(`/api/data/brand-style-profiles/${profileId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`/api/data/brand-style-profiles`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) throw new Error("שמירה נכשלה");
      const saved = await res.json();
      if (saved.id) setProfileId(saved.id);
      setSaveMsg("נשמר בהצלחה!");
      setTimeout(() => setSaveMsg(null), 3000);
    } catch (e) {
      setSaveMsg(e instanceof Error ? e.message : "שגיאה בשמירה");
    } finally {
      setSaving(false);
    }
  };

  const uploadLogo = async (file: File) => {
    setBusy("logo");
    try {
      const { url } = await signedUpload(file, `brand/${client.id}/logo`);
      await fetch(`/api/data/clients/${client.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ logoUrl: url }) });
      setLogoUrl(url);
    } catch (e) { alert(e instanceof Error ? e.message : "שגיאה"); } finally { setBusy(""); }
  };

  const uploadAssets = async (files: FileList) => {
    setBusy("assets");
    try {
      for (const file of Array.from(files)) {
        const { name, url } = await signedUpload(file, `brand/${client.id}/assets`);
        await fetch(`/api/data/client-files`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientId: client.id, category: "brand_asset", fileName: name, fileUrl: url }),
        });
      }
      await loadAssets();
    } catch (e) { alert(e instanceof Error ? e.message : "שגיאה"); } finally { setBusy(""); }
  };

  const deleteAsset = async (id: string) => {
    if (!confirm("למחוק את הקובץ?")) return;
    try { await fetch(`/api/data/client-files/${id}`, { method: "DELETE" }); setAssets((p) => p.filter((a) => a.id !== id)); } catch { /* */ }
  };

  const isImg = (u: string) => /\.(png|jpe?g|webp|gif|avif|svg)(\?|$)/i.test(u || "");

  return (
    <div dir="rtl" style={{ color: C.text }}>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 20, fontWeight: 900, margin: "0 0 4px" }}>🎨 ערכת מותג</h2>
        <p style={{ fontSize: 13, color: C.sub, margin: 0 }}>הבסיס הוויזואלי של הלקוח — הלוגו ותיקיית העזרים שכל יצירת גרפיקה ב-AI (כולל Higgsfield) תלמד ותתבסס עליהם.</p>
      </div>

      {/* Logo */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "1.1rem 1.25rem", marginBottom: 16 }}>
        <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10 }}>לוגו הלקוח</div>
        <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ width: 110, height: 110, borderRadius: 14, border: `1px solid ${C.border}`, background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
            {logoUrl ? <img src={logoUrl} alt="logo" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} /> : <span style={{ color: C.muted, fontSize: 12 }}>אין לוגו</span>}
          </div>
          <div>
            <label style={{ display: "inline-block", background: C.primary, color: "#fff", borderRadius: 10, padding: "0.55rem 1.1rem", fontWeight: 800, fontSize: 13, cursor: "pointer" }}>
              {busy === "logo" ? "⏳ מעלה…" : logoUrl ? "החלף לוגו" : "העלה לוגו"}
              <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadLogo(f); e.currentTarget.value = ""; }} />
            </label>
            <div style={{ fontSize: 11.5, color: C.muted, marginTop: 6 }}>PNG עם רקע שקוף מומלץ · SVG/JPG נתמכים</div>
          </div>
        </div>
      </div>

      {/* ── Brand Colors ── */}
      <Section title="🎨 צבעי מותג">
        <ColorGroup label="צבעים ראשיים" colors={primaryColors} onChange={setPrimaryColors} />
        <ColorGroup label="צבעים משניים" colors={secondaryColors} onChange={setSecondaryColors} />
        <ColorGroup label="צבעי דגש" colors={accentColors} onChange={setAccentColors} />
        <ColorGroup label="צבעים אסורים" colors={forbiddenColors} onChange={setForbiddenColors} forbidden />
      </Section>

      {/* ── Typography ── */}
      <Section title="🔤 טיפוגרפיה">
        <LabeledInput label="פונטים מועדפים" value={preferredFonts} onChange={setPreferredFonts} placeholder="לדוגמה: Heebo, Assistant, Rubik" />
        <LabeledInput label="פונטים אסורים" value={forbiddenFonts} onChange={setForbiddenFonts} placeholder="לדוגמה: Comic Sans, Papyrus" />
      </Section>

      {/* ── Visual Personality ── */}
      <Section title="✨ אישיות ויזואלית">
        <LabeledInput label="תיאור אישיות ויזואלית" value={visualPersonality} onChange={setVisualPersonality} placeholder="תאר את האישיות הוויזואלית של המותג — מודרני, חם, מקצועי, נועז..." multiline />
        <LabeledInput label="סגנונות מועדפים" value={preferredStyles} onChange={setPreferredStyles} placeholder="מינימליסטי, מודרני, נקי (מופרדים בפסיק)" />
        <LabeledInput label="סגנונות נדחים" value={rejectedStyles} onChange={setRejectedStyles} placeholder="וינטג׳, רועש, מיושן (מופרדים בפסיק)" />
      </Section>

      {/* ── Brand Rules ── */}
      <Section title="📋 כללי מותג">
        <LabeledInput label="כללי מותג" value={brandRules} onChange={setBrandRules} placeholder="כתוב כללים — כל שורה = כלל אחד" multiline />
        <LabeledInput label="כללים להימנע" value={avoidRules} onChange={setAvoidRules} placeholder="דברים שאסור לעשות — כל שורה = כלל אחד" multiline />
      </Section>

      {/* ── Save Button ── */}
      <div style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <button
          onClick={saveBrandProfile}
          disabled={saving}
          style={{
            background: saving ? C.muted : C.primary,
            color: "#fff",
            border: "none",
            borderRadius: 10,
            padding: "0.65rem 1.6rem",
            fontWeight: 800,
            fontSize: 14,
            cursor: saving ? "not-allowed" : "pointer",
            opacity: saving ? 0.7 : 1,
            transition: "opacity 0.2s",
          }}
        >
          {saving ? "⏳ שומר..." : "שמור ערכת מותג"}
        </button>
        {saveMsg && (
          <span style={{
            fontSize: 13,
            fontWeight: 700,
            color: saveMsg === "נשמר בהצלחה!" ? C.success : C.danger,
          }}>
            {saveMsg}
          </span>
        )}
      </div>

      {/* Brand assets folder */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "1.1rem 1.25rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, flexWrap: "wrap", gap: 8 }}>
          <div style={{ fontWeight: 800, fontSize: 14 }}>תיקיית עזרים גרפיים ({assets.length})</div>
          <label style={{ display: "inline-block", background: C.primaryDark, color: "#fff", borderRadius: 10, padding: "0.5rem 1rem", fontWeight: 800, fontSize: 12.5, cursor: "pointer" }}>
            {busy === "assets" ? "⏳ מעלה…" : "+ העלה עזרים"}
            <input type="file" accept="image/*" multiple style={{ display: "none" }} onChange={(e) => { if (e.target.files?.length) uploadAssets(e.target.files); e.currentTarget.value = ""; }} />
          </label>
        </div>
        <p style={{ fontSize: 12, color: C.sub, margin: "0 0 12px" }}>העלה תמונות מוצרים, דוגמאות שפה גרפית, צבעים, פונטים, רפרנסים — כל מה שיעזור ל-AI ללמוד את השפה הוויזואלית של הלקוח.</p>

        {loading ? <div style={{ color: C.muted, fontSize: 13, padding: "1rem" }}>טוען…</div> :
          assets.length === 0 ? <div style={{ color: C.muted, fontSize: 13, padding: "1.5rem", textAlign: "center", border: `1px dashed ${C.border}`, borderRadius: 12 }}>עדיין אין עזרים. העלה תמונות כדי לבנות את השפה הגרפית.</div> : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px,1fr))", gap: 10 }}>
              {assets.map((a) => (
                <div key={a.id} style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden", position: "relative", background: C.bg }}>
                  <button onClick={() => deleteAsset(a.id)} title="מחק" style={{ position: "absolute", top: 5, left: 5, background: "rgba(0,0,0,0.6)", color: "#fff", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 800, padding: "1px 6px", cursor: "pointer", zIndex: 2 }}>✕</button>
                  {isImg(a.fileUrl)
                    ? <img src={a.fileUrl} alt={a.fileName} loading="lazy" style={{ width: "100%", height: 110, objectFit: "cover", display: "block" }} />
                    : <div style={{ height: 110, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26 }}>📄</div>}
                  <div style={{ fontSize: 10.5, color: C.sub, padding: "4px 6px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.fileName}</div>
                </div>
              ))}
            </div>
          )}
      </div>
    </div>
  );
}
