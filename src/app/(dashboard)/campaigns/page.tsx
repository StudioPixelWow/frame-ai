'use client';

import { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useCampaigns, useClients, useLeads } from '@/lib/api/use-entity';
import { useToast } from '@/components/ui/toast';
import { Modal } from '@/components/ui/modal';
import { SkeletonKPIRow, SkeletonGrid } from '@/components/ui/skeleton';
import type { Campaign, CampaignType, CampaignStatus, CampaignPlatform, CampaignMediaType, Lead } from '@/lib/db/schema';
import { buildCampaignLeadInsights } from '@/lib/leads/lead-quality';
import {
  computeHealth,
  generateCampaignAlerts,
  generateAllAlerts,
  summarizeAlerts,
  generateHighlights,
  ALERT_TYPE_LABELS,
  ALERT_TYPE_ICONS,
  SEVERITY_COLORS,
  SEVERITY_LABELS,
  type HealthLevel,
  type CampaignAlert,
  type AlertSeverity,
} from '@/lib/campaigns/health-engine';

// ── Constants ────────────────────────────────────────────────────────────────

const STATUS_OPTIONS: Array<{ value: CampaignStatus; label: string }> = [
  { value: 'draft', label: 'טיוטה' },
  { value: 'in_progress', label: 'בתהליך' },
  { value: 'waiting_approval', label: 'ממתין לאישור' },
  { value: 'approved', label: 'מאושר' },
  { value: 'scheduled', label: 'מתוזמן' },
  { value: 'active', label: 'פעיל' },
  { value: 'completed', label: 'הושלם' },
];

const TYPE_OPTIONS: Array<{ value: CampaignType; label: string }> = [
  { value: 'paid_social', label: 'ממומן' },
  { value: 'organic_social', label: 'אורגני' },
  { value: 'lead_gen', label: 'לידים' },
  { value: 'awareness', label: 'מודעות' },
  { value: 'remarketing', label: 'רימרקטינג' },
  { value: 'podcast_promo', label: 'קידום פודקאסט' },
  { value: 'custom', label: 'מותאם' },
];

const PLATFORM_OPTIONS: Array<{ value: CampaignPlatform; label: string }> = [
  { value: 'facebook', label: 'Facebook' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'multi_platform', label: 'מולטי-פלטפורמה' },
];

const MEDIA_TYPE_OPTIONS: Array<{ value: CampaignMediaType; label: string }> = [
  { value: 'image', label: 'תמונה' },
  { value: 'video', label: 'וידאו' },
];

const STATUS_COLORS: Record<CampaignStatus, string> = {
  draft: '#6b7280',
  in_progress: '#3b82f6',
  waiting_approval: '#f59e0b',
  approved: '#10b981',
  scheduled: '#8b5cf6',
  active: '#22c55e',
  completed: '#00B5FE',
};

const STATUS_LABELS: Record<CampaignStatus, string> = {
  draft: 'טיוטה',
  in_progress: 'בתהליך',
  waiting_approval: 'ממתין לאישור',
  approved: 'מאושר',
  scheduled: 'מתוזמן',
  active: 'פעיל',
  completed: 'הושלם',
};

const TYPE_LABELS: Record<CampaignType, string> = {
  paid_social: 'ממומן',
  organic_social: 'אורגני',
  lead_gen: 'לידים',
  awareness: 'מודעות',
  remarketing: 'רימרקטינג',
  podcast_promo: 'קידום פודקאסט',
  custom: 'מותאם',
};

const PLATFORM_LABELS: Record<CampaignPlatform, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  multi_platform: 'מולטי-פלטפורמה',
};

const PLATFORM_ICONS: Record<CampaignPlatform, string> = {
  facebook: '📘',
  instagram: '📸',
  tiktok: '🎵',
  multi_platform: '🌐',
};

const MEDIA_TYPE_LABELS: Record<CampaignMediaType, string> = {
  image: 'תמונה',
  video: 'וידאו',
};

// ── Health badge (uses engine) ───────────────────────────────────────────────

