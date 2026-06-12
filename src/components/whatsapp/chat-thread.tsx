"use client";

/**
 * Reusable WhatsApp chat thread — message history + composer (text + attach).
 * Used both in the Inbox page and embedded in the client card (by phone).
 * Polls for new messages while mounted.
 */
import { useState, useEffect, useRef, useCallback } from "react";

function roleHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const h: Record<string, string> = {};
  const role = localStorage.getItem("frameai_role"); if (role) h["x-app-role"] = role;
  const uid = localStorage.getItem("frameai_user_id"); if (uid) h["x-app-user-id"] = uid;
  return h;
}

interface Msg { id: string; body: string; fromMe: boolean; timestamp: number; type: string; hasMedia: boolean }

// Lazily downloads + renders a message's media (image/video) inline. Cached per id.
const mediaCache = new Map<string, string>();
function MediaBubble({ chatId, msgId }: { chatId: string; msgId: string }) {
  const [url, setUrl] = useState<string | null>(mediaCache.get(`${chatId}|${msgId}`) || null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const key = `${chatId}|${msgId}`;
    if (mediaCache.has(key)) { setUrl(mediaCache.get(key)!); return; }
    let cancelled = false;
    fetch(`/api/whatsapp/qr-media?chatId=${encodeURIComponent(chatId)}&msgId=${encodeURIComponent(msgId)}`, { headers: roleHeaders(), cache: "no-store" })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (cancelled) return; if (d?.dataUrl) { mediaCache.set(key, d.dataUrl); setUrl(d.dataUrl); } else setFailed(true); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [chatId, msgId]);
  if (failed) return <span style={{ color: "#555" }}>📎 מדיה</span>;
  if (!url) return <span style={{ color: "#999", fontSize: "0.75rem" }}>⏳ טוען מדיה…</span>;
  const isVideo = /^data:video/i.test(url);
  return isVideo
    ? <video src={url} controls style={{ maxWidth: 220, borderRadius: 8, display: "block", marginBottom: 4 }} />
    /* eslint-disable-next-line @next/next/no-img-element */
    : <img src={url} alt="media" style={{ maxWidth: 220, borderRadius: 8, display: "block", marginBottom: 4 }} />;
}

