"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react";
import ChatThread from "@/components/whatsapp/chat-thread";
import { PageHeader } from "@/components/ui/saas-kit";

function roleHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const h: Record<string, string> = {};
  const role = localStorage.getItem("frameai_role"); if (role) h["x-app-role"] = role;
  const uid = localStorage.getItem("frameai_user_id"); if (uid) h["x-app-user-id"] = uid;
  return h;
}

interface Chat { chatId: string; phone: string; name: string; unread: number; timestamp: number; lastMessage: string }

export default function WhatsAppInboxPage() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [active, setActive] = useState<Chat | null>(null);
  const [status, setStatus] = useState<string>("loading");
  const [search, setSearch] = useState("");

  const loadChats = useCallback(async () => {
    try {
      const r = await fetch("/api/whatsapp/qr-chats", { headers: roleHeaders(), cache: "no-store" });
      const d = await r.json();
      if (!r.ok) { setStatus(d.error === "not_configured" ? "not_configured" : (d.error || "error")); return; }
      setStatus("ok");
      setChats(Array.isArray(d.chats) ? d.chats : []);
    } catch { setStatus("unreachable"); }
  }, []);

  useEffect(() => { loadChats(); const t = setInterval(loadChats, 10000); return () => clearInterval(t); }, [loadChats]);

  const filtered = chats.filter((c) => !search || (c.name || "").includes(search) || (c.phone || "").includes(search));
  const fmt = (t: number) => { try { return t ? new Date(t * 1000).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit" }) : ""; } catch { return ""; } };

  return (
    <div style={{ direction: "rtl", padding: "1rem", maxWidth: 1100, margin: "0 auto" }}>
      <PageHeader title="💬 תיבת וואטסאפ" subtitle="שיחות נכנסות ויוצאות דרך חיבור ה-QR" />

      {status === "not_configured" ? (
        <div style={{ padding: "1rem", border: "1px solid var(--border)", borderRadius: 12, color: "var(--foreground-muted)" }}>
          שירות הוואטסאפ לא מחובר. חבר אותו בעמוד "דיוור וואטסאפ".
        </div>
      ) : status === "unreachable" ? (
        <div style={{ padding: "1rem", border: "1px solid var(--border)", borderRadius: 12, color: "#dc2626" }}>השירות לא נגיש כרגע.</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 14, alignItems: "start" }}>
          {/* Conversation list */}
          <div style={{ border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", background: "var(--surface)" }}>
            <div style={{ padding: 8, borderBottom: "1px solid var(--border)" }}>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="חיפוש שיחה…"
                style={{ width: "100%", padding: "0.45rem 0.6rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--foreground)", fontSize: "0.85rem", boxSizing: "border-box" }} />
            </div>
            <div style={{ maxHeight: 560, overflowY: "auto" }}>
              {filtered.length === 0 ? <div style={{ padding: "1rem", color: "var(--foreground-muted)", fontSize: "0.85rem" }}>{status === "loading" ? "⏳ טוען…" : "אין שיחות"}</div>
                : filtered.map((c) => (
                  <button key={c.chatId} onClick={() => setActive(c)}
                    style={{ display: "flex", flexDirection: "column", gap: 2, width: "100%", textAlign: "start", padding: "0.6rem 0.8rem", border: "none", borderBottom: "1px solid var(--border)", background: active?.chatId === c.chatId ? "var(--accent-muted)" : "transparent", cursor: "pointer" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                      <span style={{ fontWeight: 700, fontSize: "0.86rem", color: "var(--foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</span>
                      <span style={{ fontSize: "0.66rem", color: "var(--foreground-muted)", flexShrink: 0 }}>{fmt(c.timestamp)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: "0.76rem", color: "var(--foreground-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}>{c.lastMessage}</span>
                      {c.unread > 0 && <span style={{ background: "#25D366", color: "#fff", borderRadius: 10, fontSize: "0.66rem", fontWeight: 800, padding: "1px 7px", flexShrink: 0 }}>{c.unread}</span>}
                    </div>
                  </button>
                ))}
            </div>
          </div>

          {/* Active thread */}
          <div>
            {active ? <ChatThread key={active.chatId} chatId={active.chatId} name={active.name} height={600} />
              : <div style={{ height: 600, display: "flex", alignItems: "center", justifyContent: "center", border: "1px dashed var(--border)", borderRadius: 12, color: "var(--foreground-muted)" }}>בחר שיחה כדי להתחיל להתכתב</div>}
          </div>
        </div>
      )}
    </div>
  );
}
