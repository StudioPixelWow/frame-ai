"use client";

/**
 * Global WhatsApp new-message notifier (admin only).
 * Polls the conversation list; when the unread total rises, shows a toast and
 * plays a short chime. Not true push, but surfaces incoming messages app-wide.
 */
import { useEffect, useRef } from "react";
import { useToast } from "@/components/ui/toast";

function roleHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const h: Record<string, string> = {};
  const role = localStorage.getItem("frameai_role"); if (role) h["x-app-role"] = role;
  const uid = localStorage.getItem("frameai_user_id"); if (uid) h["x-app-user-id"] = uid;
  return h;
}

export default function WaNotifier() {
  const toast = useToast();
  const lastUnread = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem("frameai_role") !== "admin") return;

    let stop = false;
    const chime = () => {
      try {
        const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (!Ctx) return;
        const ctx = new Ctx();
        const o = ctx.createOscillator(); const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.frequency.value = 880; g.gain.value = 0.05;
        o.start(); o.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.12);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
        o.stop(ctx.currentTime + 0.26);
      } catch { /* */ }
    };

    const poll = async () => {
      try {
        const r = await fetch("/api/whatsapp/qr-chats", { headers: roleHeaders(), cache: "no-store" });
        if (!r.ok) return;
        const d = await r.json();
        const total = Number(d?.totalUnread || 0);
        if (lastUnread.current !== null && total > lastUnread.current) {
          const top = (d.chats || []).find((c: any) => c.unread > 0);
          toast(`📩 הודעת וואטסאפ חדשה${top ? ` מ-${top.name}` : ""}`, "info", 6000);
          chime();
        }
        lastUnread.current = total;
      } catch { /* service down — stay quiet */ }
    };

    poll();
    const t = setInterval(() => { if (!stop) poll(); }, 15000);
    return () => { stop = true; clearInterval(t); };
  }, [toast]);

  return null;
}
