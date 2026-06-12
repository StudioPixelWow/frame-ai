"use client";

/**
 * Reusable Client Logo badge — shows the client's logo next to its name
 * everywhere in the system. Uses object-fit: contain on a soft rounded card so
 * logos of any shape read cleanly; falls back to the client's initials when no
 * logo is set. Keep this consistent across lists, cards and headers.
 */
import React from "react";

function initials(name?: string): string {
  if (!name) return "?";
  return name.trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

export interface ClientLogoProps {
  src?: string | null;
  name?: string;
  size?: number;          // px (default 40)
  rounded?: number;       // border radius (default size*0.28 → squircle)
  style?: React.CSSProperties;
  onClick?: () => void;
}

export default function ClientLogo({ src, name, size = 40, rounded, style, onClick }: ClientLogoProps) {
  const radius = rounded ?? Math.round(size * 0.28);
  const common: React.CSSProperties = {
    width: size, height: size, borderRadius: radius, flexShrink: 0, overflow: "hidden",
    display: "flex", alignItems: "center", justifyContent: "center", boxSizing: "border-box",
    border: "1px solid var(--border)", background: "#fff", cursor: onClick ? "pointer" : undefined, ...style,
  };
  if (src) {
    return (
      <div style={common} onClick={onClick}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={name || "logo"} style={{ width: "100%", height: "100%", objectFit: "contain", padding: Math.max(2, size * 0.1), boxSizing: "border-box", display: "block" }} />
      </div>
    );
  }
  return (
    <div style={{ ...common, background: "linear-gradient(135deg,#e0f2fe,#ede9fe)", color: "#0369a1", fontWeight: 800, fontSize: size * 0.36 }} onClick={onClick}>
      {initials(name)}
    </div>
  );
}
