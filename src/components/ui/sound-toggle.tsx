"use client";

import { useState, useEffect } from "react";
import { sound } from "@/lib/sound-feedback";

/* ═══════════════════════════════════════════════════════════════════════════
   SoundToggle — small mute/unmute button for sound feedback
   Place in sidebar, settings, or header
   ═══════════════════════════════════════════════════════════════════════════ */

export function SoundToggle() {
  const [muted, setMuted] = useState(true); // default muted until init

  useEffect(() => {
    sound.init();
    setMuted(sound.isMuted());
  }, []);

  const toggle = () => {
    const newMuted = sound.toggleMute();
    setMuted(newMuted);
    if (!newMuted) sound.pop(); // play a pop when unmuting
  };

  return (
    <button
      onClick={toggle}
      className="living-sound-toggle"
      title={muted ? "הפעל צלילים" : "השתק צלילים"}
      aria-label={muted ? "הפעל צלילים" : "השתק צלילים"}
      style={{
        background: "none",
        border: "1px solid var(--border)",
        borderRadius: "0.375rem",
        padding: "0.35rem 0.5rem",
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: "0.3rem",
        fontSize: "0.75rem",
        color: "var(--foreground-muted)",
        transition: "all 200ms ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--accent)";
        e.currentTarget.style.color = "var(--foreground)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--border)";
        e.currentTarget.style.color = "var(--foreground-muted)";
      }}
    >
      <span style={{ fontSize: "0.9rem" }}>{muted ? "🔇" : "🔊"}</span>
      <span>{muted ? "מושתק" : "צלילים"}</span>
    </button>
  );
}
