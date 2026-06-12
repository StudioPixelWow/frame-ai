"use client";

/**
 * Reusable employee/user Avatar — ALWAYS a perfect circle with the brand-yellow
 * stroke + subtle glow. Use this everywhere (welcome popup, team screens, menus,
 * cards) so avatar styling stays consistent. Falls back to initials when no image.
 *
 * Brand yellow comes from the existing design token --yellow (#E8F401).
 */
import React from "react";

function initials(name?: string): string {
  if (!name) return "?";
  return name.trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

export interface AvatarProps {
  src?: string | null;
  name?: string;
  size?: number;            // px diameter (default 40)
  ring?: boolean;           // brand-yellow stroke + glow (default true)
  style?: React.CSSProperties;
  onClick?: () => void;
}

export default function Avatar({ src, name, size = 40, ring = true, style, onClick }: AvatarProps) {
  // Responsive stroke 3–6px based on diameter.
  const stroke = size < 44 ? 3 : size < 80 ? 4 : size < 120 ? 5 : 6;
  const ringStyle: React.CSSProperties = ring
    ? { border: `${stroke}px solid var(--yellow)`, boxShadow: `0 0 0 1px rgba(232,244,1,0.25), 0 0 14px rgba(232,244,1,0.45)` }
    : {};
  const common: React.CSSProperties = {
    width: size, height: size, borderRadius: "50%", flexShrink: 0,
    overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center",
    boxSizing: "border-box", cursor: onClick ? "pointer" : undefined, ...ringStyle, ...style,
  };
  if (src) {
    return (
      <div style={common} onClick={onClick}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={name || "avatar"} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", borderRadius: "50%" }} />
      </div>
    );
  }
  return (
    <div
      style={{ ...common, background: "linear-gradient(135deg,#e0f2fe,#ede9fe)", color: "#0369a1", fontWeight: 800, fontSize: size * 0.4 }}
      onClick={onClick}
    >
      {initials(name)}
    </div>
  );
}
