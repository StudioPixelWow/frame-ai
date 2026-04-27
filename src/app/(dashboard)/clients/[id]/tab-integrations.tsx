"use client";

import { useState } from "react";
import type { Client } from "@/lib/db/schema";

interface Integration {
  id: string;
  name: string;
  nameEn: string;
  icon: string;
  description: string;
  /** Whether this integration is connected for this client */
  connected: boolean;
  /** Status label shown to the user */
  statusLabel: string;
  /** Color for the status badge */
  statusColor: string;
  /** Category grouping */
  category: "social" | "ads" | "email" | "analytics" | "other";
}

/**
 * Derive integration connection status from the client's stored URLs/fields.
 * This shows REAL status based on what data the client actually has.
 * If a URL/field is populated → connected. Otherwise → not connected.
 */
function getClientIntegrations(client: Client): Integration[] {
  const c = client as any;

  return [
    {
      id: "facebook",
      name: "פייסבוק",
      nameEn: "Facebook",
      icon: "📘",
      description: "דף עסקי, פרסומות, ולידים מפייסבוק",
      connected: !!(c.facebookPageUrl),
      statusLabel: c.facebookPageUrl ? "מחובר" : "לא מחובר",
      statusColor: c.facebookPageUrl ? "#22c55e" : "#6b7280",
      category: "social",
    },
    {
      id: "instagram",
      name: "אינסטגרם",
      nameEn: "Instagram",
      icon: "📸",
      description: "פרופיל עסקי, פוסטים, וסטוריז",
      connected: !!(c.instagramProfileUrl),
      statusLabel: c.instagramProfileUrl ? "מחובר" : "לא מחובר",
      statusColor: c.instagramProfileUrl ? "#22c55e" : "#6b7280",
      category: "social",
    },
    {
      id: "tiktok",
      name: "טיקטוק",
      nameEn: "TikTok",
      icon: "🎵",
      description: "פרופיל עסקי וסרטוני תוכן",
      connected: !!(c.tiktokProfileUrl),
      statusLabel: c.tiktokProfileUrl ? "מחובר" : "לא מחובר",
      statusColor: c.tiktokProfileUrl ? "#22c55e" : "#6b7280",
      category: "social",
    },
    {
      id: "linkedin",
      name: "לינקדאין",
      nameEn: "LinkedIn",
      icon: "💼",
      description: "דף חברה ופרסום B2B",
      connected: !!(c.linkedinUrl),
      statusLabel: c.linkedinUrl ? "מחובר" : "לא מחובר",
      statusColor: c.linkedinUrl ? "#22c55e" : "#6b7280",
      category: "social",
    },
    {
      id: "youtube",
      name: "יוטיוב",
      nameEn: "YouTube",
      icon: "📺",
      description: "ערוץ יוטיוב ותוכן וידאו",
      connected: !!(c.youtubeUrl),
      statusLabel: c.youtubeUrl ? "מחובר" : "לא מחובר",
      statusColor: c.youtubeUrl ? "#22c55e" : "#6b7280",
      category: "social",
    },
    {
      id: "website",
      name: "אתר אינטרנט",
      nameEn: "Website",
      icon: "🌐",
      description: "אתר הלקוח — לניטור ביצועים וSEO",
      connected: !!(c.websiteUrl),
      statusLabel: c.websiteUrl ? "מחובר" : "לא מחובר",
      statusColor: c.websiteUrl ? "#22c55e" : "#6b7280",
      category: "other",
    },
    {
      id: "meta_business",
      name: "Meta Business Suite",
      nameEn: "Meta Business",
      icon: "🔷",
      description: "ניהול מרכזי של Meta — פייסבוק ואינסטגרם",
      connected: false,
      statusLabel: "לא מחובר — דרוש חיבור API",
      statusColor: "#6b7280",
      category: "ads",
    },
    {
      id: "meta_ads",
      name: "חשבון פרסום Meta",
      nameEn: "Meta Ad Account",
      icon: "📊",
      description: "חשבון פרסום לניהול קמפיינים בפייסבוק ואינסטגרם",
      connected: false,
      statusLabel: "לא מחובר — דרוש חיבור API",
      statusColor: "#6b7280",
      category: "ads",
    },
    {
      id: "meta_pixel",
      name: "Meta Pixel",
      nameEn: "Meta Pixel",
      icon: "🔍",
      description: "מעקב המרות באתר — דרוש להתקנה באתר הלקוח",
      connected: false,
      statusLabel: "לא מותקן",
      statusColor: "#6b7280",
      category: "analytics",
    },
    {
      id: "google_analytics",
      name: "Google Analytics",
      nameEn: "Google Analytics",
      icon: "📈",
      description: "מעקב תנועה באתר ונתוני ביצועים",
      connected: false,
      statusLabel: "לא מחובר — דרוש חיבור API",
      statusColor: "#6b7280",
      category: "analytics",
    },
    {
      id: "gmail",
      name: "Gmail / דואר",
      nameEn: "Gmail",
      icon: "✉️",
      description: "שליחת דוחות ומסמכים ללקוח",
      connected: !!(c.email),
      statusLabel: c.email ? `מוגדר: ${c.email}` : "לא מוגדר",
      statusColor: c.email ? "#22c55e" : "#6b7280",
      category: "email",
    },
    {
      id: "whatsapp",
      name: "ווטסאפ עסקי",
      nameEn: "WhatsApp Business",
      icon: "💬",
      description: "הודעות ישירות ללקוח דרך WhatsApp Business API",
      connected: !!(c.phone),
      statusLabel: c.phone ? `מספר: ${c.phone}` : "לא מוגדר",
      statusColor: c.phone ? "#22c55e" : "#6b7280",
      category: "email",
    },
  ];
}

