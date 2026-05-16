"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import type { Client, MetaConnectionStatus } from "@/lib/db/schema";
import { useToast } from "@/components/ui/toast";

/* ── Types ── */

type AdPlatform = "meta" | "tiktok" | "google";

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

interface PlatformStatus {
  platform: string;
  accountId: string;
  hasToken: boolean;
  status: MetaConnectionStatus;
  lastSyncedAt: string | null;
  lastSyncError: string;
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
      id: "tiktok_social", name: "טיקטוק", nameEn: "TikTok", icon: "🎵",
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

const CATEGORY_ORDER = ["social", "analytics", "email", "other"];

const STATUS_LABELS: Record<MetaConnectionStatus, { label: string; color: string }> = {
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

/* ── Platform configs ── */

interface PlatformConfig {
  key: AdPlatform;
  name: string;
  nameEn: string;
  icon: string;
  color: string;
  description: string;
  fields: { key: string; label: string; placeholder: string; required?: boolean; type?: string; hint?: string }[];
}

const PLATFORM_CONFIGS: PlatformConfig[] = [
  {
    key: "meta",
    name: "חשבון פרסום Meta",
    nameEn: "Meta Ad Account",
    icon: "📊",
    color: "#1877f2",
    description: "סנכרון קמפיינים, קבוצות מודעות, מודעות ונתוני ביצועים מ-Facebook/Instagram",
    fields: [
      { key: "metaBusinessId", label: "Meta Business ID", placeholder: "למשל: 123456789012345" },
      { key: "metaAdAccountId", label: "Meta Ad Account ID *", placeholder: "act_123456789", required: true },
      { key: "metaAccessToken", label: "Access Token *", placeholder: "EAA...", required: true, type: "password", hint: "long-lived token with ads_read permission" },
      { key: "metaPageId", label: "Connected Page ID", placeholder: "אופציונלי" },
      { key: "metaInstagramAccountId", label: "Instagram Account ID", placeholder: "אופציונלי" },
      { key: "metaPixelId", label: "Pixel / Dataset ID", placeholder: "אופציונלי" },
    ],
  },
  {
    key: "tiktok",
    name: "חשבון פרסום TikTok",
    nameEn: "TikTok Ads",
    icon: "🎵",
    color: "#000000",
    description: "סנכרון קמפיינים, קבוצות מודעות ונתוני ביצועים מ-TikTok Marketing API",
    fields: [
      { key: "tiktokAdvertiserId", label: "Advertiser ID *", placeholder: "7123456789", required: true },
      { key: "tiktokAccessToken", label: "Access Token *", placeholder: "long-lived access token", required: true, type: "password" },
    ],
  },
  {
    key: "google",
    name: "חשבון פרסום Google",
    nameEn: "Google Ads",
    icon: "🔍",
    color: "#4285f4",
    description: "סנכרון קמפיינים, קבוצות מודעות ונתוני ביצועים מ-Google Ads API",
    fields: [
      { key: "googleCustomerId", label: "Customer ID *", placeholder: "123-456-7890", required: true },
      { key: "googleRefreshToken", label: "OAuth Refresh Token *", placeholder: "1//...", required: true, type: "password" },
      { key: "googleDeveloperToken", label: "Developer Token", placeholder: "אופציונלי — יילקח מהגדרות השרת" },
      { key: "googleManagerId", label: "Manager Account ID", placeholder: "אופציונלי — MCC account" },
    ],
  },
];

/* ── Component ── */

export default function TabIntegrations({ client }: { client: Client }) {
  const toast = useToast();
  const searchParams = useSearchParams();
  const integrations = getClientIntegrations(client);
  const connectedCount = integrations.filter(i => i.connected).length;
  const totalCount = integrations.length;

  // Show success toast if OAuth redirect has 'connected' param
  useEffect(() => {
    const connected = searchParams.get('connected');
    if (connected === 'meta') {
      toast('חשבון Meta חובר בהצלחה דרך OAuth', 'success');
    } else if (connected === 'google') {
      toast('חשבון Google Ads חובר בהצלחה דרך OAuth', 'success');
    }
  }, [searchParams, toast]);

  // ── Platform connection states ──
  const [expandedPlatform, setExpandedPlatform] = useState<AdPlatform | null>(null);
  const [platformStatuses, setPlatformStatuses] = useState<Record<AdPlatform, PlatformStatus | null>>({
    meta: null, tiktok: null, google: null,
  });
  const [platformForms, setPlatformForms] = useState<Record<AdPlatform, Record<string, string>>>({
    meta: {}, tiktok: {}, google: {},
  });
  const [testing, setTesting] = useState<AdPlatform | null>(null);
  const [testResult, setTestResult] = useState<Record<AdPlatform, { valid: boolean; accountName?: string; error?: string } | null>>({
    meta: null, tiktok: null, google: null,
  });
  const [saving, setSaving] = useState<AdPlatform | null>(null);
  const [syncing, setSyncing] = useState<AdPlatform | null>(null);
  const [syncResults, setSyncResults] = useState<Record<AdPlatform, any>>({
    meta: null, tiktok: null, google: null,
  });

  // ── WordPress connection state ──
  const c = client as any;
  const [wpExpanded, setWpExpanded] = useState(false);
  const [wpForm, setWpForm] = useState({
    siteUrl: c.wpSiteUrl || c.wp_site_url || '',
    username: c.wpUsername || c.wp_username || '',
    applicationPassword: c.wpApplicationPassword || c.wp_application_password || '',
  });
  const [wpTesting, setWpTesting] = useState(false);
  const [wpSaving, setWpSaving] = useState(false);
  const [wpTestResult, setWpTestResult] = useState<{ success: boolean; siteName?: string; error?: string } | null>(null);
  const wpConnected = (c.wpConnectionStatus === 'connected' || c.wp_connection_status === 'connected') && !!(c.wpSiteUrl || c.wp_site_url);

  const handleWpTest = useCallback(async () => {
    if (!wpForm.siteUrl || !wpForm.username || !wpForm.applicationPassword) return;
    setWpTesting(true);
    setWpTestResult(null);
    try {
      const res = await fetch('/api/seo-geo-plans/test-wp-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getRoleHeaders() },
        body: JSON.stringify(wpForm),
      });
      const data = await res.json();
      setWpTestResult(data.success ? { success: true, siteName: data.siteName } : { success: false, error: data.error || 'החיבור נכשל' });
      if (data.success) toast(`WordPress מחובר — ${data.siteName || 'אתר מזוהה'}`, 'success');
      else toast(data.error || 'החיבור נכשל', 'error');
    } catch {
      setWpTestResult({ success: false, error: 'שגיאת רשת' });
      toast('שגיאת רשת', 'error');
    } finally { setWpTesting(false); }
  }, [wpForm, toast]);

  const handleWpSave = useCallback(async () => {
    setWpSaving(true);
    try {
      const res = await fetch(`/api/clients/${client.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getRoleHeaders() },
        body: JSON.stringify({
          wpSiteUrl: wpForm.siteUrl,
          wpUsername: wpForm.username,
          wpApplicationPassword: wpForm.applicationPassword,
          wpConnectionStatus: wpTestResult?.success ? 'connected' : 'not_connected',
          wpSiteName: wpTestResult?.siteName || '',
          wpConnectedAt: wpTestResult?.success ? new Date().toISOString() : null,
        }),
      });
      if (res.ok) toast('פרטי WordPress נשמרו בכרטיסיית הלקוח', 'success');
      else toast('שגיאה בשמירה', 'error');
    } catch { toast('שגיאת רשת', 'error'); }
    finally { setWpSaving(false); }
  }, [client.id, wpForm, wpTestResult, toast]);

  // Load all platform statuses
  useEffect(() => {
    async function loadStatuses() {
      try {
        const res = await fetch(`/api/data/platform-sync?clientId=${client.id}`, { headers: getRoleHeaders() });
        if (!res.ok) return;
        const data = await res.json();
        if (!data.platforms) return;

        const newStatuses: Record<AdPlatform, PlatformStatus | null> = { meta: null, tiktok: null, google: null };
        const newForms: Record<AdPlatform, Record<string, string>> = { meta: {}, tiktok: {}, google: {} };

        for (const p of ["meta", "tiktok", "google"] as AdPlatform[]) {
          if (data.platforms[p]) {
            newStatuses[p] = data.platforms[p];
            // Pre-fill form with account ID, mask token
            const config = PLATFORM_CONFIGS.find(c => c.key === p);
            if (config) {
              const form: Record<string, string> = {};
              for (const f of config.fields) {
                if (f.key.includes("AccountId") || f.key.includes("BusinessId") || f.key.includes("PageId") ||
                    f.key.includes("InstagramAccount") || f.key.includes("PixelId") || f.key.includes("AdvertiserId") ||
                    f.key.includes("CustomerId") || f.key.includes("ManagerId") || f.key.includes("DeveloperToken")) {
                  form[f.key] = data.platforms[p].accountId && f.required ? data.platforms[p].accountId : "";
                } else if (f.type === "password") {
                  form[f.key] = data.platforms[p].hasToken ? "••••••••" : "";
                } else {
                  form[f.key] = "";
                }
              }
              // For meta, load from existing meta-sync endpoint for full details
              if (p === "meta") {
                try {
                  const metaRes = await fetch(`/api/data/meta-sync/${client.id}`, { headers: getRoleHeaders() });
                  if (metaRes.ok) {
                    const metaData = await metaRes.json();
                    form.metaBusinessId = metaData.metaBusinessId || "";
                    form.metaAdAccountId = metaData.metaAdAccountId || "";
                    form.metaAccessToken = metaData.metaAdAccountId ? "••••••••" : "";
                    form.metaPageId = metaData.metaPageId || "";
                    form.metaInstagramAccountId = metaData.metaInstagramAccountId || "";
                    form.metaPixelId = metaData.metaPixelId || "";
                  }
                } catch { /* ignore */ }
              }
              newForms[p] = form;
            }
          }
        }

        setPlatformStatuses(newStatuses);
        setPlatformForms(newForms);
      } catch { /* ignore */ }
    }
    loadStatuses();
  }, [client.id]);

  // Update form field
  const updateForm = useCallback((platform: AdPlatform, key: string, value: string) => {
    setPlatformForms(prev => ({
      ...prev,
      [platform]: { ...prev[platform], [key]: value },
    }));
  }, []);

  // Test connection
  const handleTestConnection = useCallback(async (platform: AdPlatform) => {
    setTesting(platform);
    setTestResult(prev => ({ ...prev, [platform]: null }));
    try {
      const form = platformForms[platform];
      const config = PLATFORM_CONFIGS.find(c => c.key === platform)!;
      const requiredFields = config.fields.filter(f => f.required);
      const accountIdField = requiredFields[0];
      const tokenField = requiredFields.find(f => f.type === "password");

      const accountId = form[accountIdField.key] || "";
      let accessToken = tokenField ? form[tokenField.key] || "" : "";
      if (accessToken === "••••••••") accessToken = ""; // need real token for test

      const res = await fetch("/api/data/platform-sync/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getRoleHeaders() },
        body: JSON.stringify({ platform, accountId, accessToken }),
      });
      const data = await res.json();
      setTestResult(prev => ({ ...prev, [platform]: data }));
      if (data.valid) {
        toast(`חיבור ${platform} תקין — ${data.accountName || "חשבון מזוהה"}`, 'success');
      } else {
        toast(data.error || "החיבור נכשל", 'error');
      }
    } catch {
      setTestResult(prev => ({ ...prev, [platform]: { valid: false, error: "שגיאת רשת" } }));
      toast("שגיאת רשת בבדיקת החיבור", 'error');
    } finally {
      setTesting(null);
    }
  }, [platformForms, toast]);

  // Save connection
  const handleSaveConnection = useCallback(async (platform: AdPlatform) => {
    setSaving(platform);
    try {
      const form = platformForms[platform];
      const payload: Record<string, string> = { clientId: client.id, platform };

      // Add all non-masked fields
      for (const [key, value] of Object.entries(form)) {
        if (value !== "••••••••") {
          payload[key] = value;
        }
      }

      const res = await fetch("/api/data/platform-sync/save-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getRoleHeaders() },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        toast(`פרטי חיבור ${platform} נשמרו`, 'success');
        // Reload statuses
        const statusRes = await fetch(`/api/data/platform-sync?clientId=${client.id}`, { headers: getRoleHeaders() });
        if (statusRes.ok) {
          const statusData = await statusRes.json();
          if (statusData.platforms) {
            setPlatformStatuses(prev => ({ ...prev, [platform]: statusData.platforms[platform] || null }));
          }
        }
      } else {
        toast(data.error || "שגיאה בשמירה", 'error');
      }
    } catch {
      toast("שגיאת רשת בשמירה", 'error');
    } finally {
      setSaving(null);
    }
  }, [client.id, platformForms, toast]);

  // Sync now
  const handleSyncNow = useCallback(async (platform: AdPlatform) => {
    setSyncing(platform);
    setSyncResults(prev => ({ ...prev, [platform]: null }));
    try {
      const res = await fetch("/api/data/platform-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getRoleHeaders() },
        body: JSON.stringify({ clientId: client.id, platform }),
      });
      const data = await res.json();
      if (data.success && data.results?.[0]) {
        const result = data.results[0];
        setSyncResults(prev => ({ ...prev, [platform]: result }));
        toast(result.message || "הסנכרון הושלם", 'success');
        // Reload statuses
        const statusRes = await fetch(`/api/data/platform-sync?clientId=${client.id}`, { headers: getRoleHeaders() });
        if (statusRes.ok) {
          const statusData = await statusRes.json();
          if (statusData.platforms) {
            setPlatformStatuses(prev => ({ ...prev, [platform]: statusData.platforms[platform] || null }));
          }
        }
      } else {
        toast(data.error || "שגיאת סנכרון", 'error');
      }
    } catch {
      toast("שגיאת רשת בסנכרון", 'error');
    } finally {
      setSyncing(null);
    }
  }, [client.id, toast]);

  // Sync ALL platforms
  const handleSyncAll = useCallback(async () => {
    setSyncing("meta" as AdPlatform); // just to show loading
    try {
      const res = await fetch("/api/data/platform-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getRoleHeaders() },
        body: JSON.stringify({ clientId: client.id }),
      });
      const data = await res.json();
      if (data.success) {
        toast(`סנכרון הושלם: ${data.summary.successful} הצליחו, ${data.summary.skipped} דולגו`, 'success');
        // Reload statuses
        const statusRes = await fetch(`/api/data/platform-sync?clientId=${client.id}`, { headers: getRoleHeaders() });
        if (statusRes.ok) {
          const statusData = await statusRes.json();
          if (statusData.platforms) {
            setPlatformStatuses(statusData.platforms);
          }
        }
      } else {
        toast(data.error || "שגיאת סנכרון", 'error');
      }
    } catch {
      toast("שגיאת רשת בסנכרון", 'error');
    } finally {
      setSyncing(null);
    }
  }, [client.id, toast]);

  // Count connected ad platforms
  const connectedAdPlatforms = (["meta", "tiktok", "google"] as AdPlatform[]).filter(p =>
    platformStatuses[p]?.status === "connected"
  ).length;

  // Group non-ads integrations
  const grouped = CATEGORY_ORDER.map(cat => ({
    category: cat,
    label: CATEGORY_LABELS[cat],
    items: integrations.filter(i => i.category === cat),
  })).filter(g => g.items.length > 0);

  return (
    <div style={{ direction: "rtl" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
        <div>
          <h3 style={{ margin: "0 0 0.25rem 0", fontSize: "1.05rem", fontWeight: 700, color: "var(--foreground)" }}>
            חיבורים ואינטגרציות
          </h3>
          <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--foreground-muted)" }}>
            {connectedAdPlatforms} פלטפורמות פרסום מחוברות, {connectedCount} חיבורים נוספים
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          {connectedAdPlatforms > 0 && (
            <button
              type="button"
              onClick={handleSyncAll}
              disabled={syncing !== null}
              style={{
                padding: "0.35rem 0.75rem", fontSize: "0.75rem", fontWeight: 600, borderRadius: "0.375rem",
                border: "1px solid #22c55e", background: "rgba(34, 197, 94, 0.1)", color: "#22c55e",
                cursor: syncing ? "wait" : "pointer", opacity: syncing ? 0.5 : 1, fontFamily: "inherit",
              }}
            >
              {syncing ? "מסנכרן..." : "🔄 סנכרן הכל"}
            </button>
          )}
          <div style={{
            padding: "0.35rem 0.75rem", borderRadius: "999px", fontSize: "0.75rem", fontWeight: 600,
            background: connectedAdPlatforms > 0 ? "rgba(34, 197, 94, 0.1)" : "rgba(107, 114, 128, 0.1)",
            color: connectedAdPlatforms > 0 ? "#22c55e" : "#6b7280",
            border: `1px solid ${connectedAdPlatforms > 0 ? "rgba(34, 197, 94, 0.2)" : "rgba(107, 114, 128, 0.2)"}`,
          }}>
            {connectedAdPlatforms > 0 ? `${connectedAdPlatforms}/3 פלטפורמות` : "אין חיבורי פרסום"}
          </div>
        </div>
      </div>

      {/* ═══ AD PLATFORM PANELS ═══ */}
      {PLATFORM_CONFIGS.map(config => {
        const status = platformStatuses[config.key];
        const connectionStatus = (status?.status || "not_connected") as MetaConnectionStatus;
        const statusInfo = STATUS_LABELS[connectionStatus] || STATUS_LABELS.not_connected;
        const isExpanded = expandedPlatform === config.key;
        const form = platformForms[config.key] || {};
        const requiredFields = config.fields.filter(f => f.required);
        const hasRequiredFilled = requiredFields.every(f => !!form[f.key] && form[f.key] !== "••••••••");
        const tr = testResult[config.key];
        const sr = syncResults[config.key];

        return (
          <div key={config.key} style={{
            background: "var(--surface-raised)",
            border: `1px solid ${connectionStatus === "connected" ? "rgba(34, 197, 94, 0.25)" : "var(--border)"}`,
            borderRadius: "0.75rem", padding: "1.25rem", marginBottom: "0.75rem",
            borderRight: `4px solid ${connectionStatus === "connected" ? "#22c55e" : config.color}`,
          }}>
            <div
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
              onClick={() => setExpandedPlatform(isExpanded ? null : config.key)}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <span style={{ fontSize: "1.5rem" }}>{config.icon}</span>
                <div>
                  <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--foreground)" }}>
                    {config.name}
                    <span style={{ fontSize: "0.72rem", fontWeight: 400, color: "var(--foreground-muted)", marginRight: "0.5rem" }}>
                      {config.nameEn}
                    </span>
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--foreground-muted)", marginTop: "0.1rem" }}>
                    {config.description}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                {status?.lastSyncedAt && (
                  <span style={{ fontSize: "0.68rem", color: "var(--foreground-muted)" }}>
                    סנכרון אחרון: {new Date(status.lastSyncedAt).toLocaleString("he-IL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
                <span style={{
                  fontSize: "0.7rem", fontWeight: 700, padding: "0.2rem 0.6rem",
                  borderRadius: "999px", background: `${statusInfo.color}14`,
                  color: statusInfo.color, border: `1px solid ${statusInfo.color}30`,
                }}>
                  {statusInfo.label}
                </span>
                <span style={{ fontSize: "0.8rem", color: "var(--foreground-muted)", transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 150ms" }}>
                  ▼
                </span>
              </div>
            </div>

            {isExpanded && (
              <div style={{ marginTop: "1.25rem", borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
                {/* Connection form */}
                <div style={{ display: "grid", gridTemplateColumns: config.fields.length > 2 ? "1fr 1fr" : "1fr", gap: "0.75rem", marginBottom: "1rem" }}>
                  {config.fields.map(field => (
                    <div key={field.key} style={field.type === "password" ? { gridColumn: "1 / -1" } : undefined}>
                      <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-muted)", marginBottom: "0.25rem" }}>
                        {field.label}
                        {field.hint && (
                          <span style={{ fontWeight: 400, fontSize: "0.68rem", marginRight: "0.5rem" }}>({field.hint})</span>
                        )}
                      </label>
                      <input
                        type={field.type || "text"}
                        placeholder={field.placeholder}
                        value={form[field.key] || ""}
                        onChange={e => updateForm(config.key, field.key, e.target.value)}
                        onFocus={e => { if (field.type === "password" && e.target.value === "••••••••") updateForm(config.key, field.key, ""); }}
                        style={inputStyle}
                      />
                    </div>
                  ))}
                </div>

                {/* Test result */}
                {tr && (
                  <div style={{
                    padding: "0.6rem 0.85rem", borderRadius: "0.375rem", marginBottom: "0.75rem",
                    background: tr.valid ? "rgba(34, 197, 94, 0.08)" : "rgba(239, 68, 68, 0.08)",
                    border: `1px solid ${tr.valid ? "rgba(34, 197, 94, 0.2)" : "rgba(239, 68, 68, 0.2)"}`,
                    fontSize: "0.78rem", color: tr.valid ? "#22c55e" : "#ef4444",
                  }}>
                    {tr.valid
                      ? `✓ חיבור תקין — חשבון: ${tr.accountName}`
                      : `✗ ${tr.error}`}
                  </div>
                )}

                {/* Error message */}
                {status?.lastSyncError && connectionStatus !== "connected" && (
                  <div style={{
                    padding: "0.6rem 0.85rem", borderRadius: "0.375rem", marginBottom: "0.75rem",
                    background: "rgba(239, 68, 68, 0.06)", border: "1px solid rgba(239, 68, 68, 0.15)",
                    fontSize: "0.75rem", color: "#ef4444",
                  }}>
                    שגיאה אחרונה: {status.lastSyncError}
                  </div>
                )}

                {/* Sync result */}
                {sr && (
                  <div style={{
                    padding: "0.75rem 0.85rem", borderRadius: "0.375rem", marginBottom: "0.75rem",
                    background: "rgba(59, 130, 246, 0.06)", border: "1px solid rgba(59, 130, 246, 0.15)",
                    fontSize: "0.75rem", color: "var(--foreground)",
                  }}>
                    <div style={{ fontWeight: 700, marginBottom: "0.35rem" }}>תוצאות סנכרון:</div>
                    <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
                      <span>קמפיינים: <strong>{sr.campaigns?.synced || 0}</strong> ({sr.campaigns?.created || 0} חדשים, {sr.campaigns?.updated || 0} עודכנו)</span>
                      <span>קבוצות: <strong>{sr.adGroups?.synced || 0}</strong></span>
                      <span>מודעות: <strong>{sr.ads?.synced || 0}</strong></span>
                      <span>ביצועים: <strong>{sr.insightsUpdated || 0}</strong> שורות</span>
                    </div>
                    {sr.errors?.length > 0 && (
                      <div style={{ marginTop: "0.35rem", color: "#f59e0b", fontSize: "0.72rem" }}>
                        {sr.errors.length} שגיאות — {sr.errors[0]}
                      </div>
                    )}
                  </div>
                )}

                {/* OAuth Connect Button */}
                {(config.key === "meta" || config.key === "google") && (
                  <div style={{ marginBottom: "0.75rem" }}>
                    <button
                      type="button"
                      onClick={async () => {
                        const endpoint = config.key === "meta"
                          ? `/api/auth/meta/url?clientId=${client.id}`
                          : `/api/auth/google-ads/url?clientId=${client.id}`;
                        try {
                          const res = await fetch(endpoint, { headers: getRoleHeaders() });
                          const json = await res.json();
                          if (json.url) {
                            window.location.href = json.url;
                          } else {
                            toast(json.error || "שגיאה ביצירת קישור ההתחברות", 'error');
                          }
                        } catch {
                          toast("שגיאת רשת", 'error');
                        }
                      }}
                      style={{
                        padding: "0.5rem 1rem", fontSize: "0.8rem", fontWeight: 600, borderRadius: "0.375rem",
                        border: `1px solid ${config.color}`, background: `${config.color}15`, color: config.color,
                        cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: "0.4rem",
                      }}
                    >
                      🔗 התחבר דרך OAuth
                    </button>
                    <span style={{ fontSize: "0.7rem", color: "var(--foreground-muted)", marginRight: "0.75rem" }}>
                      (מומלץ — ללא צורך בהזנת טוקן ידנית)
                    </span>
                  </div>
                )}

                {/* Actions */}
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => handleTestConnection(config.key)}
                    disabled={testing !== null || !hasRequiredFilled}
                    style={{
                      padding: "0.5rem 1rem", fontSize: "0.8rem", fontWeight: 600, borderRadius: "0.375rem",
                      border: "1px solid var(--border)", background: "var(--surface)", color: "var(--foreground)",
                      cursor: testing ? "wait" : "pointer", opacity: testing || !hasRequiredFilled ? 0.5 : 1,
                      fontFamily: "inherit",
                    }}
                  >
                    {testing === config.key ? "בודק..." : "🔌 בדוק חיבור"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveConnection(config.key)}
                    disabled={saving !== null}
                    style={{
                      padding: "0.5rem 1rem", fontSize: "0.8rem", fontWeight: 600, borderRadius: "0.375rem",
                      border: `1px solid ${config.color}`, background: config.color, color: "#fff",
                      cursor: saving ? "wait" : "pointer", opacity: saving ? 0.5 : 1,
                      fontFamily: "inherit",
                    }}
                  >
                    {saving === config.key ? "שומר..." : "💾 שמור חיבור"}
                  </button>
                  {connectionStatus === "connected" && (
                    <button
                      type="button"
                      onClick={() => handleSyncNow(config.key)}
                      disabled={syncing !== null}
                      style={{
                        padding: "0.5rem 1rem", fontSize: "0.8rem", fontWeight: 600, borderRadius: "0.375rem",
                        border: "1px solid #22c55e", background: "rgba(34, 197, 94, 0.1)", color: "#22c55e",
                        cursor: syncing ? "wait" : "pointer", opacity: syncing ? 0.5 : 1,
                        fontFamily: "inherit",
                      }}
                    >
                      {syncing === config.key ? "מסנכרן..." : "🔄 סנכרן עכשיו"}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* ═══ WORDPRESS CONNECTION (for SEO/GEO) ═══ */}
      <div style={{
        background: "var(--surface-raised)",
        border: `1px solid ${wpConnected ? "rgba(34, 197, 94, 0.25)" : "var(--border)"}`,
        borderRadius: "0.75rem", padding: "1.25rem", marginBottom: "0.75rem",
        borderRight: "4px solid #21759b",
      }}>
        <div
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
          onClick={() => setWpExpanded(!wpExpanded)}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span style={{ fontSize: "1.5rem" }}>🌐</span>
            <div>
              <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--foreground)" }}>
                WordPress — פאנל ניהול
                <span style={{ fontSize: "0.72rem", fontWeight: 400, color: "var(--foreground-muted)", marginRight: "0.5rem" }}>
                  PIXEL SEO/GEO
                </span>
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--foreground-muted)", marginTop: "0.1rem" }}>
                חיבור לפאנל הניהול של האתר — נדרש לביצוע אוטומטי של משימות SEO (עדכון כותרות, מטא, סכמה ועוד)
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            {wpConnected && (
              <span style={{ fontSize: "0.68rem", color: "var(--foreground-muted)" }}>
                {c.wpSiteName || c.wp_site_name || ''}
              </span>
            )}
            <span style={{
              fontSize: "0.7rem", fontWeight: 700, padding: "0.2rem 0.6rem",
              borderRadius: "999px",
              background: wpConnected ? "rgba(34, 197, 94, 0.1)" : "rgba(107, 114, 128, 0.1)",
              color: wpConnected ? "#22c55e" : "#6b7280",
              border: `1px solid ${wpConnected ? "rgba(34, 197, 94, 0.2)" : "rgba(107, 114, 128, 0.2)"}`,
            }}>
              {wpConnected ? "מחובר" : "לא מחובר"}
            </span>
            <span style={{ fontSize: "0.8rem", color: "var(--foreground-muted)", transform: wpExpanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 150ms" }}>
              ▼
            </span>
          </div>
        </div>

        {wpExpanded && (
          <div style={{ marginTop: "1.25rem", borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1rem" }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-muted)", marginBottom: "0.25rem" }}>
                  כתובת האתר *
                  <span style={{ fontWeight: 400, fontSize: "0.68rem", marginRight: "0.5rem" }}>(כולל https://)</span>
                </label>
                <input
                  type="text"
                  placeholder="https://example.com"
                  value={wpForm.siteUrl}
                  onChange={e => setWpForm(prev => ({ ...prev, siteUrl: e.target.value }))}
                  style={{ ...inputStyle, direction: "ltr" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-muted)", marginBottom: "0.25rem" }}>
                  שם משתמש *
                </label>
                <input
                  type="text"
                  placeholder="admin"
                  value={wpForm.username}
                  onChange={e => setWpForm(prev => ({ ...prev, username: e.target.value }))}
                  style={{ ...inputStyle, direction: "ltr" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-muted)", marginBottom: "0.25rem" }}>
                  סיסמת יישום (Application Password) *
                  <span style={{ fontWeight: 400, fontSize: "0.68rem", marginRight: "0.5rem" }}>(לא סיסמת כניסה רגילה)</span>
                </label>
                <input
                  type="password"
                  placeholder="xxxx xxxx xxxx xxxx xxxx xxxx"
                  value={wpForm.applicationPassword}
                  onChange={e => setWpForm(prev => ({ ...prev, applicationPassword: e.target.value }))}
                  style={{ ...inputStyle, direction: "ltr" }}
                />
              </div>
            </div>

            {/* Help text */}
            <div style={{
              padding: "0.6rem 0.85rem", borderRadius: "0.375rem", marginBottom: "0.75rem",
              background: "rgba(33, 117, 155, 0.06)", border: "1px solid rgba(33, 117, 155, 0.15)",
              fontSize: "0.72rem", color: "var(--foreground-muted)", lineHeight: 1.6,
            }}>
              <strong>איך ליצור סיסמת יישום:</strong> נכנסים לפאנל WordPress ← משתמשים ← הפרופיל שלי ← גוללים למטה ל-&ldquo;Application Passwords&rdquo; ← יוצרים אחד חדש.
              הסיסמה הזו בטוחה יותר כי היא לא מאפשרת כניסה ישירה לפאנל.
            </div>

            {/* Test result */}
            {wpTestResult && (
              <div style={{
                padding: "0.6rem 0.85rem", borderRadius: "0.375rem", marginBottom: "0.75rem",
                background: wpTestResult.success ? "rgba(34, 197, 94, 0.08)" : "rgba(239, 68, 68, 0.08)",
                border: `1px solid ${wpTestResult.success ? "rgba(34, 197, 94, 0.2)" : "rgba(239, 68, 68, 0.2)"}`,
                fontSize: "0.78rem", color: wpTestResult.success ? "#22c55e" : "#ef4444",
              }}>
                {wpTestResult.success
                  ? `✓ חיבור תקין — אתר: ${wpTestResult.siteName}`
                  : `✗ ${wpTestResult.error}`}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={handleWpTest}
                disabled={wpTesting || !wpForm.siteUrl || !wpForm.username || !wpForm.applicationPassword}
                style={{
                  padding: "0.5rem 1rem", fontSize: "0.8rem", fontWeight: 600, borderRadius: "0.375rem",
                  border: "1px solid var(--border)", background: "var(--surface)", color: "var(--foreground)",
                  cursor: wpTesting ? "wait" : "pointer", opacity: wpTesting || !wpForm.siteUrl ? 0.5 : 1,
                  fontFamily: "inherit",
                }}
              >
                {wpTesting ? "בודק..." : "🔌 בדוק חיבור"}
              </button>
              <button
                type="button"
                onClick={handleWpSave}
                disabled={wpSaving || !wpForm.siteUrl}
                style={{
                  padding: "0.5rem 1rem", fontSize: "0.8rem", fontWeight: 600, borderRadius: "0.375rem",
                  border: "1px solid #21759b", background: "#21759b", color: "#fff",
                  cursor: wpSaving ? "wait" : "pointer", opacity: wpSaving ? 0.5 : 1,
                  fontFamily: "inherit",
                }}
              >
                {wpSaving ? "שומר..." : "💾 שמור בכרטיסיית לקוח"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ═══ OTHER INTEGRATIONS ═══ */}
      {grouped.map(group => (
        <div key={group.category} style={{ marginBottom: "1.5rem", marginTop: group.category === CATEGORY_ORDER[0] ? "1.5rem" : 0 }}>
          <h4 style={{
            margin: "0 0 0.75rem 0", fontSize: "0.85rem", fontWeight: 600,
            color: "var(--foreground-muted)", letterSpacing: "0.03em",
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