export default function ChatThread({ chatId, phone, name, height = 420 }: { chatId?: string; phone?: string; name?: string; height?: number }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [resolvedChatId, setResolvedChatId] = useState<string | undefined>(chatId);
  const scrollRef = useRef<HTMLDivElement>(null);
  const target = chatId ? `chatId=${encodeURIComponent(chatId)}` : `phone=${encodeURIComponent(phone || "")}`;

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/whatsapp/qr-chat?${target}`, { headers: roleHeaders(), cache: "no-store" });
      const d = await r.json();
      if (!r.ok) { setError(d.error === "not_connected" ? "הוואטסאפ לא מחובר" : (d.error || "טעינה נכשלה")); setMessages([]); }
      else { setError(null); setMessages(Array.isArray(d.messages) ? d.messages : []); if (d.chatId) setResolvedChatId(d.chatId); }
    } catch { setError("השירות לא נגיש"); }
    finally { setLoading(false); }
  }, [target]);

  useEffect(() => { setLoading(true); load(); const t = setInterval(load, 6000); return () => clearInterval(t); }, [load]);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages]);
  // Mark as read on open.
  useEffect(() => { fetch("/api/whatsapp/qr-send-message", { method: "PATCH", headers: { "Content-Type": "application/json", ...roleHeaders() }, body: JSON.stringify({ chatId, phone }) }).catch(() => {}); }, [chatId, phone]);

  const send = useCallback(async (mediaUrl?: string) => {
    if (!text.trim() && !mediaUrl) return;
    setSending(true);
    const optimistic: Msg = { id: `tmp_${Date.now()}`, body: text || (mediaUrl ? "📎 קובץ" : ""), fromMe: true, timestamp: Date.now() / 1000, type: "chat", hasMedia: !!mediaUrl };
    setMessages((m) => [...m, optimistic]);
    const body = text;
    setText("");
    try {
      const r = await fetch("/api/whatsapp/qr-send-message", { method: "POST", headers: { "Content-Type": "application/json", ...roleHeaders() }, body: JSON.stringify({ chatId, phone, message: body, mediaUrl }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "שליחה נכשלה");
      setTimeout(load, 800);
    } catch (e) {
      setError(e instanceof Error ? e.message : "שליחה נכשלה");
      setMessages((m) => m.filter((x) => x.id !== optimistic.id));
    } finally { setSending(false); }
  }, [text, chatId, phone, load]);

  const onFile = useCallback(async (file: File) => {
    setUploading(true);
    try {
      const init = await fetch("/api/upload", { method: "POST", headers: { "Content-Type": "application/json", ...roleHeaders() }, body: JSON.stringify({ fileName: file.name, contentType: file.type, fileSize: file.size }) });
      const d = await init.json();
      if (!init.ok) throw new Error(d.error || "העלאה נכשלה");
      const put = await fetch(d.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file });
      if (!put.ok) throw new Error("העלאה נכשלה");
      await send(d.publicUrl);
    } catch (e) { setError(e instanceof Error ? e.message : "העלאה נכשלה"); }
    finally { setUploading(false); }
  }, [send]);

  const fmtTime = (t: number) => { try { return new Date(t * 1000).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" }); } catch { return ""; } };

  return (
    <div style={{ display: "flex", flexDirection: "column", height, border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", background: "var(--surface)" }}>
      {name && <div style={{ padding: "0.6rem 0.9rem", borderBottom: "1px solid var(--border)", fontWeight: 700, fontSize: "0.9rem", background: "var(--surface-raised)" }}>💬 {name}</div>}
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "0.8rem", display: "flex", flexDirection: "column", gap: 6, background: "#e9edef10" }}>
        {loading ? <div style={{ margin: "auto", color: "var(--foreground-muted)", fontSize: "0.85rem" }}>⏳ טוען…</div>
          : error ? <div style={{ margin: "auto", color: "#dc2626", fontSize: "0.85rem", textAlign: "center" }}>{error}</div>
          : messages.length === 0 ? <div style={{ margin: "auto", color: "var(--foreground-muted)", fontSize: "0.85rem" }}>אין הודעות עדיין</div>
          : messages.map((m) => (
            <div key={m.id} style={{ alignSelf: m.fromMe ? "flex-start" : "flex-end", maxWidth: "78%", background: m.fromMe ? "#d9fdd3" : "#ffffff", color: "#111", border: "1px solid var(--border)", borderRadius: 10, padding: "0.4rem 0.6rem", fontSize: "0.85rem", lineHeight: 1.35, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {m.hasMedia && resolvedChatId && <MediaBubble chatId={resolvedChatId} msgId={m.id} />}
              {m.body}
              <div style={{ fontSize: "0.62rem", color: "#667781", marginTop: 2, textAlign: "start" }}>{fmtTime(m.timestamp)}</div>
            </div>
          ))}
      </div>
      <div style={{ display: "flex", gap: 6, padding: "0.5rem", borderTop: "1px solid var(--border)", background: "var(--surface-raised)" }}>
        <label style={{ display: "flex", alignItems: "center", padding: "0 0.5rem", cursor: uploading ? "wait" : "pointer", fontSize: "1.1rem" }} title="צרף תמונה/סרטון">
          {uploading ? "⏳" : "📎"}
          <input type="file" accept="image/*,video/*" disabled={uploading} style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.currentTarget.value = ""; }} />
        </label>
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="כתוב הודעה…" disabled={sending}
          style={{ flex: 1, padding: "0.5rem 0.7rem", borderRadius: 20, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--foreground)", fontSize: "0.88rem" }} />
        <button onClick={() => send()} disabled={sending || (!text.trim())} style={{ padding: "0 0.9rem", borderRadius: 20, border: "none", background: sending ? "#9ca3af" : "#25D366", color: "#fff", fontWeight: 800, cursor: sending ? "wait" : "pointer" }}>שלח</button>
      </div>
    </div>
  );
}
