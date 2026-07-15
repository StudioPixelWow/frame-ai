"use client";

/**
 * Sunday weekly-digest popup.
 *
 * On the first dashboard load each Sunday (admin only), prompts the manager to
 * compose a weekly update (text + image/video) and send it to ALL marketing-type
 * clients that have a phone — over the QR WhatsApp service. Dismissable; shown at
 * most once per Sunday (localStorage gate).
 */
import { useState, useEffect, useMemo, useCallback } from "react";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { useToast } from "@/components/ui/toast";

function roleHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const h: Record<string, string> = {};
  const role = localStorage.getItem("frameai_role"); if (role) h["x-app-role"] = role;
  const uid = localStorage.getItem("frameai_user_id"); if (uid) h["x-app-user-id"] = uid;
  return h;
}
const phoneOf = (c: any) => String(c?.phone ?? c?.phoneNumber ?? c?.mobile ?? c?.whatsapp ?? "").trim();
const todayKey = () => `wa_weekly_prompt_${new Date().toISOString().slice(0, 10)}`;

export default function WeeklyDigestPrompt() {
  const { data: dashData } = useDashboardData();
  const clients = dashData.clients ?? [];
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaName, setMediaName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [conn, setConn] = useState<any>(null);

  // Decide whether to show: admin + Sunday + not already shown today.
  useEffect(() => {
    try {
      if (localStorage.getItem("frameai_role") !== "admin") return;
      if (new Date().getDay() !== 0) return; // 0 = Sunday
      if (localStorage.getItem(todayKey())) return;
      const t = setTimeout(() => setOpen(true), 1200);
      return () => clearTimeout(t);
    } catch { /* */ }
  }, []);

  useEffect(() => {
    if (!open) return;
    fetch("/api/whatsapp/qr-status", { headers: roleHeaders(), cache: "no-store" })
      .then((r) => r.json()).then(setConn).catch(() => setConn({ state: "unreachable" }));
  }, [open]);

  const recipients = useMemo(
    () => (clients || []).filter((c: any) => (c.clientType || "") === "marketing" && phoneOf(c))
      .map((c: any) => ({ phone: phoneOf(c), name: c.name || "" })),
    [clients],
  );

  const dismiss = useCallback(() => { try { localStorage.setItem(todayKey(), "1"); } catch { /* */ } setOpen(false); }, []);

  const uploadMedia = useCallback(async (file: File) => {
    setUploading(true);
    try {
      const init = await fetch("/api/upload", { method: "POST", headers: { "Content-Type": "application/json", ...roleHeaders() }, body: JSON.stringify({ fileName: file.name, contentType: file.type, fileSize: file.size }) });
      const d = await init.json();
      if (!init.ok) throw new Error(d.error || "אתחול העלאה נכשל");
      const put = await fetch(d.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file });
      if (!put.ok) throw new Error("ההעלאה נכשלה");
      setMediaUrl(d.publicUrl); setMediaName(file.name);
    } catch (e) { toast(e instanceof Error ? e.message : "שגיאה בהעלאה", "error"); }
    finally { setUploading(false); }
  }, [toast]);

  const send = useCallback(async () => {
    if (!message.trim() && !mediaUrl) { toast("כתוב הודעה או צרף קובץ", "error"); return; }
    if (recipients.length === 0) { toast("אין לקוחות פרסום עם מספר טלפון", "error"); return; }
    setSending(true);
    try {
      const r = await fetch("/api/whatsapp/qr-send", {
        method: "POST", headers: { "Content-Type": "application/json", ...roleHeaders() },
        body: JSON.stringify({ recipients, message, mediaUrl: mediaUrl || undefined, intervalSeconds: 30 }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "שליחה נכשלה");
      toast(`📤 הדיוור נשלח ל-${recipients.length} לקוחות פרסום`, "success");
      dismiss();
    } catch (e) { toast(e instanceof Error ? e.message : "שגיאה", "error"); }
    finally { setSending(false); }
  }, [message, mediaUrl, recipients, toast, dismiss]);

  if (!open) return null;
  const connected = conn?.state === "ready" || conn?.connected;

  return (
    <div onClick={dismiss} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 7000, padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--surface-raised)", border: "1px solid var(--border)", borderRadius: 16, padding: "1.6rem", maxWidth: 480, width: "94%", direction: "rtl", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "#128C7E", marginBottom: 4 }}>📅 דיוור עדכון שבועי</div>
        <div style={{ fontSize: "0.86rem", color: "var(--foreground-muted)", marginBottom: 14, lineHeight: 1.5 }}>
          יום ראשון טוב! צור עדכון שבועי ללקוחות הפרסום — כתוב מסר וצרף תמונה/סרטון, וזה יישלח לכל {recipients.length} לקוחות הפרסום עם טלפון.
        </div>

        {!connected && (
          <div style={{ fontSize: "0.8rem", color: "#b45309", background: "#fff7ed", border: "1px solid #f59e0b40", borderRadius: 8, padding: "0.6rem", marginBottom: 12 }}>
            ⚠️ הוואטסאפ לא מחובר כרגע. חבר אותו בעמוד "דיוור וואטסאפ" כדי לשלוח.
          </div>
        )}

        <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} placeholder="טקסט העדכון… אפשר {{name}} לשם הלקוח."
          style={{ width: "100%", padding: "0.7rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--foreground)", fontSize: "0.9rem", boxSizing: "border-box", resize: "vertical" }} />

        <label style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 10, padding: "0.5rem 0.9rem", borderRadius: 8, border: "1px dashed var(--border)", background: "var(--surface)", cursor: uploading ? "wait" : "pointer", fontSize: "0.85rem", fontWeight: 600 }}>
          {uploading ? "⏳ מעלה…" : "📎 צרף תמונה / סרטון"}
          <input type="file" accept="image/*,video/*" disabled={uploading} style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadMedia(f); e.currentTarget.value = ""; }} />
        </label>
        {mediaUrl && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
            {/^.*\.(mp4|mov|webm|avi)(\?|$)/i.test(mediaUrl)
              ? <video src={mediaUrl} style={{ width: 60, height: 60, objectFit: "cover", borderRadius: 8 }} muted />
              /* eslint-disable-next-line @next/next/no-img-element */
              : <img src={mediaUrl} alt="" style={{ width: 60, height: 60, objectFit: "cover", borderRadius: 8 }} />}
            <span style={{ fontSize: "0.8rem", color: "var(--foreground-muted)", flex: 1, wordBreak: "break-all" }}>{mediaName}</span>
            <button onClick={() => { setMediaUrl(""); setMediaName(""); }} style={{ fontSize: "0.75rem", color: "#dc2626", background: "transparent", border: "none", cursor: "pointer" }}>הסר ✕</button>
          </div>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
          <button onClick={send} disabled={sending || !connected}
            style={{ flex: 1, padding: "0.7rem", borderRadius: 10, border: "none", background: (sending || !connected) ? "#9ca3af" : "#25D366", color: "#fff", fontWeight: 800, fontSize: "0.9rem", cursor: (sending || !connected) ? "not-allowed" : "pointer" }}>
            {sending ? "⏳ שולח…" : `📤 שלח ל-${recipients.length} לקוחות פרסום`}
          </button>
          <button onClick={dismiss} style={{ padding: "0.7rem 1rem", borderRadius: 10, border: "1px solid var(--border)", background: "transparent", color: "var(--foreground-muted)", fontWeight: 600, cursor: "pointer" }}>דלג להיום</button>
        </div>
      </div>
    </div>
  );
}
