"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useClients } from "@/lib/api/use-entity";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/ui/saas-kit";

function roleHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const h: Record<string, string> = {};
  const role = localStorage.getItem("frameai_role"); if (role) h["x-app-role"] = role;
  const uid = localStorage.getItem("frameai_user_id"); if (uid) h["x-app-user-id"] = uid;
  return h;
}

const INTERVALS = [
  { sec: 20, label: "20 שניות" },
  { sec: 60, label: "דקה" },
  { sec: 120, label: "שתי דקות" },
];

const TYPE_LABELS: Record<string, string> = {
  marketing: "שיווק", website: "אתרים", hosting: "אחסון", seo: "SEO", consulting: "ייעוץ", other: "אחר",
};

export default function WhatsAppBroadcastPage() {
  const { data: clients } = useClients();
  const toast = useToast();

  // ── Connection status ──
  const [conn, setConn] = useState<any>({ state: "loading" });
  const pollConn = useCallback(async () => {
    try {
      const r = await fetch("/api/whatsapp/qr-status", { headers: roleHeaders(), cache: "no-store" });
      setConn(await r.json());
    } catch { setConn({ state: "unreachable" }); }
  }, []);
  useEffect(() => { pollConn(); const t = setInterval(pollConn, 4000); return () => clearInterval(t); }, [pollConn]);

  // ── Recipients ──
  // Coerce to string (some phones come back as numbers) and accept any phone-like field.
  const phoneOf = (c: any) => String(c?.phone ?? c?.phoneNumber ?? c?.mobile ?? c?.whatsapp ?? "").trim();
  const withPhone = useMemo(() => (clients || []).map((c: any) => ({ ...c, phone: phoneOf(c) })).filter((c: any) => c.phone), [clients]);
  const types = useMemo(() => Array.from(new Set(withPhone.map((c: any) => c.clientType || "other"))), [withPhone]);
  const [mode, setMode] = useState<"all" | "type" | "manual">("all");
  const [selTypes, setSelTypes] = useState<string[]>([]);
  const [selIds, setSelIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  const recipients = useMemo(() => {
    if (mode === "all") return withPhone;
    if (mode === "type") return withPhone.filter((c: any) => selTypes.includes(c.clientType || "other"));
    return withPhone.filter((c: any) => selIds.has(c.id));
  }, [mode, withPhone, selTypes, selIds]);

  // ── Message ──
  const [message, setMessage] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaName, setMediaName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [intervalSeconds, setIntervalSeconds] = useState(60);

  // Upload an image/video directly to storage (bypasses Vercel's 4.5MB limit).
  const uploadMedia = useCallback(async (file: File) => {
    if (!file) return;
    setUploading(true);
    try {
      const init = await fetch("/api/upload", {
        method: "POST", headers: { "Content-Type": "application/json", ...roleHeaders() },
        body: JSON.stringify({ fileName: file.name, contentType: file.type, fileSize: file.size }),
      });
      const d = await init.json();
      if (!init.ok) throw new Error(d.error || "אתחול העלאה נכשל");
      const put = await fetch(d.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file });
      if (!put.ok) throw new Error("ההעלאה נכשלה");
      setMediaUrl(d.publicUrl); setMediaName(file.name);
      toast("✓ הקובץ הועלה", "success");
    } catch (e) { toast(e instanceof Error ? e.message : "שגיאה בהעלאה", "error"); }
    finally { setUploading(false); }
  }, [toast]);

  // ── Sending / progress ──
  const [sending, setSending] = useState(false);
  const [job, setJob] = useState<any>(null);
  const pollRef = useRef<any>(null);

  const startSend = useCallback(async () => {
    if (conn.state !== "ready") { toast("הוואטסאפ לא מחובר — סרוק QR קודם", "error"); return; }
    if (recipients.length === 0) { toast("לא נבחרו נמענים עם טלפון", "error"); return; }
    if (!message.trim() && !mediaUrl.trim()) { toast("כתוב הודעה או צרף גרפיקה", "error"); return; }
    if (!confirm(`לשלוח ל-${recipients.length} נמענים, כל ${intervalSeconds} שניות?`)) return;
    setSending(true); setJob(null);
    try {
      const r = await fetch("/api/whatsapp/qr-send", {
        method: "POST", headers: { "Content-Type": "application/json", ...roleHeaders() },
        body: JSON.stringify({
          recipients: recipients.map((c: any) => ({ phone: c.phone, name: c.name })),
          message, mediaUrl: mediaUrl.trim() || undefined, intervalSeconds,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "שליחה נכשלה");
      // Poll progress.
      const id = d.jobId;
      pollRef.current = setInterval(async () => {
        try {
          const pr = await fetch(`/api/whatsapp/qr-batch/${id}`, { headers: roleHeaders(), cache: "no-store" });
          const pj = await pr.json();
          setJob(pj);
          if (pj.done) { clearInterval(pollRef.current); setSending(false); toast(`הסתיים: ${pj.sent} נשלחו · ${pj.failed} נכשלו`, "success"); }
        } catch { /* keep polling */ }
      }, 3000);
    } catch (e) { toast(e instanceof Error ? e.message : "שגיאה", "error"); setSending(false); }
  }, [conn.state, recipients, message, mediaUrl, intervalSeconds, toast]);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  // ── Weekly progress digest (scheduled every Sunday 09:00; can trigger now) ──
  const [digestBusy, setDigestBusy] = useState(false);
  const triggerDigest = useCallback(async (dryRun: boolean) => {
    setDigestBusy(true);
    try {
      const r = await fetch(`/api/cron/whatsapp-qr-weekly-digest${dryRun ? "?dryRun=1" : ""}`, { headers: roleHeaders(), cache: "no-store" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || d.skipped || "נכשל");
      if (dryRun) {
        const first = d.previews?.[0];
        toast(`תצוגה מקדימה: ${d.count} נמענים. דוגמה:\n\n${first ? first.message.replace(/\{\{name\}\}/g, first.name) : "—"}`.slice(0, 600), "info", 9000);
      } else if (d.skipped) {
        toast(d.skipped === "not_connected" ? "הוואטסאפ לא מחובר — סרוק QR" : `דולג: ${d.skipped}`, "error");
      } else {
        toast(`📤 דיוור התקדמות נשלח ל-${d.recipients} לקוחות`, "success");
      }
    } catch (e) { toast(e instanceof Error ? e.message : "שגיאה", "error"); }
    finally { setDigestBusy(false); }
  }, [toast]);

  const card: React.CSSProperties = { background: "var(--surface-raised)", border: "1px solid var(--border)", borderRadius: 14, padding: "1.25rem", marginBottom: "1.25rem" };
  const title: React.CSSProperties = { fontSize: "1rem", fontWeight: 800, marginBottom: "0.75rem", color: "var(--foreground)" };
  const seg = (active: boolean): React.CSSProperties => ({ padding: "0.4rem 0.9rem", borderRadius: 8, border: `1px solid ${active ? "#25D366" : "var(--border)"}`, background: active ? "#25D36615" : "transparent", color: active ? "#128C7E" : "var(--foreground-muted)", fontWeight: 700, fontSize: "0.82rem", cursor: "pointer" });

  return (
    <div style={{ maxWidth: 820, margin: "0 auto", direction: "rtl", padding: "1rem" }}>
      <PageHeader
        title="📣 דיוור וואטסאפ"
        subtitle="שליחת הודעות ללקוחות דרך חיבור QR — בחר נמענים, מרווח שליחה, מסר וגרפיקה."
      />

      {/* Connection */}
      <div style={card}>
        <div style={title}>חיבור</div>
        {conn.state === "not_configured" || conn.configured === false ? (
          <div style={{ fontSize: "0.85rem", color: "var(--foreground-muted)", lineHeight: 1.6 }}>
            שירות הוואטסאפ עדיין לא מחובר. יש להריץ את שירות ה-QR (תיקיית <code>whatsapp-service</code>) על שרת always-on,
            ולהגדיר ב-Vercel את <code>WHATSAPP_SERVICE_URL</code> ו-<code>WHATSAPP_SERVICE_SECRET</code>. ראה README בתיקייה.
          </div>
        ) : conn.state === "qr" && conn.qr ? (
          <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={conn.qr} alt="QR" style={{ width: 200, height: 200, borderRadius: 8, border: "1px solid var(--border)" }} />
            <div style={{ fontSize: "0.88rem", lineHeight: 1.6 }}>
              <b>סרוק כדי להתחבר:</b><br />וואטסאפ ← מכשירים מקושרים ← קישור מכשיר ← סרוק את הקוד.
            </div>
          </div>
        ) : conn.state === "ready" || conn.connected ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 800, color: "#128C7E" }}>● מחובר{conn.me?.pushname ? ` — ${conn.me.pushname}` : ""}</span>
            <button onClick={async () => { await fetch("/api/whatsapp/qr-status", { headers: roleHeaders() }); pollConn(); }} style={{ ...seg(false) }}>רענן</button>
          </div>
        ) : conn.state === "unreachable" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: "0.85rem", color: "#dc2626", lineHeight: 1.6 }}>
              שירות ה-QR לא מגיב כרגע — ייתכן שהשרת ישן/כבוי או שה-URL/Secret שגויים.
              {conn.error ? <> <span style={{ direction: "ltr", display: "inline-block", color: "#991b1b", fontFamily: "monospace", fontSize: "0.78rem" }}>({String(conn.error)})</span></> : null}
            </div>
            <div style={{ fontSize: "0.78rem", color: "var(--foreground-muted)" }}>ודא שהשירות (תיקיית <code>whatsapp-service</code>) רץ על שרת always-on, ושב-Vercel מוגדרים <code>WHATSAPP_SERVICE_URL</code> ו-<code>WHATSAPP_SERVICE_SECRET</code>.</div>
            <button onClick={pollConn} style={{ ...seg(false), width: "fit-content" }}>🔄 נסה שוב</button>
          </div>
        ) : conn.state === "disconnected" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: "0.85rem", color: "#b45309" }}>החיבור נותק. השירות מנסה להתחבר מחדש — בעוד כמה שניות אמור להופיע קוד QR חדש לסריקה.</div>
            <button onClick={pollConn} style={{ ...seg(false), width: "fit-content" }}>🔄 רענן מצב</button>
          </div>
        ) : conn.state === "starting" || conn.state === "authenticated" || conn.state === "loading" ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.85rem", color: "var(--foreground-muted)" }}>
              ⏳ {conn.state === "authenticated" ? "מאמת חיבור…" : "מאתחל את שירות הוואטסאפ… (עד דקה)"}
            </span>
            <button onClick={pollConn} style={{ ...seg(false) }}>🔄 רענן</button>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.85rem", color: "var(--foreground-muted)" }}>⏳ מתחבר…{conn.state ? <span style={{ color: "var(--foreground-subtle)", fontSize: "0.75rem" }}> ({String(conn.state)})</span> : null}</span>
            <button onClick={pollConn} style={{ ...seg(false) }}>🔄 רענן</button>
          </div>
        )}
      </div>

      {/* Weekly progress digest */}
      <div style={{ ...card, background: "linear-gradient(135deg,#ecfdf5,#eff6ff)", border: "1px solid #25D36640" }}>
        <div style={title}>📅 דיוור התקדמות שבועי (אוטומטי)</div>
        <div style={{ fontSize: "0.85rem", color: "var(--foreground-muted)", lineHeight: 1.6, marginBottom: 10 }}>
          כל יום ראשון ב-09:00 נשלח אוטומטית לכל לקוח (עם טלפון) עדכון אישי: מה הושלם השבוע, מה מתוכנן לשבוע הקרוב, והגרפיקה האחרונה שאושרה. אפשר גם להריץ עכשיו:
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => triggerDigest(true)} disabled={digestBusy} style={seg(false)}>👁 תצוגה מקדימה</button>
          <button onClick={() => triggerDigest(false)} disabled={digestBusy} style={{ ...seg(true), background: "#25D366", color: "#fff", border: "none" }}>{digestBusy ? "⏳…" : "📤 שלח עכשיו"}</button>
        </div>
      </div>

      {/* Recipients */}
      <div style={card}>
        <div style={title}>נמענים (דיוור חד-פעמי)</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          <button style={seg(mode === "all")} onClick={() => setMode("all")}>כל הלקוחות</button>
          <button style={seg(mode === "type")} onClick={() => setMode("type")}>לפי סוג</button>
          <button style={seg(mode === "manual")} onClick={() => setMode("manual")}>בחירה ידנית</button>
        </div>

        {mode === "type" && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {types.map((t) => {
              const on = selTypes.includes(t);
              const count = withPhone.filter((c: any) => (c.clientType || "other") === t).length;
              return (
                <button key={t} onClick={() => setSelTypes((p) => on ? p.filter((x) => x !== t) : [...p, t])} style={seg(on)}>
                  {TYPE_LABELS[t] || t} ({count})
                </button>
              );
            })}
          </div>
        )}

        {mode === "manual" && (
          <div>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="חיפוש לקוח…"
              style={{ width: "100%", padding: "0.5rem 0.7rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--foreground)", marginBottom: 8, boxSizing: "border-box" }} />
            <div style={{ maxHeight: 280, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 8 }}>
              {withPhone.filter((c: any) => !search || (c.name || "").includes(search)).map((c: any) => {
                const on = selIds.has(c.id);
                return (
                  <label key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "0.5rem 0.7rem", borderBottom: "1px solid var(--border)", cursor: "pointer" }}>
                    <input type="checkbox" checked={on} onChange={() => setSelIds((p) => { const n = new Set(p); if (n.has(c.id)) n.delete(c.id); else n.add(c.id); return n; })} />
                    <span style={{ fontWeight: 600, fontSize: "0.86rem" }}>{c.name}</span>
                    <span style={{ fontSize: "0.74rem", color: "var(--foreground-muted)", marginInlineStart: "auto", direction: "ltr" }}>{c.phone}</span>
                  </label>
                );
              })}
              {withPhone.length === 0 && <div style={{ padding: "0.7rem", fontSize: "0.82rem", color: "var(--foreground-muted)" }}>אין לקוחות עם מספר טלפון.</div>}
            </div>
          </div>
        )}

        <div style={{ marginTop: 10, fontSize: "0.85rem", fontWeight: 700, color: "#128C7E" }}>
          ✓ {recipients.length} נמענים ייכללו בדיוור
        </div>
        <div style={{ marginTop: 4, fontSize: "0.72rem", color: "var(--foreground-muted)" }}>
          נטענו {clients?.length || 0} לקוחות · {withPhone.length} עם מספר טלפון
          {(clients?.length || 0) > 0 && withPhone.length === 0 && <span style={{ color: "#dc2626" }}> — נראה שאין מספרי טלפון שמורים בכרטיסי הלקוח</span>}
        </div>
      </div>

      {/* Message + interval */}
      <div style={card}>
        <div style={title}>ההודעה</div>
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--foreground-muted)", marginBottom: 6 }}>מרווח בין הודעות</div>
          <div style={{ display: "flex", gap: 8 }}>
            {INTERVALS.map((iv) => (
              <button key={iv.sec} style={seg(intervalSeconds === iv.sec)} onClick={() => setIntervalSeconds(iv.sec)}>{iv.label}</button>
            ))}
          </div>
        </div>
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5}
          placeholder="טקסט ההודעה… אפשר להשתמש ב-{{name}} לשם הלקוח."
          style={{ width: "100%", padding: "0.7rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--foreground)", fontSize: "0.9rem", boxSizing: "border-box", resize: "vertical" }} />
        {/* Attach an image/video file (uploaded to storage). */}
        <div style={{ marginTop: 10 }}>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "0.5rem 0.9rem", borderRadius: 8, border: "1px dashed var(--border)", background: "var(--surface)", cursor: uploading ? "wait" : "pointer", fontSize: "0.85rem", fontWeight: 600 }}>
            {uploading ? "⏳ מעלה…" : "📎 צרף תמונה / סרטון"}
            <input type="file" accept="image/*,video/*" disabled={uploading} style={{ display: "none" }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadMedia(f); e.currentTarget.value = ""; }} />
          </label>
          {mediaUrl && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
              {/^.*\.(mp4|mov|webm|avi)(\?|$)/i.test(mediaUrl)
                ? <video src={mediaUrl} style={{ width: 70, height: 70, objectFit: "cover", borderRadius: 8, border: "1px solid var(--border)" }} muted />
                /* eslint-disable-next-line @next/next/no-img-element */
                : <img src={mediaUrl} alt="media" style={{ width: 70, height: 70, objectFit: "cover", borderRadius: 8, border: "1px solid var(--border)" }} />}
              <span style={{ fontSize: "0.8rem", color: "var(--foreground-muted)", flex: 1, wordBreak: "break-all" }}>{mediaName || "קובץ מצורף"}</span>
              <button onClick={() => { setMediaUrl(""); setMediaName(""); }} style={{ fontSize: "0.75rem", color: "#dc2626", background: "transparent", border: "none", cursor: "pointer" }}>הסר ✕</button>
            </div>
          )}
        </div>

        <button onClick={startSend} disabled={sending}
          style={{ marginTop: 14, width: "100%", padding: "0.8rem", borderRadius: 10, border: "none", background: sending ? "#9ca3af" : "#25D366", color: "#fff", fontWeight: 800, fontSize: "0.95rem", cursor: sending ? "wait" : "pointer" }}>
          {sending ? "⏳ שולח…" : `📤 שלח דיוור ל-${recipients.length} נמענים`}
        </button>

        {job && (
          <div style={{ marginTop: 14 }}>
            <div style={{ height: 10, background: "var(--surface)", borderRadius: 6, overflow: "hidden", border: "1px solid var(--border)" }}>
              <div style={{ height: "100%", width: `${Math.round(((job.sent + job.failed) / Math.max(1, job.total)) * 100)}%`, background: "#25D366", transition: "width 0.3s" }} />
            </div>
            <div style={{ marginTop: 6, fontSize: "0.82rem", color: "var(--foreground-muted)" }}>
              {job.sent + job.failed}/{job.total} · ✓ {job.sent} נשלחו · ✗ {job.failed} נכשלו {job.done ? "· הושלם" : "· בתהליך…"}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
