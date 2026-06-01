"use client";

import { useState, useEffect } from "react";

const LOGO_URL = "https://s-pixel.co.il/wp-content/uploads/2026/04/Asset-1.png";

function weatherEmoji(code: number): string {
  if (code === 0) return "☀️";
  if (code <= 2) return "🌤️";
  if (code === 3) return "☁️";
  if (code <= 48) return "🌫️";
  if (code <= 67) return "🌧️";
  if (code <= 77) return "🌨️";
  if (code <= 82) return "🌦️";
  if (code <= 99) return "⛈️";
  return "🌡️";
}

function greetingFor(now: Date): string {
  // Hour in Israel time
  const h = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jerusalem", hour: "2-digit", hour12: false }).format(now));
  if (h < 5) return "לילה טוב";
  if (h < 12) return "בוקר טוב";
  if (h < 17) return "צהריים טובים";
  if (h < 21) return "ערב טוב";
  return "לילה טוב";
}

/**
 * Unified welcome band shown at the top of every dashboard (employee / admin / client).
 * Logo + greeting + name, live Israel clock + Kiryat Motzkin weather, on a brand gradient.
 */
export default function WelcomeBand({
  name,
  subtitle,
  accent = "#00B5FE",
}: {
  name?: string;
  subtitle?: string;
  accent?: string;
}) {
  const [now, setNow] = useState(new Date());
  const [weather, setWeather] = useState<{ temp: number; code: number } | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    let cancel = false;
    fetch("https://api.open-meteo.com/v1/forecast?latitude=32.83&longitude=35.08&current=temperature_2m,weather_code")
      .then((r) => r.json())
      .then((d) => { if (!cancel && d?.current) setWeather({ temp: Math.round(d.current.temperature_2m), code: d.current.weather_code }); })
      .catch(() => {});
    return () => { cancel = true; clearInterval(t); };
  }, []);

  const timeStr = new Intl.DateTimeFormat("he-IL", { timeZone: "Asia/Jerusalem", hour: "2-digit", minute: "2-digit" }).format(now);
  const dateStr = new Intl.DateTimeFormat("he-IL", { timeZone: "Asia/Jerusalem", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(now);
  const greeting = greetingFor(now);

  return (
    <div style={{
      position: "relative", overflow: "hidden", borderRadius: 24, padding: "1.6rem 1.9rem", direction: "rtl",
      background: `linear-gradient(120deg, ${accent} 0%, #2dd4bf 55%, #6366f1 110%)`,
      boxShadow: "0 14px 40px rgba(0,181,254,0.28)",
    }}>
      <div style={{ position: "absolute", top: -40, insetInlineStart: -30, width: 160, height: 160, borderRadius: "50%", background: "rgba(255,255,255,0.12)" }} />
      <div style={{ position: "absolute", bottom: -60, insetInlineStart: 90, width: 130, height: 130, borderRadius: "50%", background: "rgba(255,255,255,0.08)" }} />
      <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, minWidth: 0 }}>
          <div style={{ width: 58, height: 58, borderRadius: 16, background: "rgba(255,255,255,0.92)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 6px 18px rgba(0,0,0,0.12)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={LOGO_URL} alt="PixelManageAI" style={{ height: 34, width: "auto" }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: "1.7rem", fontWeight: 800, color: "#fff", lineHeight: 1.2, textShadow: "0 1px 8px rgba(0,0,0,0.12)" }}>
              {greeting}{name ? `, ${name}` : ""} 👋
            </div>
            {subtitle && <div style={{ fontSize: "0.92rem", color: "rgba(255,255,255,0.92)", marginTop: 5 }}>{subtitle}</div>}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", background: "rgba(255,255,255,0.18)", backdropFilter: "blur(6px)", borderRadius: 16, padding: "0.5rem 1rem", minWidth: 86 }}>
            <span style={{ fontSize: "1.5rem", fontWeight: 800, color: "#fff", fontVariantNumeric: "tabular-nums", letterSpacing: "0.02em", lineHeight: 1 }}>{timeStr}</span>
            <span style={{ fontSize: "0.62rem", color: "rgba(255,255,255,0.85)", marginTop: 3 }}>שעון ישראל</span>
          </div>
          {weather && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.18)", backdropFilter: "blur(6px)", borderRadius: 16, padding: "0.5rem 0.9rem" }}>
              <span style={{ fontSize: "1.4rem" }}>{weatherEmoji(weather.code)}</span>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: "1.05rem", fontWeight: 700, color: "#fff", lineHeight: 1 }}>{weather.temp}°</span>
                <span style={{ fontSize: "0.62rem", color: "rgba(255,255,255,0.85)", marginTop: 3 }}>קרית מוצקין</span>
              </div>
            </div>
          )}
          <div style={{ fontSize: "0.75rem", color: "#fff", background: "rgba(255,255,255,0.18)", borderRadius: 999, padding: "0.45rem 0.9rem", whiteSpace: "nowrap" }}>📅 {dateStr}</div>
        </div>
      </div>
    </div>
  );
}
