"use client";

/**
 * Client-portal welcome popup — shown once per login session to CLIENT users
 * inside the portal. Premium, uplifting, reinforces the Studio Pixel partnership.
 * Logo focal point (circular badge, brand-yellow ring, object-fit: contain) above
 * the client name + a random uplifting (or per-client custom) message.
 *
 * For clients only — does NOT affect the internal employee welcome popup.
 */
import { useState, useEffect } from "react";

const DEFAULT_MSGS = [
  "Studio Pixel על זה — היום ממשיכים לקדם את המותג שלך 🚀",
  "הנוכחות הדיגיטלית שלך בידיים טובות. בוא נגרום להיום להיחשב ✨",
  "עוד יום להפוך רעיונות לתוכן, קמפיינים ותוצאות אמיתיות 😎",
  "אנחנו כאן מאחורי הקלעים, דואגים שהמותג שלך ימשיך להופיע חזק 💪",
  "העסק שלך ראוי למומנטום — ואנחנו כאן כדי ליצור אותו 🚀",
  "ממשיכים לבנות נראות, אמון ותוצאות עבור המותג שלך ✨",
  "Studio Pixel איתך — הופכים אסטרטגיה לפעולה, צעד אחר צעד 😎",
];

export default function ClientWelcomePopup({ clientName = "", logoUrl = "", messages = [] }: { clientName?: string; logoUrl?: string; messages?: string[] }) {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!clientName) return;
    const cid = (new URLSearchParams(window.location.search).get("clientId")) || localStorage.getItem("frameai_client_id") || clientName;
    const key = `frameai_client_welcome_${cid}`;
    if (sessionStorage.getItem(key)) return;
    const first = clientName.split(/\s+/)[0] || clientName;
    const pool = (messages && messages.length) ? messages : DEFAULT_MSGS;
    const picked = (pool[Math.floor(Math.random() * pool.length)] || "").replace(/\{client_name\}/g, first).replace(/\{name\}/g, first);
    setMsg(picked);
    const t = setTimeout(() => { setOpen(true); sessionStorage.setItem(key, "1"); }, 600);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientName]);

  if (!open) return null;

  return (
    <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 8000, padding: 20, animation: "cwp-fade 0.3s ease" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--surface-raised, #fff)", borderRadius: 22, padding: "2rem 2.2rem", maxWidth: 380, width: "92%", textAlign: "center", direction: "rtl", boxShadow: "0 24px 70px rgba(0,0,0,0.28)", animation: "cwp-pop 0.4s cubic-bezier(0.18,1.25,0.4,1)" }}>
        {logoUrl && (
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
            <div className="cwp-logo-wrap">
              <span className="cwp-ring" aria-hidden />
              <span className="cwp-logo-float" style={{ width: 152, height: 152, borderRadius: "50%", border: "5px solid var(--yellow, #E8F401)", boxShadow: "0 0 0 1px rgba(232,244,1,0.25), 0 0 18px rgba(232,244,1,0.45)", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", boxSizing: "border-box", padding: 16 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoUrl} alt={clientName} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
              </span>
            </div>
          </div>
        )}
        <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--foreground, #0f172a)", marginBottom: 8 }}>היי, {clientName} 👋</div>
        <div style={{ fontSize: "1rem", color: "var(--foreground-muted, #64748b)", lineHeight: 1.5, marginBottom: 20 }}>{msg}</div>
        <button onClick={() => setOpen(false)} style={{ width: "100%", padding: "0.7rem", borderRadius: 12, border: "none", background: "var(--accent, #00B5FE)", color: "#fff", fontWeight: 800, fontSize: "0.95rem", cursor: "pointer" }}>תודה, קדימה ✨</button>
      </div>
      <style>{`
        @keyframes cwp-fade{from{opacity:0}to{opacity:1}}
        @keyframes cwp-pop{from{opacity:0;transform:scale(0.85)}to{opacity:1;transform:scale(1)}}
        @keyframes cwp-spin{to{transform:rotate(360deg)}}
        @keyframes cwp-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
        @keyframes cwp-glow{0%,100%{opacity:.6;transform:scale(1)}50%{opacity:.95;transform:scale(1.06)}}
        .cwp-logo-wrap{position:relative;width:152px;height:152px;display:flex;align-items:center;justify-content:center}
        .cwp-ring{position:absolute;inset:-16px;border-radius:50%;background:conic-gradient(from 0deg,var(--accent,#00B5FE),var(--yellow,#E8F401),var(--accent,#00B5FE),var(--yellow,#E8F401),var(--accent,#00B5FE));filter:blur(11px);opacity:.75;z-index:0;animation:cwp-spin 4.5s linear infinite,cwp-glow 2.6s ease-in-out infinite}
        .cwp-logo-float{position:relative;z-index:1;animation:cwp-float 3.2s ease-in-out infinite}
        @media (prefers-reduced-motion: reduce){.cwp-ring,.cwp-logo-float{animation:none}}
      `}</style>
    </div>
  );
}