function HealthBadge({ campaign, size = 'normal' }: { campaign: Campaign; size?: 'normal' | 'compact' }) {
  const { score, label, color, breakdown } = computeHealth(campaign);
  const isCompact = size === 'compact';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: isCompact ? '0.35rem' : '0.5rem' }} title={`מבנה: ${breakdown.structure}/25 | קריאייטיב: ${breakdown.creative}/25 | טרגוט: ${breakdown.targeting}/20 | פעילות: ${breakdown.activity}/30`}>
      <div style={{ position: 'relative', width: isCompact ? 28 : 36, height: isCompact ? 28 : 36 }}>
        <svg viewBox="0 0 36 36" width={isCompact ? 28 : 36} height={isCompact ? 28 : 36}>
          <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--border)" strokeWidth="3" />
          <circle
            cx="18" cy="18" r="15.5" fill="none" stroke={color} strokeWidth="3"
            strokeDasharray={`${score * 0.974} ${97.4 - score * 0.974}`}
            strokeDashoffset="24.35" strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 400ms' }}
          />
        </svg>
        <span style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: isCompact ? '0.55rem' : '0.65rem', fontWeight: 800, color,
        }}>{score}</span>
      </div>
      {!isCompact && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.68rem', fontWeight: 600, color }}>{label}</span>
          <div style={{ display: 'flex', gap: '2px', marginTop: '2px' }}>
            {[
              { v: breakdown.structure, max: 25, c: '#3b82f6' },
              { v: breakdown.creative, max: 25, c: '#8b5cf6' },
              { v: breakdown.targeting, max: 20, c: '#f59e0b' },
              { v: breakdown.activity, max: 30, c: '#22c55e' },
            ].map((seg, i) => (
              <div key={i} style={{ width: '18px', height: '3px', borderRadius: '1.5px', background: 'var(--border)', overflow: 'hidden' }}>
                <div style={{ width: `${(seg.v / seg.max) * 100}%`, height: '100%', background: seg.c, borderRadius: '1.5px' }} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Readiness indicators ────────────────────────────────────���────────────────

function ReadinessIndicators({ campaign }: { campaign: Campaign }) {
  const hasCreative = !!(campaign.linkedClientFileId || (campaign.externalMediaUrl && campaign.externalMediaUrl.length > 5));
  const hasCopy = !!(campaign.caption && campaign.caption.trim().length > 5);
  const hasBudget = !!(campaign.budget && campaign.budget > 0);
  const hasDates = !!campaign.startDate;

  const items: Array<{ ok: boolean; label: string }> = [
    { ok: hasCreative, label: 'קריאייטיב' },
    { ok: hasCopy, label: 'קופי' },
    { ok: hasBudget, label: 'תקציב' },
    { ok: hasDates, label: 'תאריכים' },
  ];

  return (
    <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
      {items.map((it) => (
        <span
          key={it.label}
          style={{
            fontSize: '0.62rem',
            fontWeight: 600,
            padding: '0.15rem 0.4rem',
            borderRadius: '0.25rem',
            background: it.ok ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.08)',
            color: it.ok ? '#22c55e' : '#ef4444',
            border: `1px solid ${it.ok ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.15)'}`,
          }}
        >
          {it.ok ? '✓' : '✗'} {it.label}
        </span>
      ))}
    </div>
  );
}

// ── Alert badge for campaign cards ──────────────────────────────────────────

function CampaignAlertBadge({ alerts, expanded, onToggle }: { alerts: CampaignAlert[]; expanded: boolean; onToggle: () => void }) {
  if (alerts.length === 0) return null;
  const highCount = alerts.filter((a) => a.severity === 'high').length;
  const badgeColor = highCount > 0 ? '#ef4444' : '#f59e0b';

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.25rem',
          padding: '0.2rem 0.5rem',
          borderRadius: '0.3rem',
          border: `1px solid ${badgeColor}33`,
          background: `${badgeColor}0D`,
          color: badgeColor,
          fontSize: '0.65rem',
          fontWeight: 700,
          cursor: 'pointer',
          transition: 'all 150ms',
        }}
      >
        {highCount > 0 ? '🔴' : '🟡'} {alerts.length} התראות
      </button>
      {expanded && (
        <div style={{
          marginTop: '0.4rem',
          padding: '0.5rem 0.65rem',
          background: 'var(--surface-raised)',
          border: '1px solid var(--border)',
          borderRadius: '0.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.35rem',
        }}>
          {alerts.slice(0, 5).map((a) => (
            <div key={a.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.35rem', fontSize: '0.68rem', lineHeight: 1.4 }}>
              <span style={{ flexShrink: 0 }}>{ALERT_TYPE_ICONS[a.type]}</span>
              <span style={{ color: SEVERITY_COLORS[a.severity], fontWeight: 600, flexShrink: 0 }}>
                [{SEVERITY_LABELS[a.severity]}]
              </span>
              <span style={{ color: 'var(--foreground-muted)' }}>{ALERT_TYPE_LABELS[a.type]}</span>
            </div>
          ))}
          {alerts.length > 5 && (
            <div style={{ fontSize: '0.62rem', color: 'var(--foreground-muted)', fontStyle: 'italic' }}>
              +{alerts.length - 5} נוספות
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Global Alerts Panel ────────────────────────────��───────────────────────

function AlertsPanel({ alerts, onDismiss }: { alerts: CampaignAlert[]; onDismiss: (id: string) => void }) {
  const [groupBy, setGroupBy] = useState<'severity' | 'client'>('severity');
  const [expanded, setExpanded] = useState(true);

  if (alerts.length === 0) return null;

  const summary = summarizeAlerts(alerts);
  const highlights = generateHighlights(alerts);

  return (
    <div className="premium-card" style={{ padding: '1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1.1rem' }}>🔔</span>
          <div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--foreground)' }}>
              התראות קמפיינים
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--foreground-muted)', display: 'flex', gap: '0.5rem', marginTop: '0.1rem' }}>
              <span style={{ color: '#ef4444', fontWeight: 600 }}>{summary.high} גבוהות</span>
              <span style={{ color: '#f59e0b', fontWeight: 600 }}>{summary.medium} בינוניות</span>
              <span style={{ color: '#6b7280', fontWeight: 600 }}>{summary.low} נמוכות</span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => setGroupBy('severity')}
            className={groupBy === 'severity' ? 'mod-btn-primary' : 'mod-btn-ghost'}
            style={{ padding: '0.25rem 0.5rem', fontSize: '0.62rem', fontWeight: 600, borderRadius: '0.25rem', cursor: 'pointer' }}
          >
            חומרה
          </button>
          <button
            type="button"
            onClick={() => setGroupBy('client')}
            className={groupBy === 'client' ? 'mod-btn-primary' : 'mod-btn-ghost'}
            style={{ padding: '0.25rem 0.5rem', fontSize: '0.62rem', fontWeight: 600, borderRadius: '0.25rem', cursor: 'pointer' }}
          >
            לקוח
          </button>
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--foreground-muted)', padding: '0.2rem' }}
          >
            {expanded ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {/* Highlights strip */}
      {highlights.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.75rem' }}>
          {highlights.map((h, i) => (
            <span key={i} style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
              padding: '0.25rem 0.55rem',
              borderRadius: '1rem',
              background: `${SEVERITY_COLORS[h.severity]}0D`,
              border: `1px solid ${SEVERITY_COLORS[h.severity]}33`,
              color: SEVERITY_COLORS[h.severity],
              fontSize: '0.65rem',
              fontWeight: 600,
            }}>
              {h.icon} {h.text}
            </span>
          ))}
        </div>
      )}

      {expanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', maxHeight: '300px', overflowY: 'auto' }}>
          {groupBy === 'severity' ? (
            // Group by severity
            (['high', 'medium', 'low'] as AlertSeverity[]).map((sev) => {
              const sevAlerts = alerts.filter((a) => a.severity === sev);
              if (sevAlerts.length === 0) return null;
              return (
                <div key={sev}>
                  <div style={{ fontSize: '0.65rem', fontWeight: 700, color: SEVERITY_COLORS[sev], padding: '0.3rem 0', borderBottom: `1px solid ${SEVERITY_COLORS[sev]}22` }}>
                    {SEVERITY_LABELS[sev]} ({sevAlerts.length})
                  </div>
                  {sevAlerts.map((a) => (
                    <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.35rem 0.25rem', borderBottom: '1px solid var(--border)', fontSize: '0.7rem' }}>
                      <span style={{ flexShrink: 0 }}>{ALERT_TYPE_ICONS[a.type]}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: 'var(--foreground)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.message}</div>
                        <div style={{ fontSize: '0.6rem', color: 'var(--foreground-muted)' }}>{a.clientName}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onDismiss(a.id)}
                        title="סמן כטופל"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.72rem', color: 'var(--foreground-muted)', padding: '0.15rem', flexShrink: 0 }}
                      >
                        ✓
                      </button>
                    </div>
                  ))}
                </div>
              );
            })
          ) : (
            // Group by client
            Object.entries(summary.byClient).map(([clientId, info]) => {
              const clientAlerts = alerts.filter((a) => a.clientId === clientId);
              return (
                <div key={clientId}>
                  <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--foreground)', padding: '0.3rem 0', borderBottom: '1px solid var(--border)' }}>
                    {info.clientName || 'ללא לקוח'} ({info.count} התראות{info.highCount > 0 ? `, ${info.highCount} גבוהות` : ''})
                  </div>
                  {clientAlerts.map((a) => (
                    <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.35rem 0.25rem', borderBottom: '1px solid var(--border)', fontSize: '0.7rem' }}>
                      <span style={{ flexShrink: 0 }}>{ALERT_TYPE_ICONS[a.type]}</span>
                      <span style={{ color: SEVERITY_COLORS[a.severity], fontWeight: 600, fontSize: '0.6rem', flexShrink: 0 }}>
                        [{SEVERITY_LABELS[a.severity]}]
                      </span>
                      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--foreground)' }}>
                        {a.campaignName}: {ALERT_TYPE_LABELS[a.type]}
                      </div>
                      <button
                        type="button"
                        onClick={() => onDismiss(a.id)}
                        title="סמן כטופל"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.72rem', color: 'var(--foreground-muted)', padding: '0.15rem', flexShrink: 0 }}
                      >
                        ✓
                      </button>
                    </div>
                  ))}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ── Formatted date helper ────────────────────────────────────────────────────

function formatDate(d: string | null): string {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('he-IL', { month: 'short', day: 'numeric' }); } catch { return '—'; }
}

function formatDateRange(start: string | null, end: string | null): string {
  const s = formatDate(start);
  const e = formatDate(end);
  if (s === '—' && e === '—') return '—';
  if (e === '—') return s;
  return `${s} – ${e}`;
}

function timeAgo(d: string | null): string {
  if (!d) return '—';
  try {
    const diff = Date.now() - new Date(d).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'עכשיו';
    if (mins < 60) return `לפני ${mins} דק׳`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `לפני ${hrs} שע׳`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `לפני ${days} ימים`;
    return formatDate(d);
  } catch { return '—'; }
}

// ── Form interface (for quick modal) ─────────────────────────────────────────

interface FormData {
  campaignName: string;
  clientId: string;
  campaignType: CampaignType;
  objective: string;
  platform: CampaignPlatform;
  status: CampaignStatus;
  mediaType: CampaignMediaType;
  budget: number | '';
  caption: string;
  notes: string;
  startDate: string;
  endDate: string;
  linkedVideoProjectId: string | null;
  linkedClientFileId: string | null;
  externalMediaUrl: string;
  adAccountId: string;
  leadFormIds: string;
}

const INITIAL_FORM: FormData = {
  campaignName: '', clientId: '', campaignType: 'paid_social', objective: '',
  platform: 'facebook', status: 'draft', mediaType: 'image', budget: '',
  caption: '', notes: '', startDate: '', endDate: '',
  linkedVideoProjectId: null, linkedClientFileId: null,
  externalMediaUrl: '', adAccountId: '', leadFormIds: '',
};

// ── Shared styles ────────────────────────────────────────────────────────────

const selectFilterStyle: React.CSSProperties = {
  padding: '0.5rem 0.75rem',
  backgroundColor: 'var(--surface-raised)',
  border: '1px solid var(--border)',
  borderRadius: '0.5rem',
  color: 'var(--foreground)',
  fontSize: '0.8rem',
  cursor: 'pointer',
};

const inputFilterStyle: React.CSSProperties = {
  ...selectFilterStyle,
  cursor: 'text',
};

const modalFieldStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.75rem',
  backgroundColor: 'var(--surface-raised)',
  border: '1px solid var(--border)',
  borderRadius: '0.5rem',
  color: 'var(--foreground)',
  fontSize: '0.9rem',
  boxSizing: 'border-box' as const,
};

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

export default function CampaignsPage() {
  const { data: campaigns, loading, error, create, update, remove } = useCampaigns();
  const { data: allLeads } = useLeads();
  const { data: clients } = useClients();
  const toast = useToast();

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterClient, setFilterClient] = useState('');
  const [filterStatus, setFilterStatus] = useState<CampaignStatus | ''>('');
  const [filterPlatform, setFilterPlatform] = useState<CampaignPlatform | ''>('');
  const [filterHealth, setFilterHealth] = useState<HealthLevel | ''>('');

  // View mode
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  // Alerts state
  const [dismissedAlertIds, setDismissedAlertIds] = useState<Set<string>>(new Set());
  const [expandedAlertCard, setExpandedAlertCard] = useState<string | null>(null);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingCampaignId, setDeletingCampaignId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM);

  // Derived: initial load
  const isInitialLoad = loading && (campaigns || []).length === 0;

  // Filtered campaigns
  const filteredCampaigns = useMemo(() => {
    return (campaigns || []).filter((c) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = !q || (c.campaignName || '').toLowerCase().includes(q) || (c.clientName || '').toLowerCase().includes(q);
      const matchesClient = !filterClient || c.clientId === filterClient;
      const matchesStatus = !filterStatus || (c.status || 'draft') === filterStatus;
      const matchesPlatform = !filterPlatform || (c.platform || 'facebook') === filterPlatform;
      const matchesHealth = !filterHealth || computeHealth(c).level === filterHealth;
      return matchesSearch && matchesClient && matchesStatus && matchesPlatform && matchesHealth;
    }).sort((a, b) => {
      // Sort by updatedAt descending, then createdAt
      const da = a.updatedAt || a.createdAt || '';
      const db = b.updatedAt || b.createdAt || '';
      return db.localeCompare(da);
    });
  }, [campaigns, searchQuery, filterClient, filterStatus, filterPlatform, filterHealth]);

  // KPIs
  const kpiStats = useMemo(() => {
    const all = campaigns || [];
    const total = all.length;
    const active = all.filter((c) => c.status === 'active').length;
    const budget = all.reduce((s, c) => s + (c.budget || 0), 0);
    const pending = all.filter((c) => c.status === 'waiting_approval').length;
    const drafts = all.filter((c) => c.status === 'draft').length;
    const avgHealth = total > 0 ? Math.round(all.reduce((s, c) => s + computeHealth(c).score, 0) / total) : 0;
    return { total, active, budget, pending, drafts, avgHealth };
  }, [campaigns]);

  // Campaign → Lead Insights
  const campaignLeadInsights = useMemo(() => {
    return buildCampaignLeadInsights(allLeads || [], campaigns || []);
  }, [allLeads, campaigns]);

  const leadInsightsMap = useMemo(() => {
    const m: Record<string, { leadCount: number; highQualityCount: number; wonCount: number; avgQuality: number; totalValue: number }> = {};
    for (const ins of campaignLeadInsights) {
      m[ins.campaignId] = { leadCount: ins.leadCount, highQualityCount: ins.highQualityCount, wonCount: ins.wonCount, avgQuality: ins.avgQualityScore, totalValue: ins.totalValue };
    }
    return m;
  }, [campaignLeadInsights]);

  // Alerts
  const allAlerts = useMemo(() => {
    const raw = generateAllAlerts(campaigns || []);
    return raw.filter((a) => !dismissedAlertIds.has(a.id));
  }, [campaigns, dismissedAlertIds]);

  const alertsByCampaign = useMemo(() => {
    const map: Record<string, CampaignAlert[]> = {};
    for (const a of allAlerts) {
      if (!map[a.campaignId]) map[a.campaignId] = [];
      map[a.campaignId].push(a);
    }
    return map;
  }, [allAlerts]);

  const alertsSummary = useMemo(() => summarizeAlerts(allAlerts), [allAlerts]);

  const handleDismissAlert = useCallback((alertId: string) => {
    setDismissedAlertIds((prev) => new Set([...prev, alertId]));
  }, []);

  // Modal handlers (preserved from original)
  const handleOpenModal = useCallback((campaign?: Campaign) => {
    if (campaign) {
      setEditingCampaign(campaign);
      setFormData({
        campaignName: campaign.campaignName, clientId: campaign.clientId,
        campaignType: campaign.campaignType, objective: campaign.objective,
        platform: campaign.platform, status: campaign.status, mediaType: campaign.mediaType,
        budget: campaign.budget, caption: campaign.caption, notes: campaign.notes,
        startDate: campaign.startDate || '', endDate: campaign.endDate || '',
        linkedVideoProjectId: campaign.linkedVideoProjectId,
        linkedClientFileId: campaign.linkedClientFileId,
        externalMediaUrl: campaign.externalMediaUrl, adAccountId: campaign.adAccountId || '',
        leadFormIds: campaign.leadFormIds?.join(', ') || '',
      });
    } else {
      setEditingCampaign(null);
      setFormData(INITIAL_FORM);
    }
    setIsModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => { setIsModalOpen(false); setEditingCampaign(null); }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.campaignName.trim()) { toast('נא להכניס שם קמפיין', 'error'); return; }
    if (!formData.clientId) { toast('נא לבחור לקוח', 'error'); return; }
    const budgetNum = typeof formData.budget === 'string' ? parseFloat(formData.budget) || 0 : formData.budget;
    try {
      const selectedClient = (clients || []).find((c) => c.id === formData.clientId);
      const payload = {
        campaignName: formData.campaignName, clientId: formData.clientId, clientName: selectedClient?.name || '',
        campaignType: formData.campaignType, objective: formData.objective, platform: formData.platform,
        status: formData.status, mediaType: formData.mediaType, budget: budgetNum, caption: formData.caption,
        notes: formData.notes, startDate: formData.startDate || null, endDate: formData.endDate || null,
        linkedVideoProjectId: formData.linkedVideoProjectId, linkedClientFileId: formData.linkedClientFileId,
        externalMediaUrl: formData.externalMediaUrl, adAccountId: formData.adAccountId,
        leadFormIds: (formData.leadFormIds || '').split(',').map(s => s.trim()).filter(Boolean),
      };
      if (editingCampaign) { await update(editingCampaign.id, payload); toast('קמפיין עודכן בהצלחה', 'success'); }
      else { await create(payload); toast('קמפיין נוצר בהצלחה', 'success'); }
      handleCloseModal();
    } catch { toast(editingCampaign ? 'שגיאה בעדכון קמפיין' : 'שגיאה ביצירת קמפיין', 'error'); }
  }, [formData, clients, editingCampaign, create, update, toast, handleCloseModal]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deletingCampaignId) return;
    try { await remove(deletingCampaignId); toast('קמפיין נמחק בהצלחה', 'success'); setIsDeleteModalOpen(false); setDeletingCampaignId(null); }
    catch { toast('שגיאה במחיקת קמפיין', 'error'); }
  }, [deletingCampaignId, remove, toast]);

  const handleDuplicate = useCallback(async (c: Campaign) => {
    try {
      await create({
        campaignName: `${c.campaignName} (העתק)`, clientId: c.clientId, clientName: c.clientName,
        campaignType: c.campaignType, objective: c.objective, platform: c.platform,
        status: 'draft', mediaType: c.mediaType, budget: c.budget, caption: c.caption,
        notes: c.notes, startDate: c.startDate, endDate: c.endDate,
        linkedVideoProjectId: c.linkedVideoProjectId, linkedClientFileId: c.linkedClientFileId,
        externalMediaUrl: c.externalMediaUrl, adAccountId: c.adAccountId, leadFormIds: c.leadFormIds,
      });
      toast('קמפיין שוכפל בהצלחה', 'success');
    } catch { toast('שגיאה בשכפול', 'error'); }
  }, [create, toast]);

  const handleStatusChange = useCallback(async (id: string, status: CampaignStatus) => {
    try { await update(id, { status }); toast(`סטטוס שונה ל${STATUS_LABELS[status]}`, 'success'); }
    catch { toast('שגיאה בשינוי סטטוס', 'error'); }
  }, [update, toast]);

  // ── Loading state ────────────────────────────────────────────────────────
  if (isInitialLoad) {
    return (
      <main style={{ maxWidth: '1400px', margin: '0 auto', padding: '2rem 1.5rem', direction: 'rtl' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <div className="skeleton" style={{ width: 160, height: 32, borderRadius: '0.5rem', marginBottom: '0.5rem' }} />
          <div className="skeleton" style={{ width: 260, height: 16, borderRadius: '0.25rem' }} />
        </div>
        <SkeletonKPIRow count={5} />
        <div style={{ marginTop: '1.5rem' }}><SkeletonGrid count={6} /></div>
      </main>
    );
  }

  // ── Error state ──────────────────────────────────────────────────────────
  if (error && (campaigns || []).length === 0) {
    return (
      <main style={{ maxWidth: '1400px', margin: '0 auto', padding: '2rem 1.5rem', direction: 'rtl' }}>
        <div style={{ padding: '3rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>⚠️</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--foreground)', marginBottom: '0.5rem' }}>שגיאה בטעינת קמפיינים</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--foreground-muted)', marginBottom: '1rem' }}>{error}</div>
          <button onClick={() => window.location.reload()} className="mod-btn-primary" style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem', borderRadius: '0.5rem', cursor: 'pointer' }}>
            רענן את הדף
          </button>
        </div>
      </main>
    );
  }

  // ── Main render ──────────────────────────────────────────────────────────
  return (
    <main style={{ maxWidth: '1400px', margin: '0 auto', padding: '2rem 1.5rem', direction: 'rtl' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

        {/* ── Header ───────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--foreground)', margin: 0, letterSpacing: '-0.02em' }}>
              קמפיינים
            </h1>
            <p style={{ color: 'var(--foreground-muted)', fontSize: '0.8rem', marginTop: '0.15rem' }}>
              ניהול, מעקב ובקרה על כל הקמפיינים
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <Link
              href="/campaign-builder"
              className="mod-btn-primary"
              style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', fontWeight: 700, borderRadius: '0.5rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              🚀 בנה קמפיין
            </Link>
            <button
              onClick={() => handleOpenModal()}
              className="mod-btn-ghost"
              style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', fontWeight: 600, borderRadius: '0.5rem', cursor: 'pointer' }}
            >
              + מהיר
            </button>
          </div>
        </div>

        {/* ── KPI Row ──────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
          {[
            { label: 'סה״כ', value: kpiStats.total, color: 'var(--foreground)' },
            { label: 'פעילים', value: kpiStats.active, color: '#22c55e' },
            { label: 'טיוטות', value: kpiStats.drafts, color: '#6b7280' },
            { label: 'ממתינים', value: kpiStats.pending, color: '#f59e0b' },
            { label: 'תקציב כולל', value: `₪${(kpiStats.budget / 1000).toFixed(0)}K`, color: 'var(--accent)' },
            { label: 'בריאות ממוצעת', value: kpiStats.avgHealth, color: kpiStats.avgHealth >= 80 ? '#22c55e' : kpiStats.avgHealth >= 50 ? '#f59e0b' : '#ef4444' },
            { label: 'לידים', value: (allLeads || []).length, color: '#8b5cf6' },
            { label: 'התראות', value: allAlerts.length, color: alertsSummary.high > 0 ? '#ef4444' : allAlerts.length > 0 ? '#f59e0b' : '#22c55e' },
          ].map((kpi) => (
            <div key={kpi.label} className="premium-card" style={{ padding: '1rem', textAlign: 'center' }}>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: kpi.color }}>{kpi.value}</div>
              <div style={{ fontSize: '0.68rem', color: 'var(--foreground-muted)', fontWeight: 600, marginTop: '0.15rem' }}>{kpi.label}</div>
            </div>
          ))}
        </div>

        {/* ── Alerts Panel ─────────────────────────────────────── */}
        {allAlerts.length > 0 && (
          <AlertsPanel alerts={allAlerts} onDismiss={handleDismissAlert} />
        )}

        {/* ── Filters ─────────────────────────────────────────── */}
        <div className="premium-card" style={{ padding: '0.75rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="חפש קמפיין או לקוח..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ ...inputFilterStyle, flex: '1 1 200px', minWidth: '180px' }}
          />
          <select value={filterClient} onChange={(e) => setFilterClient(e.target.value)} style={selectFilterStyle}>
            <option value="">כל הלקוחות</option>
            {(clients || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as CampaignStatus | '')} style={selectFilterStyle}>
            <option value="">כל הסטטוסים</option>
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select value={filterPlatform} onChange={(e) => setFilterPlatform(e.target.value as CampaignPlatform | '')} style={selectFilterStyle}>
            <option value="">כל הפלטפורמות</option>
            {PLATFORM_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select value={filterHealth} onChange={(e) => setFilterHealth(e.target.value as HealthLevel | '')} style={selectFilterStyle}>
            <option value="">כל הבריאות</option>
            <option value="strong">תקין (80+)</option>
            <option value="attention">דורש תשומת לב (50-79)</option>
            <option value="weak">חלש (&lt;50)</option>
          </select>

          {/* View toggle */}
          <div style={{ display: 'flex', marginRight: 'auto', gap: '0.25rem', background: 'var(--surface-raised)', borderRadius: '0.375rem', border: '1px solid var(--border)', padding: '0.15rem' }}>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              style={{ padding: '0.3rem 0.5rem', fontSize: '0.72rem', fontWeight: 600, borderRadius: '0.25rem', border: 'none', cursor: 'pointer', background: viewMode === 'cards' ? 'var(--accent)' : 'transparent', color: viewMode === 'cards' ? 'white' : 'var(--foreground-muted)' }}
            >
              ▦ כרטיסים
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              style={{ padding: '0.3rem 0.5rem', fontSize: '0.72rem', fontWeight: 600, borderRadius: '0.25rem', border: 'none', cursor: 'pointer', background: viewMode === 'table' ? 'var(--accent)' : 'transparent', color: viewMode === 'table' ? 'white' : 'var(--foreground-muted)' }}
            >
              ☰ טבלה
            </button>
          </div>

          {/* Active filter count */}
          {(filterClient || filterStatus || filterPlatform || filterHealth || searchQuery) && (
            <button
              type="button"
              onClick={() => { setSearchQuery(''); setFilterClient(''); setFilterStatus(''); setFilterPlatform(''); setFilterHealth(''); }}
              style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
            >
              נקה סינון
            </button>
          )}
        </div>

        {/* ── Results count ────────────────────────────────────── */}
        <div style={{ fontSize: '0.72rem', color: 'var(--foreground-muted)', fontWeight: 600 }}>
          {filteredCampaigns.length} מתוך {(campaigns || []).length} קמפיינים
        </div>

        {/* ── Empty states ─────────────────────────────────────── */}
        {filteredCampaigns.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
            {(campaigns || []).length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ fontSize: '2.5rem' }}>📋</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--foreground)' }}>אין קמפיינים עדיין</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--foreground-muted)' }}>צור את הקמפיין הראשון שלך</div>
                <Link href="/campaign-builder" className="mod-btn-primary" style={{ padding: '0.6rem 1.25rem', fontSize: '0.85rem', fontWeight: 700, borderRadius: '0.5rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                  🚀 בנה קמפיין חכם
                </Link>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ fontSize: '1.5rem' }}>🔍</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--foreground)' }}>לא נמצאו קמפיינים התואמים לסינון</div>
                <button
                  type="button"
                  onClick={() => { setSearchQuery(''); setFilterClient(''); setFilterStatus(''); setFilterPlatform(''); setFilterHealth(''); }}
                  className="mod-btn-ghost"
                  style={{ padding: '0.4rem 0.875rem', fontSize: '0.78rem', fontWeight: 600, borderRadius: '0.375rem', cursor: 'pointer', marginTop: '0.25rem' }}
                >
                  נקה סינון
                </button>
              </div>
            )}
          </div>
        ) : viewMode === 'cards' ? (
          /* ── Card View ───────────────────────────────────────── */
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1rem' }}>
            {filteredCampaigns.map((c) => {
              const health = computeHealth(c);
              return (
                <div
                  key={c.id}
                  className="premium-card glow-hover"
                  style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', borderRight: `3px solid ${health.color}`, transition: 'all 200ms' }}
                >
                  {/* Top row: name + status */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--foreground)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.campaignName || 'ללא שם'}
                      </h3>
                      <p style={{ fontSize: '0.75rem', color: 'var(--foreground-muted)', margin: '0.15rem 0 0 0' }}>
                        {c.clientName || 'ללא לקוח'}
                      </p>
                    </div>
                    <div style={{ backgroundColor: STATUS_COLORS[c.status || 'draft'], color: 'white', padding: '0.2rem 0.5rem', borderRadius: '0.25rem', fontSize: '0.65rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {STATUS_LABELS[c.status || 'draft'] || 'לא ידוע'}
                    </div>
                  </div>

                  {/* Badges row */}
                  <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.68rem', fontWeight: 600, padding: '0.15rem 0.45rem', borderRadius: '0.25rem', background: 'var(--surface-raised)', border: '1px solid var(--border)', color: 'var(--foreground)' }}>
                      {PLATFORM_ICONS[c.platform || 'facebook']} {PLATFORM_LABELS[c.platform || 'facebook']}
                    </span>
                    <span style={{ fontSize: '0.68rem', fontWeight: 600, padding: '0.15rem 0.45rem', borderRadius: '0.25rem', background: 'var(--surface-raised)', border: '1px solid var(--border)', color: 'var(--foreground)' }}>
                      {TYPE_LABELS[c.campaignType || 'custom']}
                    </span>
                    <span style={{ fontSize: '0.68rem', fontWeight: 600, padding: '0.15rem 0.45rem', borderRadius: '0.25rem', background: 'var(--surface-raised)', border: '1px solid var(--border)', color: 'var(--foreground)' }}>
                      {MEDIA_TYPE_LABELS[c.mediaType || 'image']}
                    </span>
                  </div>

                  {/* Objective */}
                  {c.objective && (
                    <p style={{ fontSize: '0.73rem', color: 'var(--foreground-muted)', margin: 0, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
                      {c.objective}
                    </p>
                  )}

                  {/* Stats row */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', padding: '0.6rem 0', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--foreground)' }}>₪{(c.budget || 0).toLocaleString('he-IL')}</div>
                      <div style={{ fontSize: '0.6rem', color: 'var(--foreground-muted)', fontWeight: 600 }}>תקציב</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--foreground)' }}>{formatDateRange(c.startDate, c.endDate)}</div>
                      <div style={{ fontSize: '0.6rem', color: 'var(--foreground-muted)', fontWeight: 600 }}>תאריכים</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: (leadInsightsMap[c.id]?.leadCount || 0) > 0 ? '#8b5cf6' : 'var(--foreground-muted)' }}>{leadInsightsMap[c.id]?.leadCount || 0}</div>
                      <div style={{ fontSize: '0.6rem', color: 'var(--foreground-muted)', fontWeight: 600 }}>לידים</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--foreground)' }}>{timeAgo(c.updatedAt)}</div>
                      <div style={{ fontSize: '0.6rem', color: 'var(--foreground-muted)', fontWeight: 600 }}>עדכון</div>
                    </div>
                  </div>

                  {/* Health + readiness */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <HealthBadge campaign={c} />
                    <ReadinessIndicators campaign={c} />
                  </div>

                  {/* Alerts badge */}
                  {(alertsByCampaign[c.id] || []).length > 0 && (
                    <CampaignAlertBadge
                      alerts={alertsByCampaign[c.id]}
                      expanded={expandedAlertCard === c.id}
                      onToggle={() => setExpandedAlertCard(expandedAlertCard === c.id ? null : c.id)}
                    />
                  )}

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '0.35rem', marginTop: 'auto', paddingTop: '0.25rem' }}>
                    <Link href={`/campaigns/${c.id}`} className="mod-btn-ghost" style={{ flex: 1, padding: '0.35rem', fontSize: '0.68rem', fontWeight: 600, borderRadius: '0.3rem', textAlign: 'center', textDecoration: 'none' }}>
                      צפה
                    </Link>
                    <button type="button" onClick={() => handleOpenModal(c)} className="mod-btn-ghost" style={{ flex: 1, padding: '0.35rem', fontSize: '0.68rem', fontWeight: 600, borderRadius: '0.3rem', cursor: 'pointer' }}>
                      עריכה
                    </button>
                    <button type="button" onClick={() => handleDuplicate(c)} className="mod-btn-ghost" style={{ flex: 1, padding: '0.35rem', fontSize: '0.68rem', fontWeight: 600, borderRadius: '0.3rem', cursor: 'pointer' }}>
                      שכפל
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStatusChange(c.id, c.status === 'draft' ? 'waiting_approval' : 'draft')}
                      className="mod-btn-ghost"
                      style={{ flex: 1, padding: '0.35rem', fontSize: '0.68rem', fontWeight: 600, borderRadius: '0.3rem', cursor: 'pointer' }}
                    >
                      {c.status === 'draft' ? 'מוכן' : 'טיוטה'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setDeletingCampaignId(c.id); setIsDeleteModalOpen(true); }}
                      style={{ padding: '0.35rem 0.5rem', fontSize: '0.68rem', fontWeight: 600, borderRadius: '0.3rem', cursor: 'pointer', background: 'transparent', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444' }}
                    >
                      ✗
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* ── Table View ──────────────────────────────────────── */
          <div className="premium-card" style={{ overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  {['קמפיין', 'לקוח', 'פלטפורמה', 'סטטוס', 'תקציב', 'תאריכים', 'בריאות', 'מוכנות', 'עדכון', 'פעולות'].map((h) => (
                    <th key={h} style={{ padding: '0.65rem 0.5rem', textAlign: 'right', fontWeight: 700, color: 'var(--foreground-muted)', fontSize: '0.7rem', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredCampaigns.map((c) => (
                  <tr key={c.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 150ms' }} onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-raised)')} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '0.6rem 0.5rem', fontWeight: 600, color: 'var(--foreground)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <Link href={`/campaigns/${c.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>{c.campaignName || 'ללא שם'}</Link>
                    </td>
                    <td style={{ padding: '0.6rem 0.5rem', color: 'var(--foreground-muted)' }}>{c.clientName || '—'}</td>
                    <td style={{ padding: '0.6rem 0.5rem' }}>
                      <span style={{ fontSize: '0.68rem', padding: '0.12rem 0.35rem', borderRadius: '0.2rem', background: 'var(--surface-raised)', border: '1px solid var(--border)' }}>
                        {PLATFORM_ICONS[c.platform || 'facebook']} {PLATFORM_LABELS[c.platform || 'facebook']}
                      </span>
                    </td>
                    <td style={{ padding: '0.6rem 0.5rem' }}>
                      <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '0.15rem 0.4rem', borderRadius: '0.2rem', background: STATUS_COLORS[c.status || 'draft'], color: 'white' }}>
                        {STATUS_LABELS[c.status || 'draft']}
                      </span>
                    </td>
                    <td style={{ padding: '0.6rem 0.5rem', fontWeight: 600, direction: 'ltr', textAlign: 'left' }}>₪{(c.budget || 0).toLocaleString()}</td>
                    <td style={{ padding: '0.6rem 0.5rem', color: 'var(--foreground-muted)', whiteSpace: 'nowrap' }}>{formatDateRange(c.startDate, c.endDate)}</td>
                    <td style={{ padding: '0.6rem 0.5rem' }}><HealthBadge campaign={c} size="compact" /></td>
                    <td style={{ padding: '0.6rem 0.5rem' }}><ReadinessIndicators campaign={c} /></td>
                    <td style={{ padding: '0.6rem 0.5rem', color: 'var(--foreground-muted)', whiteSpace: 'nowrap', fontSize: '0.7rem' }}>{timeAgo(c.updatedAt)}</td>
                    <td style={{ padding: '0.6rem 0.5rem' }}>
                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                        <button type="button" onClick={() => handleOpenModal(c)} title="עריכה" style={{ padding: '0.2rem 0.35rem', fontSize: '0.68rem', borderRadius: '0.2rem', border: '1px solid var(--border)', background: 'transparent', color: 'var(--foreground-muted)', cursor: 'pointer' }}>✎</button>
                        <button type="button" onClick={() => handleDuplicate(c)} title="שכפל" style={{ padding: '0.2rem 0.35rem', fontSize: '0.68rem', borderRadius: '0.2rem', border: '1px solid var(--border)', background: 'transparent', color: 'var(--foreground-muted)', cursor: 'pointer' }}>⧉</button>
                        <button type="button" onClick={() => { setDeletingCampaignId(c.id); setIsDeleteModalOpen(true); }} title="מחק" style={{ padding: '0.2rem 0.35rem', fontSize: '0.68rem', borderRadius: '0.2rem', border: '1px solid rgba(239,68,68,0.3)', background: 'transparent', color: '#ef4444', cursor: 'pointer' }}>✗</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Quick Create/Edit Modal (preserved) ────────────────── */}
      <Modal open={isModalOpen} onClose={handleCloseModal} title={editingCampaign ? 'עריכת קמפיין' : 'קמפיין מהיר'}>
        <div style={{ padding: '1.5rem', maxWidth: '600px' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>שם קמפיין *</label>
              <input type="text" value={formData.campaignName} onChange={(e) => setFormData({ ...formData, campaignName: e.target.value })} placeholder="הכנס שם קמפיין" style={modalFieldStyle} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>לקוח *</label>
              <select value={formData.clientId} onChange={(e) => setFormData({ ...formData, clientId: e.target.value })} style={{ ...modalFieldStyle, cursor: 'pointer' }}>
                <option value="">בחר לקוח</option>
                {(clients || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>סוג</label>
                <select value={formData.campaignType} onChange={(e) => setFormData({ ...formData, campaignType: e.target.value as CampaignType })} style={{ ...modalFieldStyle, cursor: 'pointer' }}>
                  {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>פלטפורמה</label>
                <select value={formData.platform} onChange={(e) => setFormData({ ...formData, platform: e.target.value as CampaignPlatform })} style={{ ...modalFieldStyle, cursor: 'pointer' }}>
                  {PLATFORM_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>סטטוס</label>
                <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value as CampaignStatus })} style={{ ...modalFieldStyle, cursor: 'pointer' }}>
                  {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>סוג תוכן</label>
                <select value={formData.mediaType} onChange={(e) => setFormData({ ...formData, mediaType: e.target.value as CampaignMediaType })} style={{ ...modalFieldStyle, cursor: 'pointer' }}>
                  {MEDIA_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>מטרה</label>
              <textarea value={formData.objective} onChange={(e) => setFormData({ ...formData, objective: e.target.value })} placeholder="מטרת הקמפיין" style={{ ...modalFieldStyle, minHeight: '60px', fontFamily: 'inherit', resize: 'vertical' as const }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>תקציב ₪</label>
                <input type="number" value={formData.budget} onChange={(e) => setFormData({ ...formData, budget: e.target.value === '' ? '' : Number(e.target.value) })} min="0" style={modalFieldStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>התחלה</label>
                <input type="date" value={formData.startDate} onChange={(e) => setFormData({ ...formData, startDate: e.target.value })} style={modalFieldStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>סיום</label>
                <input type="date" value={formData.endDate} onChange={(e) => setFormData({ ...formData, endDate: e.target.value })} style={modalFieldStyle} />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>כיתוב / קופי</label>
              <textarea value={formData.caption} onChange={(e) => setFormData({ ...formData, caption: e.target.value })} placeholder="טקסט המודעה" style={{ ...modalFieldStyle, minHeight: '50px', fontFamily: 'inherit', resize: 'vertical' as const }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>הערות</label>
              <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="הערות פנימיות" style={{ ...modalFieldStyle, minHeight: '50px', fontFamily: 'inherit', resize: 'vertical' as const }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>חשבון פרסום</label>
                <input type="text" value={formData.adAccountId} onChange={(e) => setFormData({ ...formData, adAccountId: e.target.value })} placeholder="מזהה חשבון" style={modalFieldStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>קישור מדיה</label>
                <input type="url" value={formData.externalMediaUrl} onChange={(e) => setFormData({ ...formData, externalMediaUrl: e.target.value })} placeholder="https://..." style={modalFieldStyle} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '0.5rem' }}>
              <button type="submit" className="mod-btn-primary" style={{ flex: 1, padding: '0.6rem', fontSize: '0.85rem', fontWeight: 700, borderRadius: '0.5rem', cursor: 'pointer' }}>
                {editingCampaign ? 'עדכן' : 'צור'}
              </button>
              <button type="button" onClick={handleCloseModal} className="mod-btn-ghost" style={{ flex: 1, padding: '0.6rem', fontSize: '0.85rem', fontWeight: 600, borderRadius: '0.5rem', cursor: 'pointer' }}>
                ביטול
              </button>
            </div>
          </form>
        </div>
      </Modal>

      {/* ── Delete Modal (preserved) ───────────────────────────── */}
      <Modal open={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="אישור מחיקה">
        <div style={{ padding: '1.5rem', maxWidth: '400px' }}>
          <p style={{ color: 'var(--foreground-muted)', marginBottom: '1.5rem', fontSize: '0.85rem' }}>
            האם אתה בטוח שברצונך למחוק קמפיין זה? לא ניתן לשחזר פעולה זו.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button onClick={handleDeleteConfirm} style={{ flex: 1, padding: '0.6rem', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '0.5rem', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}>
              מחק
            </button>
            <button onClick={() => setIsDeleteModalOpen(false)} className="mod-btn-ghost" style={{ flex: 1, padding: '0.6rem', fontSize: '0.85rem', fontWeight: 600, borderRadius: '0.5rem', cursor: 'pointer' }}>
              ביטול
            </button>
          </div>
        </div>
      </Modal>
    </main>
  );
}