const CATEGORY_LABELS: Record<string, string> = {
  social: "רשתות חברתיות",
  ads: "פרסום ומדיה",
  analytics: "אנליטיקס ומעקב",
  email: "תקשורת",
  other: "אחר",
};

const CATEGORY_ORDER = ["social", "ads", "analytics", "email", "other"];

export default function TabIntegrations({ client }: { client: Client }) {
  const integrations = getClientIntegrations(client);
  const connectedCount = integrations.filter(i => i.connected).length;
  const totalCount = integrations.length;

  // Group by category
  const grouped = CATEGORY_ORDER.map(cat => ({
    category: cat,
    label: CATEGORY_LABELS[cat],
    items: integrations.filter(i => i.category === cat),
  })).filter(g => g.items.length > 0);

  return (
    <div style={{ direction: "rtl" }}>
      {/* Header */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: "1.25rem",
      }}>
        <div>
          <h3 style={{ margin: "0 0 0.25rem 0", fontSize: "1.05rem", fontWeight: 700, color: "var(--foreground)" }}>
            חיבורים ואינטגרציות
          </h3>
          <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--foreground-muted)" }}>
            {connectedCount} מתוך {totalCount} חיבורים פעילים
          </p>
        </div>
        <div style={{
          padding: "0.35rem 0.75rem", borderRadius: "999px", fontSize: "0.75rem", fontWeight: 600,
          background: connectedCount > 0 ? "rgba(34, 197, 94, 0.1)" : "rgba(107, 114, 128, 0.1)",
          color: connectedCount > 0 ? "#22c55e" : "#6b7280",
          border: `1px solid ${connectedCount > 0 ? "rgba(34, 197, 94, 0.2)" : "rgba(107, 114, 128, 0.2)"}`,
        }}>
          {connectedCount > 0 ? `${connectedCount} פעילים` : "אין חיבורים פעילים"}
        </div>
      </div>

      {/* Info banner */}
      <div style={{
        padding: "0.75rem 1rem", marginBottom: "1.25rem",
        background: "rgba(59, 130, 246, 0.06)", border: "1px solid rgba(59, 130, 246, 0.15)",
        borderRadius: "0.5rem", fontSize: "0.8rem", color: "var(--foreground-muted)",
        lineHeight: 1.5,
      }}>
        חיבורים שמסומנים כ&quot;לא מחובר — דרוש חיבור API&quot; דורשים הגדרה בהגדרות המערכת.
        חיבורים שמבוססים על כתובות URL (פייסבוק, אינסטגרם וכו&apos;) מתעדכנים אוטומטית מפרטי הלקוח.
      </div>

      {/* Integration groups */}
      {grouped.map(group => (
        <div key={group.category} style={{ marginBottom: "1.5rem" }}>
          <h4 style={{
            margin: "0 0 0.75rem 0", fontSize: "0.85rem", fontWeight: 600,
            color: "var(--foreground-muted)", textTransform: "uppercase" as const,
            letterSpacing: "0.03em",
          }}>
            {group.label}
          </h4>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "0.625rem" }}>
            {group.items.map(integration => (
              <IntegrationCard key={integration.id} integration={integration} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function IntegrationCard({ integration }: { integration: Integration }) {
  return (
    <div style={{
      background: "var(--surface-raised)",
      border: `1px solid ${integration.connected ? "rgba(34, 197, 94, 0.2)" : "var(--border)"}`,
      borderRadius: "0.625rem",
      padding: "0.875rem 1rem",
      display: "flex", gap: "0.75rem", alignItems: "flex-start",
      transition: "border-color 200ms ease, box-shadow 200ms ease",
    }}>
      {/* Icon */}
      <div style={{
        width: 40, height: 40, borderRadius: "0.5rem",
        background: integration.connected ? "rgba(34, 197, 94, 0.08)" : "var(--surface)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "1.25rem", flexShrink: 0,
        border: `1px solid ${integration.connected ? "rgba(34, 197, 94, 0.15)" : "var(--border)"}`,
      }}>
        {integration.icon}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.2rem" }}>
          <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--foreground)" }}>
            {integration.name}
          </span>
          <span style={{ fontSize: "0.65rem", color: "var(--foreground-muted)" }}>
            {integration.nameEn}
          </span>
        </div>
        <p style={{ margin: "0 0 0.35rem 0", fontSize: "0.72rem", color: "var(--foreground-muted)", lineHeight: 1.4 }}>
          {integration.description}
        </p>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: "0.35rem",
          padding: "0.15rem 0.5rem", borderRadius: "999px",
          background: integration.connected ? "rgba(34, 197, 94, 0.08)" : "rgba(107, 114, 128, 0.08)",
          fontSize: "0.68rem", fontWeight: 600,
          color: integration.statusColor,
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: "50%",
            background: integration.statusColor,
            display: "inline-block",
          }} />
          {integration.statusLabel}
        </div>
      </div>
    </div>
  );
}
