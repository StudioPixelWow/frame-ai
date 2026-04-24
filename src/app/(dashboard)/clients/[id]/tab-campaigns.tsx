"use client";

import { useState, useMemo } from "react";
import { useCampaigns, useAdSets, useAds, useLeads } from "@/lib/api/use-entity";
import { useToast } from "@/components/ui/toast";
import type { Client, Campaign, AdSet, Ad, Lead, CampaignStatus } from "@/lib/db/schema";

// ── Constants ──

const STATUS_COLORS: Record<CampaignStatus, { bg: string; text: string; label: string }> = {
  draft: { bg: "rgba(107,114,128,0.12)", text: "#6b7280", label: "טיוטה" },
  in_progress: { bg: "rgba(59,130,246,0.12)", text: "#3b82f6", label: "בעבודה" },
  waiting_approval: { bg: "rgba(245,158,11,0.12)", text: "#f59e0b", label: "ממתין לאישור" },
  approved: { bg: "rgba(34,197,94,0.12)", text: "#22c55e", label: "מאושר" },
  scheduled: { bg: "rgba(99,102,241,0.12)", text: "#6366f1", label: "מתוזמן" },
  active: { bg: "rgba(0,181,254,0.12)", text: "#00B5FE", label: "פעיל" },
  completed: { bg: "rgba(156,163,175,0.12)", text: "#9ca3af", label: "הושלם" },
};

const OBJECTIVE_LABELS: Record<string, string> = {
  paid_social: "פרסום ממומן",
  organic_social: "אורגני",
  lead_gen: "לידים",
  awareness: "מודעות",
  remarketing: "רימרקטינג",
  podcast_promo: "קידום פודקאסט",
  custom: "מותאם אישית",
};

