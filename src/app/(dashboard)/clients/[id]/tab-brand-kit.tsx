"use client";

/**
 * Brand Kit tab — the client's visual foundation that all AI graphics build on:
 *   • Logo (saved on the client record as logoUrl)
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
};

interface BrandFile { id: string; fileName: string; fileUrl: string; category?: string; clientId: string }

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

export default function TabBrandKit({ client }: { client: Client }) {
  const [logoUrl, setLogoUrl] = useState<string>((client as any).logoUrl || "");
  const [assets, setAssets] = useState<BrandFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");

  const loadAssets = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/data/client-files`, { cache: "no-store" });
      const all = await r.json();
      setAssets((Array.isArray(all) ? all : []).filter((f: any) => f.clientId === client.id && f.category === "brand_asset"));
    } catch { setAssets([]); } finally { setLoading(false); }
  }, [client.id]);
  useEffect(() => { loadAssets(); }, [loadAssets]);

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
