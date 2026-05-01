"use client";

import { useState, useEffect, useCallback } from "react";
import type { Client, MetaConnectionStatus } from "@/lib/db/schema";
import { useToast } from "@/components/ui/toast";

/* ── Types ── */

interface Integration {
  id: string;
  name: string;
  nameEn: string;
  icon: string;
  description: string;
  connected: boolean;
  statusLabel: string;
  statusColor: string;
  category: "social" | "ads" | "email" | "analytics" | "other";
}

interface MetaSyncStatus {
  connectionStatus: MetaConnectionStatus;
  lastSyncedAt: string | null;
  lastSyncError: string;
  metaBusinessId: string;
  metaAdAccountId: string;
  metaPageId: string;
  metaInstagramAccountId: string;
  metaPixelId: string;
}

/* ── Helpers ── */

function getRoleHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const role = localStorage.getItem("app_role") || "admin";
  const clientId = localStorage.getItem("app_client_id") || "";
  const employeeId = localStorage.getItem("app_employee_id") || "";
  const headers: Record<string, string> = { "x-app-role": role };
  if (clientId) headers["x-app-client-id"] = clientId;
  if (employeeId) headers["x-app-employee-id"] = employeeId;
  return headers;
}

function getClientIntegrations(client: Client): Integration[] {
  const c = client as any;
  const metaConnected = c.metaConnectionStatus === "connected" || c.meta_connection_status === "connected";

  return [
    {
      id: "facebook", name: "פייסבוק", nameEn: "Facebook", icon: "📘",
      description: "דף עסקי, פרסומות, ולידים מפייסבוק",
      connected: !!(c.facebookPageUrl), statusLabel: c.facebookPageUrl ? "מחובר" : "לא מחובר",
      statusColor: c.facebookPageUrl ? "#22c55e" : "#6b7280", category: "social",
    },
    {
      id: "instagram", name: "אינסטגרם", nameEn: "Instagram", icon: "📸",
      description: "פרופיל עסקי, פוסטים, וסטוריז",
      connected: !!(c.instagramProfileUrl), statusLabel: c.instagramProfileUrl ? "מחובר" : "לא מחובר",
      statusColor: c.instagramProfileUrl ? "#22c55e" : "#6b7280", category: "social",
    },
    {
      id: "tiktok", name: "טיקטוק", nameEn: "TikTok", icon: "🎵",
      description: "פרופיל עסקי וסרטוני תוכן",
      connected: !!(c.tiktokProfileUrl), statusLabel: c.tiktokProfileUrl ? "מחובר" : "לא מחובר",
      statusColor: c.tiktokProfileUrl ? "#22c55e" : "#6b7280", category: "social",
    },
    {
      id: "linkedin", name: "לינקדאין", nameEn: "LinkedIn", icon: "💼",
      description: "דף חברה ופרסום B2B",
      connected: !!(c.linkedinUrl), statusLabel: c.linkedinUrl ? "מחובר" : "לא מחובר",
      statusColor: c.linkedinUrl ? "#22c55e" : "#6b7280", category: "social",
    },
    {
      id: "youtube", name: "יוטיוב", nameEn: "YouTube", icon: "📺",
      description: "ערוץ יוטיוב ותוכן וידאו",
      connected: !!(c.youtubeUrl), statusLabel: c.youtubeUrl ? "מחובר" : "לא מחובר",
      statusColor: c.youtubeUrl ? "#22c55e" : "#6b7280", category: "social",
    },
    {
      id: "website", name: "אתר אינטרנט", nameEn: "Website", icon: "🌐",
      description: "אתר הלקוח — לניטור ביצועים וSEO",
      connected: !!(c.websiteUrl), statusLabel: c.websiteUrl ? "מחובר" : "לא מחובר",
      statusColor: c.websiteUrl ? "#22c55e" : "#6b7280", category: "other",
    },
    {
      id: "meta_ads", name: "חשבון פרסום Meta", nameEn: "Meta Ad Account", icon: "📊",
      description: "חשבון פרסום לניהול וסנכרון קמפיינים",
      connected: metaConnected,
      statusLabel: metaConnected ? "מחובר — סנכרון פעיל" : "לא מחובר",
      statusColor: metaConnected ? "#22c55e" : "#6b7280",
      category: "ads",
    },
    {
      id: "gmail", name: "Gmail / דואר", nameEn: "Gmail", icon: "✉️",
      description: "שליחת דוחות ומסמכים ללקוח",
      connected: !!(c.email), statusLabel: c.email ? `מוגדר: ${c.email}` : "לא מוגדר",
      statusColor: c.email ? "#22c55e" : "#6b7280", category: "email",
    },
    {
      id: "whatsapp", name: "ווטסאפ עסקי", nameEn: "WhatsApp Business", icon: "💬",
      description: "הודעות ישירות ללקוח דרך WhatsApp Business API",
      connected: !!(c.phone), statusLabel: c.phone ? `מספר: ${c.phone}` : "לא מוגדר",
      statusColor: c.phone ? "#22c55e" : "#6b7280", category: "email",
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

const CATEGORY_ORDER = ["ads", "social", "analytics", "email", "other"];

const META_STATUS_LABELS: Record<MetaConnectionStatus, { label: string; color: string }> = {
  connected: { label: "מחובר", color: "#22c55e" },
  not_connected: { label: "לא מחובר", color: "#6b7280" },
  token_expired: { label: "טוקן פג תוקף", color: "#ef4444" },
  missing_permissions: { label: "חסרות הרשאות", color: "#f59e0b" },
  sync_error: { label: "שגיאת סנכרון", color: "#ef4444" },
};

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "0.5rem 0.75rem", fontSize: "0.82rem",
  borderRadius: "0.375rem", border: "1px solid var(--border)",
  background: "var(--surface-sunken, var(--background))", color: "var(--foreground)",
  fontFamily: "inherit", direction: "ltr",
};

/* ── Component ── */

export default function TabIntegrations({ client }: { client: Client }) {
  const toast = useToast();
  const integrations = getClientIntegrations(client);
  const connectedCount = integrations.filter(i => i.connected).length;
  const totalCount = integrations.length;

  // ── Meta Connection State ──
  const [metaExpanded, setMetaExpanded] = useState(false);
  const [metaForm, setMetaForm] = useState({
    metaBusinessId: "",
    metaAdAccountId: "",
    metaAccessToken: "",
    metaPageId: "",
    metaInstagramAccountId: "",
    metaPixelId: "",
  });
  const [metaStatus, setMetaStatus] = useState<MetaSyncStatus | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ valid: boolean; accountName?: string; error?: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);

  // Load current Meta connection status
  useEffect(() => {
    async function loadStatus() {
      try {
        const res = await fetch(`/api/data/meta-sync/${client.id}`, { headers: getRoleHeaders() });
        if (res.ok) {
          const data = await res.json();
          setMetaStatus(data);
          setMetaForm({
            metaBusinessId: data.metaBusinessId || "",
            metaAdAccountId: data.metaAdAccountId || "",
            metaAccessToken: data.metaAdAccountId ? "••••••••" : "", // mask token if exists
            metaPageId: data.metaPageId || "",
            metaInstagramAccountId: data.metaInstagramAccountId || "",
            metaPixelId: data.metaPixelId || "",
          });
        }
      } catch { /* ignore */ }
    }
    loadStatus();
  }, [client.id]);

  // Test connection
  const handleTestConnection = useCallback(async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const token = metaForm.metaAccessToken === "••••••••" ? undefined : metaForm.metaAccessToken;
      const res = await fetch("/api/data/meta-sync/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getRoleHeaders() },
        body: JSON.stringify({
          adAccountId: metaForm.metaAdAccountId,
          accessToken: token || metaForm.metaAccessToken,
        }),
      });
      const data = await res.json();
      setTestResult(data);
      if (data.valid) {
        toast.success(`חיבור תקין — ${data.accountName || "חשבון מזוהה"}`);
      } else {
        toast.error(data.error || "החיבור נכשל");
      }
    } catch (err) {
      setTestResult({ valid: false, error: "שגיאת רשת" });
      toast.error("שגיאת רשת בבדיקת החיבור");
    } finally {
      setTesting(false);
    }
  }, [metaForm, toast]);

  // Save connection
  const handleSaveConnection = useCallback(async () => {
    setSaving(true);
    try {
      const payload: Record<string, string> = {
        clientId: client.id,
        metaBusinessId: metaForm.metaBusinessId,
        metaAdAccountId: metaForm.metaAdAccountId,
        metaPageId: metaForm.metaPageId,
        metaInstagramAccountId: metaForm.metaInstagramAccountId,
        metaPixelId: metaForm.metaPixelId,
      };
      // Only send token if it's not masked
      if (metaForm.metaAccessToken !== "••••••••") {
        payload.metaAccessToken = metaForm.metaAccessToken;
      }

      const res = await fetch("/api/data/meta-sync/save-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getRoleHeaders() },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("פרטי חיבור Meta נשמרו");
        // Reload status
        const statusRes = await fetch(`/api/data/meta-sync/${client.id}`, { headers: getRoleHeaders() });
        if (statusRes.ok) setMetaStatus(await statusRes.json());
      } else {
        toast.error(data.error || "שגיאה בשמירה");
      }
    } catch {
      toast.error("שגיאת רשת בשמירה");
    } finally {
      setSaving(false);
    }
  }, [client.id, metaForm, toast]);

  // Sync now
  const handleSyncNow = useCallback(async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch(`/api/data/meta-sync/${client.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getRoleHeaders() },
      });
      const data = await res.json();
      if (data.success) {
        setSyncResult(data.result);
        toast.success(data.result.message || "הסנכרון הושלם");
        // Reload status
        const statusRes = await fetch(`/api/data/meta-sync/${client.id}`, { headers: getRoleHeaders() });
        if (statusRes.ok) setMetaStatus(await statusRes.json());
      } else {
        toast.error(data.error || "שגיאת סנכרון");
      }
    } catch {
      toast.error("שגיאת רשת בסנכרון");
    } finally {
      setSyncing(false);
    }
  }, [client.id, toast]);

  // Group integrations
  const grouped = CATEGORY_ORDER.map(cat => ({
    category: cat,
    label: CATEGORY_LABELS[cat],
    items: integrations.filter(i => i.category === cat),
  })).filter(g => g.items.length > 0);

  const connectionStatus = metaStatus?.connectionStatus || "not_connected";
  const statusInfo = META_STATUS_LABELS[connectionStatus] || META_STATUS_LABELS.not_connected;

  return (
    <div style={{ direction: "rtl" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
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

      {/* ═══ META AD ACCOUNT CONNECTION PANEL ═══ */}
      <div style={{
        background: "var(--surface-raised)",
        border: `1px solid ${connectionStatus === "connected" ? "rgba(34, 197, 94, 0.25)" : "var(--border)"}`,
        borderRadius: "0.75rem", padding: "1.25rem", marginBottom: "1.5rem",
        borderRight: `4px solid ${statusInfo.color}`,
      }}>
        <div
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
          onClick={() => setMetaExpanded(!metaExpanded)}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span style={{ fontSize: "1.5rem" }}>📊</span>
            <div>
              <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--foreground)" }}>
                חשבון פרסום Meta
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--foreground-muted)", marginTop: "0.1rem" }}>
                סנכרון קמפיינים, קבוצות מודעות, מודעות ונתוני ביצועים
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            {metaStatus?.lastSyncedAt && (
              <span style={{ fontSize: "0.68rem", color: "var(--foreground-muted)" }}>
                סנכרון אחרון: {new Date(metaStatus.lastSyncedAt).toLocaleString("he-IL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
            <span style={{
              fontSize: "0.7rem", fontWeight: 700, padding: "0.2rem 0.6rem",
              borderRadius: "999px", background: `${statusInfo.color}14`,
              color: statusInfo.color, border: `1px solid ${statusInfo.color}30`,
            }}>
              {statusInfo.label}
            </span>
            <span style={{ fontSize: "0.8rem", color: "var(--foreground-muted)", transform: metaExpanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 150ms" }}>
              ▼
            </span>
          </div>
        </div>

        {metaExpanded && (
          <div style={{ marginTop: "1.25rem", borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
            {/* Connection form */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-muted)", marginBottom: "0.25rem" }}>
                  Meta Business ID
                </label>
                <input
                  type="text"
                  placeholder="למשל: 123456789012345"
                  value={metaForm.metaBusinessId}
                  onChange={e => setMetaForm({ ...metaForm, metaBusinessId: e.target.value })}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-muted)", marginBottom: "0.25rem" }}>
                  Meta Ad Account ID *
                </label>
                <input
                  type="text"
                  placeholder="act_123456789"
                  value={metaForm.metaAdAccountId}
                  onChange={e => setMetaForm({ ...metaForm, metaAdAccountId: e.target.value })}
                  style={inputStyle}
                />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-muted)", marginBottom: "0.25rem" }}>
                  Access Token * <span style={{ fontWeight: 400, fontSize: "0.68rem" }}>(long-lived token with ads_read permission)</span>
                </label>
                <input
                  type="password"
                  placeholder="EAA..."
                  value={metaForm.metaAccessToken}
                  onChange={e => setMetaForm({ ...metaForm, metaAccessToken: e.target.value })}
                  onFocus={e => { if (e.target.value === "••••••••") setMetaForm({ ...metaForm, metaAccessToken: "" }); }}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-muted)", marginBottom: "0.25rem" }}>
                  Connected Page ID
                </label>
                <input
                  type="text"
                  placeholder="אופציונלי"
                  value={metaForm.metaPageId}
                  onChange={e => setMetaForm({ ...metaForm, metaPageId: e.target.value })}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-muted)", marginBottom: "0.25rem" }}>
                  Instagram Account ID
                </label>
                <input
                  type="text"
                  placeholder="אופציונלי"
                  value={metaForm.metaInstagramAccountId}
                  onChange={e => setMetaForm({ ...metaForm, metaInstagramAccountId: e.target.value })}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-muted)", marginBottom: "0.25rem" }}>
                  Pixel / Dataset ID
                </label>
                <input
                  type="text"
                  placeholder="אופציונלי"
                  value={metaForm.metaPixelId}
                  onChange={e => setMetaForm({ ...metaForm, metaPixelId: e.target.value })}
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Test result */}
            {testResult && (
              <div style={{
                padding: "0.6rem 0.85rem", borderRadius: "0.375rem", marginBottom: "0.75rem",
                background: testResult.valid ? "rgba(34, 197, 94, 0.08)" : "rgba(239, 68, 68, 0.08)",
                border: `1px solid ${testResult.valid ? "rgba(34, 197, 94, 0.2)" : "rgba(239, 68, 68, 0.2)"}`,
                fontSize: "0.78rem", color: testResult.valid ? "#22c55e" : "#ef4444",
              }}>
                {testResult.valid
                  ? `✓ חיבור תקין — חשבון: ${testResult.accountName}`
                  : `✗ ${testResult.error}`}
              </div>
            )}

            {/* Error message */}
            {metaStatus?.lastSyncError && connectionStatus !== "connected" && (
              <div style={{
                padding: "0.6rem 0.85rem", borderRadius: "0.375rem", marginBottom: "0.75rem",
                background: "rgba(239, 68, 68, 0.06)", border: "1px solid rgba(239, 68, 68, 0.15)",
                fontSize: "0.75rem", color: "#ef4444",
              }}>
                שגיאה אחרונה: {metaStatus.lastSyncError}
              </div>
            )}

            {/* Sync result */}
            {syncResult && (
              <div style={{
                padding: "0.75rem 0.85rem", borderRadius: "0.375rem", marginBottom: "0.75rem",
                background: "rgba(59, 130, 246, 0.06)", border: "1px solid rgba(59, 130, 246, 0.15)",
                fontSize: "0.75rem", color: "var(--foreground)",
              }}>
                <div style={{ fontWeight: 700, marginBottom: "0.35rem" }}>תוצאות סנכרון:</div>
                <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
                  <span>קמפיינים: <strong>{syncResult.campaigns?.synced || 0}</strong> ({syncResult.campaigns?.created || 0} חדשים, {syncResult.campaigns?.updated || 0} עודכנו)</span>
                  <span>קבוצות מודעות: <strong>{syncResult.adSets?.synced || 0}</strong></span>
                  <span>מודעות: <strong>{syncResult.ads?.synced || 0}</strong></span>
                  <span>ביצועים: <strong>{syncResult.insightsUpdated || 0}</strong> שורות</span>
                </div>
                {syncResult.errors?.length > 0 && (
                  <div style={{ marginTop: "0.35rem", color: "#f59e0b", fontSize: "0.72rem" }}>
                    {syncResult.errors.length} שגיאות — {syncResult.errors[0]}
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testing || !metaForm.metaAdAccountId}
                style={{
                  padding: "0.5rem 1rem", fontSize: "0.8rem", fontWeight: 600, borderRadius: "0.375rem",
                  border: "1px solid var(--border)", background: "var(--surface)", color: "var(--foreground)",
                  cursor: testing ? "wait" : "pointer", opacity: testing || !metaForm.metaAdAccountId ? 0.5 : 1,
                  fontFamily: "inherit",
                }}
              >
                {testing ? "בודק..." : "🔌 בדוק חיבור"}
              </button>
              <button
                type="button"
                onClick={handleSaveConnection}
                disabled={saving || !metaForm.metaAdAccountId}
                style={{
                  padding: "0.5rem 1rem", fontSize: "0.8rem", fontWeight: 600, borderRadius: "0.375rem",
                  border: "1px solid var(--accent)", background: "var(--accent)", color: "#fff",
                  cursor: saving ? "wait" : "pointer", opacity: saving || !metaForm.metaAdAccountId ? 0.5 : 1,
                  fontFamily: "inherit",
                }}
              >
                {saving ? "שומר..." : "💾 שמור חיבור"}
              </button>
              {connectionStatus === "connected" && (
                <button
                  type="button"
                  onClick={handleSyncNow}
                  disabled={syncing}
                  style={{
                    padding: "0.5rem 1rem", fontSize: "0.8rem", fontWeight: 600, borderRadius: "0.375rem",
                    border: "1px solid #22c55e", background: "rgba(34, 197, 94, 0.1)", color: "#22c55e",
                    cursor: syncing ? "wait" : "pointer", opacity: syncing ? 0.5 : 1,
                    fontFamily: "inherit",
                  }}
                >
                  {syncing ? "מסנכרן..." : "🔄 סנכרן עכשיו"}
                </button>
              )}
            </div>

            {/* Not connected hint */}
            {connectionStatus === "not_connected" && !metaForm.metaAdAccountId && (
              <div style={{
                marginTop: "1rem", padding: "0.75rem", borderRadius: "0.375rem",
                background: "rgba(107, 114, 128, 0.06)", border: "1px solid rgba(107, 114, 128, 0.15)",
                fontSize: "0.78rem", color: "var(--foreground-muted)", lineHeight: 1.5,
              }}>
                חבר חשבון מודעות כדי למשוך קמפיינים קיימים מ-Meta.
                נדרש: Meta Ad Account ID ו-Access Token עם הרשאת ads_read.
                קבל טוקן ב: <span style={{ direction: "ltr", display: "inline" }}>developers.facebook.com/tools/explorer</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══ OTHER INTEGRATIONS ═══ */}
      {grouped.filter(g => g.category !== "ads").map(group => (
        <div key={group.category} style={{ marginBottom: "1.5rem" }}>
          <h4 style={{
            margin: "0 0 0.75rem 0", fontSize: "0.85rem", fontWeight: 600,
            color: "var(--foreground-muted)", letterSpacing: "0.03em",
          }}>
            {group.label}
          </h4>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "0.625rem" }}>
            {group.items.filter(i => i.id !== "meta_ads").map(integration => (
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
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: "0.5rem",
        background: integration.connected ? "rgba(34, 197, 94, 0.08)" : "var(--surface)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "1.25rem", flexShrink: 0,
        border: `1px solid ${integration.connected ? "rgba(34, 197, 94, 0.15)" : "var(--border)"}`,
      }}>
        {integration.icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.2rem" }}>
          <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--foreground)" }}>{integration.name}</span>
          <span style={{ fontSize: "0.65rem", color: "var(--foreground-muted)" }}>{integration.nameEn}</span>
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