const PLATFORM_LABELS: Record<string, { label: string; color: string }> = {
  facebook: { label: "Facebook", color: "#1877F2" },
  instagram: { label: "Instagram", color: "#E4405F" },
  tiktok: { label: "TikTok", color: "#000000" },
  multi_platform: { label: "מולטי פלטפורמה", color: "#6366f1" },
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const months = ["ינו", "פבר", "מרץ", "אפר", "מאי", "יונ", "יול", "אוג", "ספט", "אוק", "נוב", "דצמ"];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function formatCurrency(n: number): string {
  if (!n) return "₪0";
  return "₪" + n.toLocaleString("he-IL", { maximumFractionDigits: 0 });
}

// ── Component ──

type DrillView = "list" | "campaign" | "adset";

export default function TabCampaigns({ client }: { client: Client }) {
  const { data: allCampaigns, loading: campaignsLoading, update: updateCampaign } = useCampaigns();
  const { data: allAdSets } = useAdSets();
  const { data: allAds } = useAds();
  const { data: allLeads } = useLeads();
  const toast = useToast();

  // Drill-down state
  const [view, setView] = useState<DrillView>("list");
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [selectedAdSetId, setSelectedAdSetId] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [objectiveFilter, setObjectiveFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Client-scoped data
  const campaigns = useMemo(() => {
    return (allCampaigns || []).filter((c) => c.clientId === client.id);
  }, [allCampaigns, client.id]);

  const adSets = useMemo(() => {
    const cmpIds = new Set(campaigns.map((c) => c.id));
    return (allAdSets || []).filter((as) => cmpIds.has(as.campaignId));
  }, [allAdSets, campaigns]);

  const ads = useMemo(() => {
    const asIds = new Set(adSets.map((as) => as.id));
    return (allAds || []).filter((a) => asIds.has(a.adSetId));
  }, [allAds, adSets]);

  const leads = useMemo(() => {
    const cmpIds = new Set(campaigns.map((c) => c.id));
    return (allLeads || []).filter((l) => l.campaignId && cmpIds.has(l.campaignId));
  }, [allLeads, campaigns]);

  // Filtered campaigns
  const filteredCampaigns = useMemo(() => {
    let list = campaigns;
    if (statusFilter !== "all") list = list.filter((c) => c.status === statusFilter);
    if (objectiveFilter !== "all") list = list.filter((c) => c.campaignType === objectiveFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((c) => c.campaignName.toLowerCase().includes(q));
    }
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [campaigns, statusFilter, objectiveFilter, searchQuery]);

  // Performance helpers
  function getCampaignLeads(campaignId: string): Lead[] {
    return leads.filter((l) => l.campaignId === campaignId);
  }

  function getCampaignAdSets(campaignId: string): AdSet[] {
    return adSets.filter((as) => as.campaignId === campaignId);
  }

  function getCampaignAds(campaignId: string): Ad[] {
    const asIds = new Set(getCampaignAdSets(campaignId).map((as) => as.id));
    return ads.filter((a) => asIds.has(a.adSetId));
  }

  function getAdSetAds(adSetId: string): Ad[] {
    return ads.filter((a) => a.adSetId === adSetId);
  }

  function getCampaignMetrics(campaignId: string) {
    const cmpAds = getCampaignAds(campaignId);
    const cmpLeads = getCampaignLeads(campaignId);
    const spend = cmpAds.reduce((s, a) => s + (a.spend || 0), 0);
    const impressions = cmpAds.reduce((s, a) => s + (a.impressions || 0), 0);
    const clicks = cmpAds.reduce((s, a) => s + (a.clicks || 0), 0);
    const leadsCount = cmpLeads.length || cmpAds.reduce((s, a) => s + (a.leads || 0), 0);
    const cpl = leadsCount > 0 ? spend / leadsCount : 0;
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
    return { spend, impressions, clicks, leadsCount, cpl, ctr, adsCount: cmpAds.length, adSetsCount: getCampaignAdSets(campaignId).length };
  }

  function getAdSetMetrics(adSetId: string) {
    const asAds = getAdSetAds(adSetId);
    const spend = asAds.reduce((s, a) => s + (a.spend || 0), 0);
    const impressions = asAds.reduce((s, a) => s + (a.impressions || 0), 0);
    const clicks = asAds.reduce((s, a) => s + (a.clicks || 0), 0);
    const leadsCount = asAds.reduce((s, a) => s + (a.leads || 0), 0);
    const cpl = leadsCount > 0 ? spend / leadsCount : 0;
    return { spend, impressions, clicks, leadsCount, cpl, adsCount: asAds.length };
  }

  // Quick actions
  async function toggleCampaignStatus(campaign: Campaign) {
    const newStatus: CampaignStatus = campaign.status === "active" ? "draft" : "active";
    try {
      await updateCampaign(campaign.id, { status: newStatus });
      toast.success(newStatus === "active" ? "הקמפיין הופעל" : "הקמפיין הושהה");
    } catch {
      toast.error("שגיאה בעדכון סטטוס");
    }
  }

  async function duplicateCampaign(campaign: Campaign) {
    toast.info("שכפול קמפיין — בקרוב...");
  }

  // ── Breadcrumb ──
  const selectedCampaign = campaigns.find((c) => c.id === selectedCampaignId) || null;
  const selectedAdSet = adSets.find((as) => as.id === selectedAdSetId) || null;

  function renderBreadcrumb() {
    if (view === "list") return null;
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem", fontSize: "0.85rem", color: "var(--foreground-muted)", direction: "rtl" }}>
        <span style={{ cursor: "pointer", color: "var(--accent)" }} onClick={() => { setView("list"); setSelectedCampaignId(null); setSelectedAdSetId(null); }}>
          כל הקמפיינים
        </span>
        {selectedCampaign && (
          <>
            <span style={{ color: "var(--foreground-muted)" }}>←</span>
            <span
              style={{ cursor: view === "adset" ? "pointer" : "default", color: view === "adset" ? "var(--accent)" : "var(--foreground)" }}
              onClick={() => { if (view === "adset") { setView("campaign"); setSelectedAdSetId(null); } }}
            >
              {selectedCampaign.campaignName}
            </span>
          </>
        )}
        {selectedAdSet && (
          <>
            <span style={{ color: "var(--foreground-muted)" }}>←</span>
            <span style={{ color: "var(--foreground)" }}>{selectedAdSet.name}</span>
          </>
        )}
      </div>
    );
  }

  // ── Performance Summary Bar ──
  function renderPerformanceSummary() {
    const totalSpend = ads.reduce((s, a) => s + (a.spend || 0), 0);
    const totalLeads = leads.length || ads.reduce((s, a) => s + (a.leads || 0), 0);
    const totalImpressions = ads.reduce((s, a) => s + (a.impressions || 0), 0);
    const totalClicks = ads.reduce((s, a) => s + (a.clicks || 0), 0);
    const avgCpl = totalLeads > 0 ? totalSpend / totalLeads : 0;
    const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

    const metrics = [
      { label: "קמפיינים", value: campaigns.length.toString() },
      { label: "לידים", value: totalLeads.toString() },
      { label: "הוצאה כוללת", value: formatCurrency(totalSpend) },
      { label: "עלות לליד", value: avgCpl > 0 ? formatCurrency(avgCpl) : "—" },
      { label: "CTR", value: avgCtr > 0 ? avgCtr.toFixed(1) + "%" : "—" },
    ];

    return (
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${metrics.length}, 1fr)`, gap: "0.75rem", marginBottom: "1.25rem" }}>
        {metrics.map((m) => (
          <div key={m.label} style={{ background: "var(--surface-raised)", border: "1px solid var(--border)", borderRadius: "0.625rem", padding: "0.75rem 1rem", textAlign: "center" }}>
            <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--foreground)" }}>{m.value}</div>
            <div style={{ fontSize: "0.75rem", color: "var(--foreground-muted)", marginTop: "0.125rem" }}>{m.label}</div>
          </div>
        ))}
      </div>
    );
  }

  // ── Filter Bar ──
  function renderFilters() {
    const selectStyle: React.CSSProperties = {
      background: "var(--surface-raised)", border: "1px solid var(--border)", borderRadius: "0.5rem",
      padding: "0.4rem 0.6rem", fontSize: "0.8rem", color: "var(--foreground)", direction: "rtl", outline: "none",
    };
    return (
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "1rem", direction: "rtl", flexWrap: "wrap" }}>
        <input
          type="text"
          placeholder="חיפוש קמפיין..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ ...selectStyle, flex: "1 1 180px", minWidth: 120 }}
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={selectStyle}>
          <option value="all">כל הסטטוסים</option>
          {Object.entries(STATUS_COLORS).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <select value={objectiveFilter} onChange={(e) => setObjectiveFilter(e.target.value)} style={selectStyle}>
          <option value="all">כל הסוגים</option>
          {Object.entries(OBJECTIVE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>
    );
  }

  // ── Campaign List View ──
  function renderCampaignList() {
    if (campaignsLoading) {
      return <div style={{ textAlign: "center", padding: "2rem", color: "var(--foreground-muted)" }}>טוען קמפיינים...</div>;
    }
    if (filteredCampaigns.length === 0) {
      return (
        <div style={{ background: "var(--surface-raised)", border: "1px solid var(--border)", borderRadius: "0.75rem", padding: "2.5rem", textAlign: "center" }}>
          <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📢</div>
          <div style={{ fontWeight: 600, color: "var(--foreground)", marginBottom: "0.25rem" }}>
            {campaigns.length === 0 ? "אין קמפיינים עדיין" : "אין תוצאות"}
          </div>
          <div style={{ fontSize: "0.85rem", color: "var(--foreground-muted)" }}>
            {campaigns.length === 0 ? "צרו את הקמפיין הראשון מבונה הקמפיינים" : "נסו לשנות את הפילטרים"}
          </div>
        </div>
      );
    }
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
        {filteredCampaigns.map((campaign) => {
          const metrics = getCampaignMetrics(campaign.id);
          const statusInfo = STATUS_COLORS[campaign.status] || STATUS_COLORS.draft;
          const platformInfo = PLATFORM_LABELS[campaign.platform] || { label: campaign.platform, color: "#6b7280" };
          return (
            <div
              key={campaign.id}
              onClick={() => { setSelectedCampaignId(campaign.id); setView("campaign"); }}
              style={{
                background: "var(--surface-raised)", border: "1px solid var(--border)", borderRadius: "0.75rem",
                padding: "1rem 1.25rem", cursor: "pointer", transition: "border-color 0.15s, box-shadow 0.15s", direction: "rtl",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,181,254,0.08)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = "none"; }}
            >
              {/* Top row: name + status */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
                  <span style={{ fontWeight: 600, fontSize: "0.95rem", color: "var(--foreground)" }}>{campaign.campaignName}</span>
                  <span style={{ fontSize: "0.7rem", padding: "0.15rem 0.5rem", borderRadius: "999px", background: statusInfo.bg, color: statusInfo.text, fontWeight: 500 }}>
                    {statusInfo.label}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{ fontSize: "0.75rem", padding: "0.125rem 0.4rem", borderRadius: "0.25rem", background: platformInfo.color + "18", color: platformInfo.color, fontWeight: 500 }}>
                    {platformInfo.label}
                  </span>
                  <span style={{ fontSize: "0.75rem", color: "var(--foreground-muted)" }}>
                    {OBJECTIVE_LABELS[campaign.campaignType] || campaign.campaignType}
                  </span>
                </div>
              </div>

              {/* Metrics row */}
              <div style={{ display: "flex", gap: "1.5rem", fontSize: "0.8rem", color: "var(--foreground-muted)" }}>
                <span>קבוצות מודעות: <strong style={{ color: "var(--foreground)" }}>{metrics.adSetsCount}</strong></span>
                <span>מודעות: <strong style={{ color: "var(--foreground)" }}>{metrics.adsCount}</strong></span>
                <span>לידים: <strong style={{ color: "var(--foreground)" }}>{metrics.leadsCount}</strong></span>
                <span>הוצאה: <strong style={{ color: "var(--foreground)" }}>{formatCurrency(metrics.spend)}</strong></span>
                {metrics.cpl > 0 && <span>CPL: <strong style={{ color: "var(--foreground)" }}>{formatCurrency(metrics.cpl)}</strong></span>}
                {metrics.ctr > 0 && <span>CTR: <strong style={{ color: "var(--foreground)" }}>{metrics.ctr.toFixed(1)}%</strong></span>}
              </div>

              {/* Bottom row: dates + quick actions */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.5rem" }}>
                <span style={{ fontSize: "0.75rem", color: "var(--foreground-muted)" }}>
                  {formatDate(campaign.startDate)} {campaign.endDate ? ` — ${formatDate(campaign.endDate)}` : ""}
                </span>
                <div style={{ display: "flex", gap: "0.375rem" }} onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => toggleCampaignStatus(campaign)}
                    title={campaign.status === "active" ? "השהה" : "הפעל"}
                    style={{ background: "none", border: "1px solid var(--border)", borderRadius: "0.375rem", padding: "0.2rem 0.5rem", fontSize: "0.75rem", cursor: "pointer", color: "var(--foreground-muted)" }}
                  >
                    {campaign.status === "active" ? "⏸ השהה" : "▶ הפעל"}
                  </button>
                  <button
                    onClick={() => duplicateCampaign(campaign)}
                    title="שכפל"
                    style={{ background: "none", border: "1px solid var(--border)", borderRadius: "0.375rem", padding: "0.2rem 0.5rem", fontSize: "0.75rem", cursor: "pointer", color: "var(--foreground-muted)" }}
                  >
                    📋 שכפל
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // ── Campaign Drill-Down View ──
  function renderCampaignDetail() {
    if (!selectedCampaign) return null;
    const metrics = getCampaignMetrics(selectedCampaign.id);
    const cmpAdSets = getCampaignAdSets(selectedCampaign.id);
    const cmpLeads = getCampaignLeads(selectedCampaign.id);
    const statusInfo = STATUS_COLORS[selectedCampaign.status] || STATUS_COLORS.draft;

    return (
      <div style={{ direction: "rtl" }}>
        {/* Campaign header */}
        <div style={{ background: "var(--surface-raised)", border: "1px solid var(--border)", borderRadius: "0.75rem", padding: "1.25rem", marginBottom: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "var(--foreground)" }}>{selectedCampaign.campaignName}</h3>
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.375rem", alignItems: "center" }}>
                <span style={{ fontSize: "0.7rem", padding: "0.15rem 0.5rem", borderRadius: "999px", background: statusInfo.bg, color: statusInfo.text, fontWeight: 500 }}>
                  {statusInfo.label}
                </span>
                <span style={{ fontSize: "0.8rem", color: "var(--foreground-muted)" }}>
                  {OBJECTIVE_LABELS[selectedCampaign.campaignType] || selectedCampaign.campaignType}
                </span>
                <span style={{ fontSize: "0.8rem", color: "var(--foreground-muted)" }}>
                  • {PLATFORM_LABELS[selectedCampaign.platform]?.label || selectedCampaign.platform}
                </span>
              </div>
            </div>
            <div style={{ display: "flex", gap: "0.375rem" }}>
              <button
                onClick={() => toggleCampaignStatus(selectedCampaign)}
                style={{ background: "none", border: "1px solid var(--border)", borderRadius: "0.375rem", padding: "0.3rem 0.75rem", fontSize: "0.8rem", cursor: "pointer", color: "var(--foreground)" }}
              >
                {selectedCampaign.status === "active" ? "⏸ השהה" : "▶ הפעל"}
              </button>
            </div>
          </div>

          {/* Campaign-level metrics */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "0.5rem" }}>
            {[
              { label: "קבוצות מודעות", value: metrics.adSetsCount.toString() },
              { label: "מודעות", value: metrics.adsCount.toString() },
              { label: "לידים", value: metrics.leadsCount.toString() },
              { label: "הוצאה", value: formatCurrency(metrics.spend) },
              { label: "CPL", value: metrics.cpl > 0 ? formatCurrency(metrics.cpl) : "—" },
            ].map((m) => (
              <div key={m.label} style={{ background: "var(--surface)", borderRadius: "0.5rem", padding: "0.5rem", textAlign: "center" }}>
                <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--foreground)" }}>{m.value}</div>
                <div style={{ fontSize: "0.7rem", color: "var(--foreground-muted)" }}>{m.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Ad Sets list */}
        <h4 style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--foreground)", marginBottom: "0.625rem" }}>
          קבוצות מודעות ({cmpAdSets.length})
        </h4>
        {cmpAdSets.length === 0 ? (
          <div style={{ background: "var(--surface-raised)", border: "1px solid var(--border)", borderRadius: "0.625rem", padding: "1.5rem", textAlign: "center", color: "var(--foreground-muted)", fontSize: "0.85rem" }}>
            אין קבוצות מודעות עדיין
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1.25rem" }}>
            {cmpAdSets.map((adSet) => {
              const asMetrics = getAdSetMetrics(adSet.id);
              const asStatusColor = adSet.status === "active" ? "#22c55e" : adSet.status === "paused" ? "#f59e0b" : "#6b7280";
              return (
                <div
                  key={adSet.id}
                  onClick={() => { setSelectedAdSetId(adSet.id); setView("adset"); }}
                  style={{
                    background: "var(--surface-raised)", border: "1px solid var(--border)", borderRadius: "0.625rem",
                    padding: "0.875rem 1rem", cursor: "pointer", transition: "border-color 0.15s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.375rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--foreground)" }}>{adSet.name}</span>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: asStatusColor, display: "inline-block" }} />
                    </div>
                    <span style={{ fontSize: "0.75rem", color: "var(--foreground-muted)" }}>
                      {asMetrics.adsCount} מודעות
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: "1.25rem", fontSize: "0.78rem", color: "var(--foreground-muted)" }}>
                    <span>לידים: <strong style={{ color: "var(--foreground)" }}>{asMetrics.leadsCount}</strong></span>
                    <span>הוצאה: <strong style={{ color: "var(--foreground)" }}>{formatCurrency(asMetrics.spend)}</strong></span>
                    {asMetrics.cpl > 0 && <span>CPL: <strong style={{ color: "var(--foreground)" }}>{formatCurrency(asMetrics.cpl)}</strong></span>}
                    {adSet.geoLocations?.length > 0 && <span>מיקום: {adSet.geoLocations.slice(0, 2).join(", ")}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Recent leads for this campaign */}
        {cmpLeads.length > 0 && (
          <>
            <h4 style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--foreground)", marginBottom: "0.625rem" }}>
              לידים אחרונים ({cmpLeads.length})
            </h4>
            <div style={{ background: "var(--surface-raised)", border: "1px solid var(--border)", borderRadius: "0.625rem", overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                <thead>
                  <tr style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
                    <th style={{ padding: "0.5rem 0.75rem", textAlign: "right", fontWeight: 600, color: "var(--foreground-muted)" }}>שם</th>
                    <th style={{ padding: "0.5rem 0.75rem", textAlign: "right", fontWeight: 600, color: "var(--foreground-muted)" }}>טלפון</th>
                    <th style={{ padding: "0.5rem 0.75rem", textAlign: "right", fontWeight: 600, color: "var(--foreground-muted)" }}>סטטוס</th>
                    <th style={{ padding: "0.5rem 0.75rem", textAlign: "right", fontWeight: 600, color: "var(--foreground-muted)" }}>תאריך</th>
                  </tr>
                </thead>
                <tbody>
                  {cmpLeads.slice(0, 8).map((lead) => (
                    <tr key={lead.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "0.5rem 0.75rem", color: "var(--foreground)" }}>{lead.fullName}</td>
                      <td style={{ padding: "0.5rem 0.75rem", color: "var(--foreground-muted)" }}>{lead.phone || "—"}</td>
                      <td style={{ padding: "0.5rem 0.75rem" }}>
                        <span style={{ fontSize: "0.7rem", padding: "0.1rem 0.4rem", borderRadius: "999px", background: "var(--surface)", color: "var(--foreground-muted)" }}>
                          {lead.status}
                        </span>
                      </td>
                      <td style={{ padding: "0.5rem 0.75rem", color: "var(--foreground-muted)", fontSize: "0.75rem" }}>{formatDate(lead.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    );
  }

  // ── Ad Set Drill-Down View ──
  function renderAdSetDetail() {
    if (!selectedAdSet || !selectedCampaign) return null;
    const asAds = getAdSetAds(selectedAdSet.id);
    const asMetrics = getAdSetMetrics(selectedAdSet.id);

    return (
      <div style={{ direction: "rtl" }}>
        {/* Ad Set header */}
        <div style={{ background: "var(--surface-raised)", border: "1px solid var(--border)", borderRadius: "0.75rem", padding: "1.25rem", marginBottom: "1rem" }}>
          <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "var(--foreground)", marginBottom: "0.5rem" }}>{selectedAdSet.name}</h3>
          <div style={{ display: "flex", gap: "0.75rem", fontSize: "0.8rem", color: "var(--foreground-muted)", marginBottom: "0.75rem", flexWrap: "wrap" }}>
            {selectedAdSet.geoLocations?.length > 0 && <span>מיקום: {selectedAdSet.geoLocations.join(", ")}</span>}
            {selectedAdSet.ageMin && <span>גילאים: {selectedAdSet.ageMin}–{selectedAdSet.ageMax || "65+"}</span>}
            {selectedAdSet.interests?.length > 0 && <span>תחומי עניין: {selectedAdSet.interests.slice(0, 3).join(", ")}</span>}
            {selectedAdSet.dailyBudget && <span>תקציב יומי: {formatCurrency(selectedAdSet.dailyBudget)}</span>}
            {selectedAdSet.lifetimeBudget && <span>תקציב כולל: {formatCurrency(selectedAdSet.lifetimeBudget)}</span>}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.5rem" }}>
            {[
              { label: "מודעות", value: asMetrics.adsCount.toString() },
              { label: "לידים", value: asMetrics.leadsCount.toString() },
              { label: "הוצאה", value: formatCurrency(asMetrics.spend) },
              { label: "CPL", value: asMetrics.cpl > 0 ? formatCurrency(asMetrics.cpl) : "—" },
            ].map((m) => (
              <div key={m.label} style={{ background: "var(--surface)", borderRadius: "0.5rem", padding: "0.5rem", textAlign: "center" }}>
                <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--foreground)" }}>{m.value}</div>
                <div style={{ fontSize: "0.7rem", color: "var(--foreground-muted)" }}>{m.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Ads list */}
        <h4 style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--foreground)", marginBottom: "0.625rem" }}>
          מודעות ({asAds.length})
        </h4>
        {asAds.length === 0 ? (
          <div style={{ background: "var(--surface-raised)", border: "1px solid var(--border)", borderRadius: "0.625rem", padding: "1.5rem", textAlign: "center", color: "var(--foreground-muted)", fontSize: "0.85rem" }}>
            אין מודעות עדיין
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "0.75rem" }}>
            {asAds.map((ad) => {
              const adStatusColor = ad.status === "active" ? "#22c55e" : ad.status === "paused" ? "#f59e0b" : "#6b7280";
              return (
                <div key={ad.id} style={{ background: "var(--surface-raised)", border: "1px solid var(--border)", borderRadius: "0.625rem", overflow: "hidden" }}>
                  {/* Ad thumbnail/media preview */}
                  {ad.mediaUrl && (
                    <div style={{ width: "100%", height: 140, background: "var(--surface)", overflow: "hidden" }}>
                      {ad.creativeType === "video" ? (
                        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#111", color: "#fff", fontSize: "2rem" }}>
                          ▶
                        </div>
                      ) : (
                        <img src={ad.mediaUrl} alt={ad.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      )}
                    </div>
                  )}
                  <div style={{ padding: "0.75rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.375rem" }}>
                      <span style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--foreground)" }}>{ad.name}</span>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: adStatusColor, display: "inline-block" }} />
                    </div>
                    {ad.primaryText && (
                      <div style={{ fontSize: "0.78rem", color: "var(--foreground-muted)", marginBottom: "0.375rem", lineHeight: 1.4, maxHeight: "2.8em", overflow: "hidden" }}>
                        {ad.primaryText}
                      </div>
                    )}
                    {ad.headline && (
                      <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--foreground)", marginBottom: "0.375rem" }}>
                        {ad.headline}
                      </div>
                    )}
                    <div style={{ display: "flex", gap: "1rem", fontSize: "0.72rem", color: "var(--foreground-muted)", flexWrap: "wrap" }}>
                      {ad.impressions > 0 && <span>חשיפות: {ad.impressions.toLocaleString()}</span>}
                      {ad.clicks > 0 && <span>קליקים: {ad.clicks.toLocaleString()}</span>}
                      {ad.spend > 0 && <span>הוצאה: {formatCurrency(ad.spend)}</span>}
                      {ad.leads > 0 && <span>לידים: {ad.leads}</span>}
                      {ad.ctr > 0 && <span>CTR: {(ad.ctr * 100).toFixed(1)}%</span>}
                    </div>
                    {ad.ctaType && (
                      <div style={{ marginTop: "0.375rem", fontSize: "0.72rem", color: "var(--accent)" }}>
                        CTA: {ad.ctaType.replace(/_/g, " ")}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── Main Render ──
  return (
    <div>
      {renderBreadcrumb()}
      {view === "list" && (
        <>
          {renderPerformanceSummary()}
          {renderFilters()}
          {renderCampaignList()}
        </>
      )}
      {view === "campaign" && renderCampaignDetail()}
      {view === "adset" && renderAdSetDetail()}
    </div>
  );
}
