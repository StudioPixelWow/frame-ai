'use client';

export const dynamic = 'force-dynamic';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCampaigns, useAdSets, useAds, useClients, useLeads } from '@/lib/api/use-entity';
import { useToast } from '@/components/ui/toast';
import { Modal } from '@/components/ui/modal';
import { SkeletonKPIRow } from '@/components/ui/skeleton';
import type {
  Campaign, AdSet, Ad, AdCreativeType, AdSetStatus, AdStatus, Lead,
} from '@/lib/db/schema';
import { computeHealth } from '@/lib/campaigns/health-engine';
import { buildCampaignLeadInsights } from '@/lib/leads/lead-quality';
import {
  analyzeCampaignFull,
  getAdSetBadge,
  getAdNote,
  RECOMMENDATION_TYPE_META,
  SEVERITY_META,
  ACTION_LABELS,
  type Recommendation,
  type RecommendationAction,
} from '@/lib/optimization/engine';
import {
  buildCreateVariationAction,
  buildDuplicateAdAction,
  buildPauseAdAction,
  ACTION_TYPE_META,
} from '@/lib/optimization/actions';
import { generateVariation, VARIATION_STRATEGY_META } from '@/lib/optimization/variations';

// ── Labels ─────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  draft: 'טיוטה', in_progress: 'בתהליך', waiting_approval: 'ממתין לאישור',
  approved: 'מאושר', scheduled: 'מתוזמן', active: 'פעיל', completed: 'הושלם',
  paused: 'מושהה', rejected: 'נדחה', archived: 'ארכיון',
};

const STATUS_COLORS: Record<string, string> = {
  draft: '#6b7280', in_progress: '#3b82f6', waiting_approval: '#f59e0b',
  approved: '#22c55e', scheduled: '#8b5cf6', active: '#22c55e', completed: '#0ea5e9',
  paused: '#f59e0b', rejected: '#ef4444', archived: '#6b7280',
};

const CREATIVE_TYPE_LABELS: Record<AdCreativeType, string> = {
  image: 'תמונה', video: 'וידאו', carousel: 'קרוסלה', slideshow: 'מצגת',
};

const CREATIVE_TYPE_ICONS: Record<AdCreativeType, string> = {
  image: '🖼️', video: '🎬', carousel: '🎠', slideshow: '📊',
};

const PLATFORM_LABELS: Record<string, string> = {
  facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok', multi_platform: 'רב פלטפורמה',
};

const CTA_LABELS: Record<string, string> = {
  LEARN_MORE: 'למידע נוסף', SIGN_UP: 'הרשמה', SHOP_NOW: 'קנה עכשיו',
  CONTACT_US: 'צור קשר', BOOK_NOW: 'הזמן עכשיו', DOWNLOAD: 'הורד',
  GET_OFFER: 'קבל הצעה', SUBSCRIBE: 'הירשם', APPLY_NOW: 'הגש מועמדות',
};

const LEAD_STATUS_LABELS: Record<string, string> = {
  new: 'חדש', assigned: 'שויך', contacted: 'נוצר קשר', no_answer: 'לא ענה',
  interested: 'מתעניין', proposal_sent: 'הצעה נשלחה', negotiation: 'משא ומתן',
  meeting_set: 'פגישה נקבעה', won: 'נסגר', lost: 'אבד', not_relevant: 'לא רלוונטי', duplicate: 'כפול',
};

const LEAD_STATUS_COLORS: Record<string, string> = {
  new: '#3b82f6', assigned: '#8b5cf6', contacted: '#0ea5e9', no_answer: '#6b7280',
  interested: '#f59e0b', proposal_sent: '#a855f7', negotiation: '#f97316',
  meeting_set: '#14b8a6', won: '#22c55e', lost: '#ef4444', not_relevant: '#6b7280', duplicate: '#9ca3af',
};

// ── BI Campaign Warnings (inline component) ────────────────────────────

function CampaignBIWarnings({ clientId, campaignId }: { clientId: string; campaignId: string }) {
  const [warnings, setWarnings] = useState<Array<{ title: string; detail: string; severity: string; actionSuggestion: string }>>([]);
  useEffect(() => {
    if (!clientId) return;
    fetch(`/api/data/bi?section=warnings&clientId=${clientId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const w = (d?.warnings?.warnings || [])
          .filter((w: any) => !w.campaignId || w.campaignId === campaignId)
          .slice(0, 3);
        setWarnings(w);
      })
      .catch(() => {});
  }, [clientId, campaignId]);

  if (warnings.length === 0) return null;

  const sevColors: Record<string, string> = { critical: '#ef4444', high: '#f97316', medium: '#f59e0b', low: '#6b7280' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
      {warnings.map((w, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem',
          background: `${sevColors[w.severity] || '#6b7280'}08`, borderRadius: '0.5rem',
          border: `1px solid ${sevColors[w.severity] || '#6b7280'}20`,
          fontSize: '0.75rem',
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: sevColors[w.severity], flexShrink: 0 }} />
          <span style={{ fontWeight: 600, color: 'var(--foreground)' }}>{w.title}</span>
          <span style={{ color: 'var(--foreground-muted)', fontSize: '0.68rem' }}>— {w.actionSuggestion}</span>
        </div>
      ))}
    </div>
  );
}

// ── AI Ad Analysis (deterministic, no API) ─────────────────────────────

type AIAdStatus = 'scale' | 'fatigued' | 'improve';

const AI_STATUS_CONFIG: Record<AIAdStatus, { label: string; color: string; bg: string; icon: string }> = {
  scale:    { label: 'מוכן לסקייל', color: '#22c55e', bg: '#22c55e12', icon: '🚀' },
  fatigued: { label: 'נשחק',       color: '#f59e0b', bg: '#f59e0b12', icon: '⚡' },
  improve:  { label: 'צריך שיפור', color: '#ef4444', bg: '#ef444412', icon: '🔧' },
};

function getAdAIStatus(ad: Ad): AIAdStatus {
  if (ad.ctr >= 2 && ad.cpl > 0 && ad.cpl < 50 && ad.leads >= 5) return 'scale';
  if (ad.ctr > 0 && ad.ctr < 1) return 'improve';
  if (ad.impressions > 5000 && ad.ctr < 1.5) return 'fatigued';
  if (ad.spend > 200 && ad.leads === 0) return 'improve';
  if (ad.ctr >= 1.5 || ad.leads >= 3) return 'scale';
  if (ad.impressions > 2000) return 'fatigued';
  return 'improve';
}

function getAdAIInsight(ad: Ad, status: AIAdStatus): string {
  if (status === 'scale') return `CTR ${ad.ctr.toFixed(1)}% מעולה — שווה להגדיל תקציב ולהרחיב קהל`;
  if (status === 'fatigued') return `${(ad.impressions / 1000).toFixed(0)}K חשיפות עם CTR יורד — נסה קריאייטיב חדש`;
  if (ad.spend > 100 && ad.leads === 0) return `₪${ad.spend.toFixed(0)} הוצאה ללא לידים — שנה כותרת או CTA`;
  return 'שפר את הכותרת והקריאייטיב כדי לשפר ביצועים';
}

/** Color-code a metric value based on thresholds */
function metricColor(value: number, good: number, mid: number): string {
  if (value >= good) return '#22c55e';
  if (value >= mid) return '#f59e0b';
  if (value > 0) return '#ef4444';
  return 'rgba(255,255,255,0.5)';
}

// ── Ad Intelligence Engine ─────────────────────────────────────────────

/** Composite performance score (0–100) for sorting & ranking */
function getAdPerformanceScore(ad: Ad): number {
  let score = 0;
  // CTR component (0–30)
  score += Math.min(ad.ctr * 10, 30);
  // Leads component (0–25)
  score += Math.min(ad.leads * 5, 25);
  // Cost efficiency (0–25): lower CPL = better
  if (ad.cpl > 0 && ad.cpl < 30) score += 25;
  else if (ad.cpl > 0 && ad.cpl < 60) score += 15;
  else if (ad.cpl > 0 && ad.cpl < 100) score += 5;
  // Engagement volume (0–20)
  if (ad.impressions > 10000) score += 20;
  else if (ad.impressions > 5000) score += 12;
  else if (ad.impressions > 1000) score += 6;
  return Math.min(score, 100);
}

/** Detect if ad performance is declining (at risk) */
function isAdAtRisk(ad: Ad): boolean {
  // High spend, zero results
  if (ad.spend > 150 && ad.leads === 0) return true;
  // Very high impressions but terrible CTR
  if (ad.impressions > 3000 && ad.ctr < 0.5) return true;
  // High CPL relative to spend
  if (ad.cpl > 120 && ad.spend > 100) return true;
  return false;
}

/** Find the best ad (winner) in a list */
function findWinnerAd(ads: Ad[]): string | null {
  if (ads.length < 2) return null;
  let best: Ad | null = null;
  let bestScore = -1;
  for (const ad of ads) {
    const s = getAdPerformanceScore(ad);
    if (s > bestScore && s >= 30) { best = ad; bestScore = s; }
  }
  return best?.id || null;
}

/** Sort ads by performance score descending (stable) */
function sortAdsByPerformance(ads: Ad[]): Ad[] {
  return [...ads].sort((a, b) => getAdPerformanceScore(b) - getAdPerformanceScore(a));
}

/** Group ads by performance tier */
function groupAdsByTier(ads: Ad[]): { tier: string; color: string; ads: Ad[] }[] {
  const tiers: { tier: string; color: string; ads: Ad[] }[] = [
    { tier: '🏆 מובילים', color: '#22c55e', ads: [] },
    { tier: '⚡ ממוצעים', color: '#f59e0b', ads: [] },
    { tier: '🔧 לשיפור', color: '#ef4444', ads: [] },
  ];
  for (const ad of ads) {
    const score = getAdPerformanceScore(ad);
    if (score >= 50) tiers[0].ads.push(ad);
    else if (score >= 20) tiers[1].ads.push(ad);
    else tiers[2].ads.push(ad);
  }
  return tiers.filter((t) => t.ads.length > 0);
}

/** Generate a fake sparkline path for timeline (deterministic from ad data) */
function generateSparklinePath(ad: Ad, width: number, height: number): string {
  const points = 8;
  const seed = (ad.impressions * 7 + ad.clicks * 13 + ad.leads * 29 + ad.spend * 3) || 1;
  const vals: number[] = [];
  let v = 0.5;
  for (let i = 0; i < points; i++) {
    v += (Math.sin(seed * (i + 1) * 0.7) * 0.3);
    v = Math.max(0.05, Math.min(0.95, v));
    vals.push(v);
  }
  // Normalize
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  return vals.map((v2, i) => {
    const x = (i / (points - 1)) * width;
    const y = height - ((v2 - min) / range) * height * 0.85 - height * 0.075;
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
}

/** Get AI whisper — a subtle, actionable micro-suggestion */
function getAdWhisper(ad: Ad): { text: string; type: 'tip' | 'warn' | 'boost' } {
  if (ad.spend > 200 && ad.leads === 0) return { text: 'עצור והחלף קריאייטיב — אין תוצאות', type: 'warn' };
  if (ad.ctr >= 3) return { text: 'נסה להגדיל תקציב ב-20% ולהרחיב גיאוגרפיה', type: 'boost' };
  if (ad.ctr >= 2 && ad.leads >= 3) return { text: 'שכפל עם כותרת שונה לבדיקת A/B', type: 'boost' };
  if (ad.impressions > 5000 && ad.ctr < 1) return { text: 'שנה תמונה ראשית — הקריאייטיב לא תופס', type: 'warn' };
  if (ad.cpl > 80) return { text: 'נסה CTA חזק יותר או קהל יעד מצומצם', type: 'tip' };
  if (ad.leads >= 1 && ad.ctr < 1.5) return { text: 'CTR נמוך — שפר כותרת וטקסט ראשי', type: 'tip' };
  return { text: 'הוסף A/B test עם וריאציית כותרת', type: 'tip' };
}

const WHISPER_COLORS = {
  tip: { color: '#8b5cf6', bg: 'rgba(139,92,246,0.06)' },
  warn: { color: '#ef4444', bg: 'rgba(239,68,68,0.06)' },
  boost: { color: '#22c55e', bg: 'rgba(34,197,94,0.06)' },
};

type AdSortMode = 'default' | 'performance' | 'spend' | 'leads' | 'ctr';
type AdGroupMode = 'none' | 'tier' | 'creative' | 'status';

// ── View mode types ────────────────────────────────────────────────────

type AdViewMode = 'grid' | 'compare' | 'heat' | 'timeline';
type AdFilter = 'all' | 'best' | 'worst' | 'active' | 'paused' | 'image' | 'video' | 'ai_scale' | 'ai_fatigued' | 'ai_improve';

// ── Styles ──────────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  background: 'var(--surface-raised)',
  border: '1px solid var(--border)',
  borderRadius: '0.75rem',
  padding: '1.25rem',
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: '1.1rem', fontWeight: 700, color: 'var(--foreground)', margin: '0 0 1rem 0',
};

const badgeStyle = (bg: string, color: string): React.CSSProperties => ({
  fontSize: '0.65rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: '0.25rem',
  background: `${bg}18`, color, border: `1px solid ${bg}30`, whiteSpace: 'nowrap' as const,
});

const metricStyle: React.CSSProperties = {
  textAlign: 'center' as const,
};

const metricValueStyle: React.CSSProperties = {
  fontSize: '1rem', fontWeight: 800, color: 'var(--foreground)',
};

const metricLabelStyle: React.CSSProperties = {
  fontSize: '0.6rem', color: 'var(--foreground-muted)', fontWeight: 600, marginTop: '0.1rem',
};

const pillBtn = (active: boolean): React.CSSProperties => ({
  padding: '0.3rem 0.65rem', fontSize: '0.68rem', fontWeight: 600,
  borderRadius: '999px', border: 'none', cursor: 'pointer',
  background: active ? 'var(--accent)' : 'var(--surface-raised)',
  color: active ? '#fff' : 'var(--foreground-muted)',
  transition: 'all 150ms',
  whiteSpace: 'nowrap' as const,
});

// ── Premium Ad Card (Intelligence Edition) ────────────────────────────

function AdCard({
  ad, onEdit, onDuplicate, onCreateVariation, onInlineEdit, viewMode,
  isWinner, isSelected, onToggleSelect, aiNote,
}: {
  ad: Ad;
  onEdit: (ad: Ad) => void;
  onDuplicate: (ad: Ad) => void;
  onCreateVariation: (ad: Ad) => void;
  onInlineEdit?: (ad: Ad, field: string, value: string) => void;
  viewMode: AdViewMode;
  isWinner?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (ad: Ad) => void;
  aiNote?: { title: string; icon: string; color: string } | null;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [whisperOpen, setWhisperOpen] = useState(false);
  const [inlineField, setInlineField] = useState<string | null>(null);
  const [inlineValue, setInlineValue] = useState('');

  const isVideo = ad.creativeType === 'video';
  const hasMedia = ad.mediaUrl && ad.mediaUrl.length > 5;
  const statusColor = STATUS_COLORS[ad.status] || '#6b7280';
  const aiStatus = getAdAIStatus(ad);
  const aiConfig = AI_STATUS_CONFIG[aiStatus];
  const aiInsight = getAdAIInsight(ad, aiStatus);
  const atRisk = isAdAtRisk(ad);
  const whisper = getAdWhisper(ad);
  const whisperColor = WHISPER_COLORS[whisper.type];
  const perfScore = getAdPerformanceScore(ad);
  const isHeat = viewMode === 'heat';
  const isTimeline = viewMode === 'timeline';

  // Heat border color
  const heatColor = isHeat
    ? (aiStatus === 'scale' ? '#22c55e' : aiStatus === 'fatigued' ? '#f59e0b' : '#ef4444')
    : 'transparent';

  // Winner glow
  const winnerGlow = isWinner
    ? '0 0 18px rgba(34,197,94,0.35), 0 0 4px rgba(34,197,94,0.2)'
    : '';

  useEffect(() => {
    if (!videoRef.current || !isVideo) return;
    if (isHovering) { videoRef.current.play().catch(() => {}); }
    else { videoRef.current.pause(); videoRef.current.currentTime = 0; }
  }, [isHovering, isVideo]);

  // Magnetic tilt handler
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (e.clientX - cx) / (rect.width / 2);
    const dy = (e.clientY - cy) / (rect.height / 2);
    setTilt({ x: dy * -2.5, y: dx * 2.5 });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovering(false);
    setTilt({ x: 0, y: 0 });
  }, []);

  // Inline edit helpers
  const startInlineEdit = (field: string, currentValue: string) => {
    setInlineField(field);
    setInlineValue(currentValue);
  };

  const commitInlineEdit = () => {
    if (inlineField && onInlineEdit && inlineValue.trim()) {
      onInlineEdit(ad, inlineField, inlineValue.trim());
    }
    setInlineField(null);
  };

  const tiltTransform = isHovering
    ? `translateY(-4px) perspective(600px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`
    : 'translateY(0) perspective(600px) rotateX(0deg) rotateY(0deg)';

  return (
    <div
      ref={cardRef}
      className="ad-card-premium"
      style={{
        position: 'relative',
        borderRadius: '0.75rem',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'transform 250ms cubic-bezier(0.22,1,0.36,1), box-shadow 250ms cubic-bezier(0.22,1,0.36,1)',
        transform: tiltTransform,
        boxShadow: [
          isHovering ? '0 12px 32px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,181,254,0.15)' : '0 1px 3px rgba(0,0,0,0.06), 0 0 0 1px var(--border)',
          winnerGlow,
        ].filter(Boolean).join(', '),
        background: 'var(--surface-raised)',
        border: isSelected ? '2px solid var(--accent)' : isWinner ? '2px solid #22c55e' : isHeat ? `2px solid ${heatColor}` : '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
      }}
      onMouseEnter={() => setIsHovering(true)}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* ── Winner Badge ── */}
      {isWinner && (
        <div style={{
          position: 'absolute', top: '-1px', left: '50%', transform: 'translateX(-50%)',
          zIndex: 10, fontSize: '0.58rem', fontWeight: 800, padding: '0.15rem 0.65rem',
          borderRadius: '0 0 0.4rem 0.4rem',
          background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: '#fff',
          boxShadow: '0 2px 8px rgba(34,197,94,0.3)',
          letterSpacing: '0.02em',
        }}>
          🏆 המודעה המובילה
        </div>
      )}

      {/* ── Compare Checkbox ── */}
      {onToggleSelect && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggleSelect(ad); }}
          style={{
            position: 'absolute', top: '0.35rem', left: '0.35rem', zIndex: 12,
            width: '1.3rem', height: '1.3rem', borderRadius: '0.25rem',
            border: `2px solid ${isSelected ? 'var(--accent)' : 'rgba(255,255,255,0.5)'}`,
            background: isSelected ? 'var(--accent)' : 'rgba(0,0,0,0.3)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.7rem', color: '#fff', fontWeight: 800,
            backdropFilter: 'blur(4px)', transition: 'all 150ms',
          }}
        >
          {isSelected ? '✓' : ''}
        </button>
      )}

      {/* ── At Risk Overlay ── */}
      {atRisk && !isHovering && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(239,68,68,0.06)',
          borderRadius: '0.75rem', zIndex: 1, pointerEvents: 'none',
        }} />
      )}

      {/* ── Media Area ─────────────────────────── */}
      <div style={{
        position: 'relative',
        width: '100%',
        paddingBottom: isTimeline ? '65%' : '105%',
        background: 'var(--surface-sunken, #111)',
        overflow: 'hidden',
      }}>
        {hasMedia ? (
          isVideo ? (
            <video
              ref={videoRef}
              src={ad.mediaUrl}
              poster={ad.thumbnailUrl || undefined}
              muted loop playsInline
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <img
              src={ad.mediaUrl}
              alt={ad.name}
              loading="lazy"
              style={{
                position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover',
                transition: 'transform 400ms cubic-bezier(0.22,1,0.36,1)',
                transform: isHovering ? 'scale(1.06)' : 'scale(1)',
              }}
            />
          )
        ) : (
          <div style={{
            position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            color: 'var(--foreground-muted)', fontSize: '0.8rem',
            background: 'linear-gradient(135deg, rgba(0,181,254,0.04), rgba(139,92,246,0.04))',
          }}>
            <span style={{ fontSize: '2.5rem', marginBottom: '0.5rem', opacity: 0.6 }}>
              {CREATIVE_TYPE_ICONS[ad.creativeType]}
            </span>
            <span style={{ fontWeight: 600 }}>אין מדיה</span>
          </div>
        )}

        {/* ── Performance Overlay (color-coded) ── */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'linear-gradient(transparent 0%, rgba(0,0,0,0.92) 70%)',
          padding: '2rem 0.6rem 0.55rem',
          display: 'flex', justifyContent: 'space-around',
          opacity: isHovering ? 1 : 0.85,
          transition: 'opacity 200ms',
        }}>
          {[
            { val: ad.ctr > 0 ? `${ad.ctr.toFixed(1)}%` : '—', label: 'CTR', color: metricColor(ad.ctr, 2, 1) },
            { val: ad.cpl > 0 ? `₪${ad.cpl.toFixed(0)}` : '—', label: 'CPL', color: ad.cpl > 0 && ad.cpl < 50 ? '#22c55e' : ad.cpl > 0 && ad.cpl < 100 ? '#f59e0b' : ad.cpl > 0 ? '#ef4444' : 'rgba(255,255,255,0.5)' },
            { val: ad.leads > 0 ? String(ad.leads) : '—', label: 'לידים', color: metricColor(ad.leads, 10, 3) },
            { val: ad.clicks > 0 && ad.leads > 0 ? `${(ad.leads / ad.clicks * 100).toFixed(1)}%` : '—', label: 'המרה', color: ad.clicks > 0 && ad.leads > 0 ? metricColor(ad.leads / ad.clicks * 100, 5, 2) : 'rgba(255,255,255,0.5)' },
            { val: ad.spend > 0 ? `₪${ad.spend.toFixed(0)}` : '—', label: 'הוצאה', color: 'rgba(255,255,255,0.85)' },
          ].map((m) => (
            <div key={m.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 800, color: m.color, letterSpacing: '-0.02em' }}>{m.val}</div>
              <div style={{ fontSize: '0.5rem', color: 'rgba(255,255,255,0.55)', fontWeight: 600, marginTop: '0.1rem' }}>{m.label}</div>
            </div>
          ))}
        </div>

        {/* ── Score Pill (top-left, behind creative type) ── */}
        <div style={{
          position: 'absolute', top: '0.45rem', left: '0.45rem',
          fontSize: '0.55rem', fontWeight: 700, padding: '0.18rem 0.4rem',
          borderRadius: '0.2rem', background: 'rgba(0,0,0,0.55)', color: '#fff',
          backdropFilter: 'blur(4px)',
        }}>
          {CREATIVE_TYPE_ICONS[ad.creativeType]} {CREATIVE_TYPE_LABELS[ad.creativeType]}
        </div>

        {/* ── Top-right: Status + At Risk ── */}
        <div style={{ position: 'absolute', top: '0.45rem', right: '0.45rem', display: 'flex', gap: '0.25rem' }}>
          {atRisk && (
            <div style={{
              fontSize: '0.55rem', fontWeight: 700, padding: '0.18rem 0.45rem',
              borderRadius: '0.2rem', background: 'rgba(239,68,68,0.85)', color: '#fff',
              backdropFilter: 'blur(4px)', animation: 'pulse-subtle 2s infinite',
            }}>
              ⚠️ ירידה בביצועים
            </div>
          )}
          <div style={{
            fontSize: '0.55rem', fontWeight: 700, padding: '0.18rem 0.45rem',
            borderRadius: '0.2rem', background: statusColor, color: '#fff',
            backdropFilter: 'blur(4px)',
          }}>
            {STATUS_LABELS[ad.status] || ad.status}
          </div>
        </div>

        {/* ── AI Badge ── */}
        <div style={{
          position: 'absolute', bottom: isHovering ? '3.8rem' : '3.2rem', right: '0.45rem',
          fontSize: '0.55rem', fontWeight: 700, padding: '0.2rem 0.5rem',
          borderRadius: '999px', background: aiConfig.bg, color: aiConfig.color,
          border: `1px solid ${aiConfig.color}25`,
          backdropFilter: 'blur(8px)',
          transition: 'bottom 200ms, opacity 200ms',
          opacity: isHovering ? 1 : 0.9,
        }}>
          {aiConfig.icon} {aiConfig.label}
        </div>

        {/* ── Performance Score Chip ── */}
        <div style={{
          position: 'absolute', bottom: isHovering ? '3.8rem' : '3.2rem', left: '0.45rem',
          fontSize: '0.5rem', fontWeight: 800, padding: '0.15rem 0.4rem',
          borderRadius: '999px',
          background: perfScore >= 50 ? 'rgba(34,197,94,0.2)' : perfScore >= 20 ? 'rgba(245,158,11,0.2)' : 'rgba(239,68,68,0.2)',
          color: perfScore >= 50 ? '#22c55e' : perfScore >= 20 ? '#f59e0b' : '#ef4444',
          backdropFilter: 'blur(8px)',
          transition: 'bottom 200ms, opacity 200ms',
          opacity: isHovering ? 1 : 0.75,
        }}>
          {perfScore}pts
        </div>

        {/* ── Hover Actions Overlay ── */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
          opacity: isHovering ? 1 : 0,
          transition: 'opacity 200ms',
          pointerEvents: isHovering ? 'auto' : 'none',
        }}>
          {[
            { label: 'עריכה', icon: '✎', onClick: () => onEdit(ad) },
            { label: 'מהיר', icon: '⚡', onClick: () => startInlineEdit('headline', ad.headline || ad.name) },
            { label: 'שפר AI', icon: '🧠', onClick: () => onCreateVariation(ad) },
            { label: 'שכפל', icon: '⧉', onClick: () => onDuplicate(ad) },
          ].map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={(e) => { e.stopPropagation(); action.onClick(); }}
              style={{
                padding: '0.45rem 0.55rem', fontSize: '0.65rem', fontWeight: 700,
                borderRadius: '0.4rem', border: 'none', cursor: 'pointer',
                background: 'rgba(255,255,255,0.15)', color: '#fff',
                backdropFilter: 'blur(8px)',
                transition: 'background 150ms, transform 150ms',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.28)'; e.currentTarget.style.transform = 'scale(1.08)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; e.currentTarget.style.transform = 'scale(1)'; }}
            >
              <span style={{ fontSize: '1rem' }}>{action.icon}</span>
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Info Section ──────────────────────── */}
      <div style={{ padding: '0.65rem 0.75rem 0.5rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        {/* Headline — inline editable */}
        {inlineField === 'headline' ? (
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            <input
              autoFocus
              value={inlineValue}
              onChange={(e) => setInlineValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') commitInlineEdit(); if (e.key === 'Escape') setInlineField(null); }}
              onBlur={commitInlineEdit}
              style={{
                flex: 1, fontSize: '0.8rem', fontWeight: 700, padding: '0.15rem 0.35rem',
                borderRadius: '0.25rem', border: '1px solid var(--accent)',
                background: 'var(--surface-sunken, var(--background))', color: 'var(--foreground)',
                fontFamily: 'inherit', outline: 'none',
              }}
            />
          </div>
        ) : (
          <h4
            style={{
              fontSize: '0.8rem', fontWeight: 700, color: 'var(--foreground)', margin: 0,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              letterSpacing: '-0.01em', cursor: 'text',
            }}
            onDoubleClick={() => startInlineEdit('headline', ad.headline || ad.name)}
            title="לחץ פעמיים לעריכה מהירה"
          >
            {ad.headline || ad.name}
          </h4>
        )}

        {ad.primaryText && inlineField !== 'primaryText' && (
          <p
            style={{
              fontSize: '0.66rem', color: 'var(--foreground-muted)', margin: 0,
              overflow: 'hidden', textOverflow: 'ellipsis',
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const,
              lineHeight: 1.45, cursor: 'text',
            }}
            onDoubleClick={() => startInlineEdit('primaryText', ad.primaryText)}
          >
            {ad.primaryText}
          </p>
        )}
        {inlineField === 'primaryText' && (
          <textarea
            autoFocus
            value={inlineValue}
            onChange={(e) => setInlineValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') setInlineField(null); }}
            onBlur={commitInlineEdit}
            style={{
              fontSize: '0.66rem', padding: '0.2rem 0.35rem', minHeight: '2.5rem',
              borderRadius: '0.25rem', border: '1px solid var(--accent)',
              background: 'var(--surface-sunken, var(--background))', color: 'var(--foreground)',
              fontFamily: 'inherit', resize: 'vertical' as const, outline: 'none',
            }}
          />
        )}

        {/* ── Mini Sparkline (timeline view) ── */}
        {isTimeline && (
          <div style={{ margin: '0.2rem 0', opacity: 0.7 }}>
            <svg width="100%" height="24" viewBox="0 0 100 24" preserveAspectRatio="none" style={{ display: 'block' }}>
              <path d={generateSparklinePath(ad, 100, 24)} fill="none" stroke={aiConfig.color} strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
        )}

        {/* ── AI Whisper (expandable) ── */}
        <div
          style={{
            marginTop: 'auto', paddingTop: '0.35rem',
            borderTop: '1px solid var(--border)',
            cursor: 'pointer',
          }}
          onClick={(e) => { e.stopPropagation(); setWhisperOpen(!whisperOpen); }}
        >
          <div style={{
            fontSize: '0.58rem', fontWeight: 600, color: whisperColor.color,
            display: 'flex', alignItems: 'center', gap: '0.25rem',
            padding: '0.15rem 0.3rem', borderRadius: '0.3rem',
            background: whisperOpen ? whisperColor.bg : 'transparent',
            transition: 'background 150ms',
          }}>
            <span style={{ fontSize: '0.65rem' }}>💡</span>
            <span style={{ flex: 1, lineHeight: 1.35 }}>
              {whisperOpen ? whisper.text : whisper.text.slice(0, 28) + (whisper.text.length > 28 ? '...' : '')}
            </span>
            <span style={{
              fontSize: '0.5rem', opacity: 0.6,
              transform: whisperOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 150ms',
            }}>▾</span>
          </div>
          {whisperOpen && (
            <div style={{
              fontSize: '0.55rem', color: 'var(--foreground-muted)', padding: '0.25rem 0.3rem 0.1rem',
              lineHeight: 1.4,
            }}>
              ציון ביצועים: <strong style={{ color: perfScore >= 50 ? '#22c55e' : perfScore >= 20 ? '#f59e0b' : '#ef4444' }}>{perfScore}/100</strong>
              {' · '}{aiConfig.icon} {aiConfig.label}
            </div>
          )}
        </div>

        {/* AI Optimization Note */}
        {aiNote && (
          <div style={{
            padding: '0.3rem 0.5rem', fontSize: '0.6rem',
            background: `${aiNote.color}08`, borderTop: `1px solid ${aiNote.color}20`,
            color: aiNote.color, fontWeight: 500,
            display: 'flex', alignItems: 'center', gap: '0.25rem',
          }}>
            {aiNote.icon} {aiNote.title}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Premium Empty State ────────────────────────────────────────────────

function AdGridEmptyState({ onAddAd }: { onAddAd: () => void }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '4rem 2rem', borderRadius: '1rem',
      background: 'linear-gradient(135deg, rgba(0,181,254,0.03), rgba(139,92,246,0.03))',
      border: '2px dashed var(--border)',
    }}>
      <div style={{
        width: '4.5rem', height: '4.5rem', borderRadius: '1rem',
        background: 'linear-gradient(135deg, rgba(0,181,254,0.1), rgba(139,92,246,0.1))',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: '1.25rem', fontSize: '2rem',
      }}>
        🎨
      </div>
      <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--foreground)', margin: 0, letterSpacing: '-0.02em' }}>
        צור את המודעה הראשונה
      </h3>
      <p style={{ fontSize: '0.82rem', color: 'var(--foreground-muted)', margin: '0.5rem 0 1.5rem', textAlign: 'center', maxWidth: '340px', lineHeight: 1.5 }}>
        הוסף מודעות עם תמונה, וידאו או קרוסלה — עקוב אחרי ביצועים בזמן אמת עם תובנות AI
      </p>
      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <button
          type="button"
          onClick={onAddAd}
          className="mod-btn-primary"
          style={{
            padding: '0.6rem 1.5rem', fontSize: '0.85rem', fontWeight: 700,
            borderRadius: '0.5rem', cursor: 'pointer',
            background: 'linear-gradient(135deg, var(--accent), #0092cc)',
            border: 'none', color: '#fff',
            boxShadow: '0 4px 12px rgba(0,181,254,0.3)',
            transition: 'transform 150ms, box-shadow 150ms',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,181,254,0.4)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,181,254,0.3)'; }}
        >
          + צור מודעה
        </button>
        <button
          type="button"
          onClick={onAddAd}
          style={{
            padding: '0.6rem 1.25rem', fontSize: '0.85rem', fontWeight: 600,
            borderRadius: '0.5rem', cursor: 'pointer',
            background: 'transparent', border: '1px solid var(--border)',
            color: 'var(--foreground-muted)', transition: 'all 150ms',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--foreground-muted)'; }}
        >
          🧠 צור וריאציה עם AI
        </button>
      </div>
    </div>
  );
}

// ── A/B Compare Panel ─────────────────────────────────────────────────

function ABComparePanel({ ads, onClose }: { ads: Ad[]; onClose: () => void }) {
  if (ads.length < 2) return null;
  const metrics = ['ctr', 'cpl', 'leads', 'spend', 'impressions', 'clicks'] as const;
  const metricLabels: Record<string, string> = {
    ctr: 'CTR', cpl: 'CPL', leads: 'לידים', spend: 'הוצאה', impressions: 'חשיפות', clicks: 'קליקים',
  };

  return (
    <div style={{
      ...cardStyle, padding: '1rem',
      border: '1px solid var(--accent)', borderRadius: '0.75rem',
      background: 'var(--surface-raised)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--foreground)', margin: 0 }}>
          ⚖ השוואת A/B — {ads.length} מודעות
        </h3>
        <button type="button" onClick={onClose} style={{
          background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem',
          color: 'var(--foreground-muted)', padding: '0.2rem 0.4rem',
        }}>✕</button>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'right', padding: '0.4rem 0.5rem', borderBottom: '1px solid var(--border)', color: 'var(--foreground-muted)', fontWeight: 600 }}>מדד</th>
              {ads.map((ad) => (
                <th key={ad.id} style={{ textAlign: 'center', padding: '0.4rem 0.5rem', borderBottom: '1px solid var(--border)', color: 'var(--foreground)', fontWeight: 700, maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {ad.headline || ad.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ padding: '0.35rem 0.5rem', fontWeight: 600, color: 'var(--foreground-muted)' }}>ציון AI</td>
              {ads.map((ad) => {
                const s = getAdPerformanceScore(ad);
                const best = Math.max(...ads.map(getAdPerformanceScore));
                return (
                  <td key={ad.id} style={{ textAlign: 'center', padding: '0.35rem', fontWeight: 800, color: s === best ? '#22c55e' : 'var(--foreground)' }}>
                    {s === best && ads.length > 1 ? `🏆 ${s}` : s}
                  </td>
                );
              })}
            </tr>
            {metrics.map((key) => {
              const vals = ads.map((ad) => ad[key] as number);
              const best = key === 'cpl' ? Math.min(...vals.filter((v) => v > 0)) : Math.max(...vals);
              return (
                <tr key={key} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '0.35rem 0.5rem', fontWeight: 600, color: 'var(--foreground-muted)' }}>{metricLabels[key]}</td>
                  {ads.map((ad) => {
                    const v = ad[key] as number;
                    const isBest = v === best && v > 0 && ads.filter((a) => (a[key] as number) === best).length === 1;
                    return (
                      <td key={ad.id} style={{
                        textAlign: 'center', padding: '0.35rem', fontWeight: 700,
                        color: isBest ? '#22c55e' : 'var(--foreground)',
                        background: isBest ? 'rgba(34,197,94,0.06)' : 'transparent',
                      }}>
                        {key === 'ctr' ? `${v.toFixed(1)}%` : key === 'cpl' || key === 'spend' ? `₪${v.toFixed(0)}` : v}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Filter Bar (Intelligence Edition) ─────────────────────────────────

function AdFilterBar({
  filter, onFilter, viewMode, onViewMode, adCount,
  sortMode, onSort, groupMode, onGroup, compareCount, onOpenCompare,
}: {
  filter: AdFilter; onFilter: (f: AdFilter) => void;
  viewMode: AdViewMode; onViewMode: (m: AdViewMode) => void;
  adCount: number;
  sortMode: AdSortMode; onSort: (s: AdSortMode) => void;
  groupMode: AdGroupMode; onGroup: (g: AdGroupMode) => void;
  compareCount: number; onOpenCompare: () => void;
}) {
  const filters: Array<{ value: AdFilter; label: string }> = [
    { value: 'all', label: 'הכל' },
    { value: 'best', label: '🏆 הטובים' },
    { value: 'worst', label: '📉 חלשים' },
    { value: 'active', label: 'פעילים' },
    { value: 'paused', label: 'מושהים' },
    { value: 'image', label: '🖼️ תמונה' },
    { value: 'video', label: '🎬 וידאו' },
    { value: 'ai_scale', label: '🚀 סקייל' },
    { value: 'ai_improve', label: '🔧 שיפור' },
  ];

  const viewModes: Array<{ value: AdViewMode; label: string; icon: string }> = [
    { value: 'grid', label: 'רשת', icon: '▦' },
    { value: 'compare', label: 'השוואה', icon: '⚖' },
    { value: 'heat', label: 'חום', icon: '🔥' },
    { value: 'timeline', label: 'ציר זמן', icon: '📈' },
  ];

  const sortOptions: Array<{ value: AdSortMode; label: string }> = [
    { value: 'default', label: 'ברירת מחדל' },
    { value: 'performance', label: '⭐ ביצועים' },
    { value: 'spend', label: '💰 הוצאה' },
    { value: 'leads', label: '👥 לידים' },
    { value: 'ctr', label: '📊 CTR' },
  ];

  const groupOptions: Array<{ value: AdGroupMode; label: string }> = [
    { value: 'none', label: 'ללא' },
    { value: 'tier', label: '🏅 רמה' },
    { value: 'creative', label: '🎨 סוג' },
    { value: 'status', label: '📋 סטטוס' },
  ];

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: '0.4rem',
      padding: '0.6rem 0.85rem', borderRadius: '0.75rem',
      background: 'var(--surface-raised)', border: '1px solid var(--border)',
    }}>
      {/* Row 1: Filters + Count + View modes */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', flex: 1 }}>
          {filters.map((f) => (
            <button key={f.value} type="button" onClick={() => onFilter(f.value)} style={pillBtn(filter === f.value)}>
              {f.label}
            </button>
          ))}
        </div>

        <span style={{ fontSize: '0.68rem', color: 'var(--foreground-muted)', fontWeight: 600 }}>
          {adCount} מודעות
        </span>

        <div style={{
          display: 'flex', gap: '0.15rem', padding: '0.15rem',
          borderRadius: '0.4rem', background: 'var(--surface-sunken, var(--background))',
          border: '1px solid var(--border)',
        }}>
          {viewModes.map((m) => (
            <button key={m.value} type="button" onClick={() => onViewMode(m.value)} style={{
              padding: '0.25rem 0.5rem', fontSize: '0.65rem', fontWeight: 600,
              borderRadius: '0.25rem', border: 'none', cursor: 'pointer',
              background: viewMode === m.value ? 'var(--accent)' : 'transparent',
              color: viewMode === m.value ? '#fff' : 'var(--foreground-muted)',
              transition: 'all 150ms', whiteSpace: 'nowrap' as const,
            }}>
              {m.icon} {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Row 2: Sort + Group + Compare CTA */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        {/* Sort */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <span style={{ fontSize: '0.6rem', color: 'var(--foreground-muted)', fontWeight: 600 }}>מיון:</span>
          {sortOptions.map((s) => (
            <button key={s.value} type="button" onClick={() => onSort(s.value)} style={{
              ...pillBtn(sortMode === s.value), fontSize: '0.6rem', padding: '0.2rem 0.45rem',
            }}>
              {s.label}
            </button>
          ))}
        </div>

        {/* Group */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <span style={{ fontSize: '0.6rem', color: 'var(--foreground-muted)', fontWeight: 600 }}>קבץ:</span>
          {groupOptions.map((g) => (
            <button key={g.value} type="button" onClick={() => onGroup(g.value)} style={{
              ...pillBtn(groupMode === g.value), fontSize: '0.6rem', padding: '0.2rem 0.45rem',
            }}>
              {g.label}
            </button>
          ))}
        </div>

        {/* Compare CTA */}
        {compareCount >= 2 && (
          <button type="button" onClick={onOpenCompare} style={{
            padding: '0.25rem 0.6rem', fontSize: '0.65rem', fontWeight: 700,
            borderRadius: '999px', border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg, var(--accent), #0092cc)', color: '#fff',
            boxShadow: '0 2px 8px rgba(0,181,254,0.3)',
            animation: 'pulse-subtle 2s infinite',
          }}>
            ⚖ השווה {compareCount} מודעות
          </button>
        )}
      </div>
    </div>
  );
}

// ── Ad Set Section Component ───────────────────────────────────────────

function AdSetSection({
  adSet,
  adsForSet,
  onEditAd,
  onEditAdSet,
  onAddAd,
  onDuplicate,
  onCreateVariation,
  onInlineEdit,
  viewMode,
  sortMode,
  groupMode,
  selectedAdIds,
  onToggleSelect,
  recBadge,
  adNotes,
}: {
  adSet: AdSet;
  adsForSet: Ad[];
  onEditAd: (ad: Ad) => void;
  onEditAdSet: (adSet: AdSet) => void;
  onAddAd: (adSetId: string) => void;
  onDuplicate: (ad: Ad) => void;
  onCreateVariation: (ad: Ad) => void;
  onInlineEdit: (ad: Ad, field: string, value: string) => void;
  viewMode: AdViewMode;
  sortMode: AdSortMode;
  groupMode: AdGroupMode;
  selectedAdIds: Set<string>;
  onToggleSelect: (ad: Ad) => void;
  recBadge?: { title: string; icon: string; color: string } | null;
  adNotes?: Record<string, { title: string; icon: string; color: string }>;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const statusColor = STATUS_COLORS[adSet.status] || '#6b7280';

  // Winner detection for this set
  const winnerId = useMemo(() => findWinnerAd(adsForSet), [adsForSet]);

  // Apply sorting
  const sortedAds = useMemo(() => {
    const ads = [...adsForSet];
    switch (sortMode) {
      case 'performance': return sortAdsByPerformance(ads);
      case 'spend': return ads.sort((a, b) => b.spend - a.spend);
      case 'leads': return ads.sort((a, b) => b.leads - a.leads);
      case 'ctr': return ads.sort((a, b) => b.ctr - a.ctr);
      default: return ads;
    }
  }, [adsForSet, sortMode]);

  // Apply grouping
  const groupedAds = useMemo(() => {
    if (groupMode === 'none') return null;
    if (groupMode === 'tier') return groupAdsByTier(sortedAds);
    if (groupMode === 'creative') {
      const map: Record<string, Ad[]> = {};
      for (const ad of sortedAds) {
        const key = ad.creativeType;
        (map[key] = map[key] || []).push(ad);
      }
      return Object.entries(map).map(([key, ads]) => ({
        tier: `${CREATIVE_TYPE_ICONS[key as AdCreativeType]} ${CREATIVE_TYPE_LABELS[key as AdCreativeType]}`,
        color: 'var(--accent)',
        ads,
      }));
    }
    if (groupMode === 'status') {
      const map: Record<string, Ad[]> = {};
      for (const ad of sortedAds) {
        (map[ad.status] = map[ad.status] || []).push(ad);
      }
      return Object.entries(map).map(([key, ads]) => ({
        tier: STATUS_LABELS[key] || key,
        color: STATUS_COLORS[key] || '#6b7280',
        ads,
      }));
    }
    return null;
  }, [sortedAds, groupMode]);

  const totals = useMemo(() => {
    return adsForSet.reduce((acc, ad) => ({
      impressions: acc.impressions + (ad.impressions || 0),
      clicks: acc.clicks + (ad.clicks || 0),
      spend: acc.spend + (ad.spend || 0),
      leads: acc.leads + (ad.leads || 0),
      conversions: acc.conversions + (ad.conversions || 0),
    }), { impressions: 0, clicks: 0, spend: 0, leads: 0, conversions: 0 });
  }, [adsForSet]);

  const avgCtr = totals.impressions > 0 ? (totals.clicks / totals.impressions * 100) : 0;
  const avgCpl = totals.leads > 0 ? (totals.spend / totals.leads) : 0;

  // Performance indicator: good / warning / poor
  const adSetPerf = useMemo(() => {
    if (totals.impressions === 0 && totals.spend === 0) return null; // no data yet
    let score = 0;
    if (avgCtr >= 2) score += 2; else if (avgCtr >= 1) score += 1;
    if (totals.leads >= 3) score += 2; else if (totals.leads >= 1) score += 1;
    if (avgCpl > 0 && avgCpl < 50) score += 2; else if (avgCpl > 0 && avgCpl < 100) score += 1;
    if (score >= 5) return { label: 'ביצועים טובים', color: '#22c55e', icon: '✓' };
    if (score >= 3) return { label: 'ביצועים בינוניים', color: '#f59e0b', icon: '~' };
    return { label: 'ביצועים חלשים', color: '#ef4444', icon: '!' };
  }, [avgCtr, avgCpl, totals]);

  return (
    <div style={{ ...cardStyle, borderRight: `3px solid ${statusColor}` }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: '0.75rem', marginBottom: collapsed ? 0 : '1rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem',
              color: 'var(--foreground-muted)', padding: '0.25rem', transition: 'transform 150ms',
              transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
            }}
          >
            ▼
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <h3 style={{
                fontSize: '0.95rem', fontWeight: 700, color: 'var(--foreground)', margin: 0,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {adSet.name}
              </h3>
              <span style={badgeStyle(statusColor, statusColor)}>
                {STATUS_LABELS[adSet.status] || adSet.status}
              </span>
              <span style={{
                fontSize: '0.65rem', fontWeight: 600, color: 'var(--foreground-muted)',
                background: 'var(--surface-raised)', padding: '0.15rem 0.4rem',
                borderRadius: '0.2rem', border: '1px solid var(--border)',
              }}>
                {adsForSet.length} מודעות
              </span>
              {adSetPerf && (
                <span style={{
                  fontSize: '0.6rem', fontWeight: 700, padding: '0.15rem 0.45rem',
                  borderRadius: '999px', background: `${adSetPerf.color}14`,
                  color: adSetPerf.color, border: `1px solid ${adSetPerf.color}30`,
                }}>
                  {adSetPerf.icon} {adSetPerf.label}
                </span>
              )}
              {recBadge && (
                <span style={{
                  fontSize: '0.58rem', fontWeight: 600, padding: '0.12rem 0.4rem',
                  borderRadius: '999px', background: `${recBadge.color}12`,
                  color: recBadge.color, display: 'flex', alignItems: 'center', gap: '0.15rem',
                }}>
                  {recBadge.icon} {recBadge.title}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.35rem' }}>
              {adSet.geoLocations.length > 0 && (
                <span style={{ fontSize: '0.65rem', color: 'var(--foreground-muted)' }}>
                  📍 {adSet.geoLocations.slice(0, 3).join(', ')}
                  {adSet.geoLocations.length > 3 && ` +${adSet.geoLocations.length - 3}`}
                </span>
              )}
              {adSet.interests.length > 0 && (
                <span style={{ fontSize: '0.65rem', color: 'var(--foreground-muted)' }}>
                  🎯 {adSet.interests.slice(0, 2).join(', ')}
                  {adSet.interests.length > 2 && ` +${adSet.interests.length - 2}`}
                </span>
              )}
              {adSet.dailyBudget && (
                <span style={{ fontSize: '0.65rem', color: 'var(--foreground-muted)' }}>
                  💰 ₪{adSet.dailyBudget}/יום
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Metrics */}
        <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center', flexShrink: 0 }}>
          <div style={metricStyle}>
            <div style={metricValueStyle}>{totals.impressions > 0 ? `${(totals.impressions / 1000).toFixed(1)}K` : '—'}</div>
            <div style={metricLabelStyle}>חשיפות</div>
          </div>
          <div style={metricStyle}>
            <div style={metricValueStyle}>{avgCtr > 0 ? `${avgCtr.toFixed(1)}%` : '—'}</div>
            <div style={metricLabelStyle}>CTR</div>
          </div>
          <div style={metricStyle}>
            <div style={metricValueStyle}>{avgCpl > 0 ? `₪${avgCpl.toFixed(0)}` : '—'}</div>
            <div style={metricLabelStyle}>CPL</div>
          </div>
          <div style={metricStyle}>
            <div style={metricValueStyle}>{totals.leads > 0 ? totals.leads : '—'}</div>
            <div style={metricLabelStyle}>לידים</div>
          </div>
          <div style={metricStyle}>
            <div style={metricValueStyle}>{totals.spend > 0 ? `₪${totals.spend.toFixed(0)}` : '—'}</div>
            <div style={metricLabelStyle}>הוצאה</div>
          </div>
          <button
            type="button"
            onClick={() => onEditAdSet(adSet)}
            style={{
              padding: '0.3rem 0.5rem', fontSize: '0.68rem', fontWeight: 600,
              borderRadius: '0.3rem', cursor: 'pointer', background: 'transparent',
              border: '1px solid var(--border)', color: 'var(--foreground-muted)',
            }}
          >
            ✎
          </button>
        </div>
      </div>

      {/* Ads Grid */}
      {!collapsed && (
        adsForSet.length === 0 ? (
          <AdGridEmptyState onAddAd={() => onAddAd(adSet.id)} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {(groupedAds || [{ tier: '', color: '', ads: sortedAds }]).map((group) => (
              <div key={group.tier || '_all'}>
                {/* Group header */}
                {group.tier && groupMode !== 'none' && (
                  <div style={{
                    fontSize: '0.72rem', fontWeight: 700, color: group.color,
                    marginBottom: '0.5rem', padding: '0.2rem 0.5rem',
                    borderRight: `3px solid ${group.color}`, background: `${group.color}08`,
                    borderRadius: '0 0.3rem 0.3rem 0',
                  }}>
                    {group.tier} ({group.ads.length})
                  </div>
                )}
                <div style={{
                  display: viewMode === 'compare' ? 'flex' : 'grid',
                  gridTemplateColumns: viewMode !== 'compare' ? 'repeat(auto-fill, minmax(240px, 1fr))' : undefined,
                  gap: '1rem',
                  overflowX: viewMode === 'compare' ? 'auto' : undefined,
                }}>
                  {group.ads.map((ad) => (
                    <div key={ad.id} style={viewMode === 'compare' ? { minWidth: '280px', flex: '0 0 280px' } : undefined}>
                      <AdCard
                        ad={ad}
                        onEdit={onEditAd}
                        onDuplicate={onDuplicate}
                        onCreateVariation={onCreateVariation}
                        onInlineEdit={onInlineEdit}
                        viewMode={viewMode}
                        isWinner={ad.id === winnerId}
                        isSelected={selectedAdIds.has(ad.id)}
                        onToggleSelect={onToggleSelect}
                        aiNote={adNotes?.[ad.id] || null}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() => onAddAd(adSet.id)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                minHeight: '180px', borderRadius: '0.75rem', cursor: 'pointer',
                border: '2px dashed var(--border)', background: 'transparent',
                color: 'var(--foreground-muted)', transition: 'all 200ms', gap: '0.5rem',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent)';
                e.currentTarget.style.color = 'var(--accent)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.color = 'var(--foreground-muted)';
              }}
            >
              <span style={{ fontSize: '1.5rem' }}>+</span>
              <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>הוסף מודעה</span>
            </button>
          </div>
        )
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────

export default function CampaignDetailPage() {
  const params = useParams();
  const campaignId = params.id as string;

  const { data: campaigns, update: updateCampaign, create: createCampaign } = useCampaigns();
  const { data: allAdSets, create: createAdSet, update: updateAdSet } = useAdSets();
  const { data: allAds, create: createAd, update: updateAd } = useAds();
  const { data: clients } = useClients();
  const { data: allLeads } = useLeads();
  const toast = useToast();

  const campaign = useMemo(() => {
    return (campaigns || []).find((c) => c.id === campaignId) || null;
  }, [campaigns, campaignId]);

  const campaignAdSets = useMemo(() => {
    return (allAdSets || [])
      .filter((s) => s.campaignId === campaignId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [allAdSets, campaignId]);

  const campaignAds = useMemo(() => {
    return (allAds || []).filter((a) => a.campaignId === campaignId);
  }, [allAds, campaignId]);

  const adsByAdSet = useMemo(() => {
    const map: Record<string, Ad[]> = {};
    for (const adSet of campaignAdSets) {
      map[adSet.id] = campaignAds.filter((a) => a.adSetId === adSet.id);
    }
    return map;
  }, [campaignAdSets, campaignAds]);

  const totalMetrics = useMemo(() => {
    return campaignAds.reduce((acc, ad) => ({
      impressions: acc.impressions + (ad.impressions || 0),
      clicks: acc.clicks + (ad.clicks || 0),
      spend: acc.spend + (ad.spend || 0),
      leads: acc.leads + (ad.leads || 0),
      conversions: acc.conversions + (ad.conversions || 0),
    }), { impressions: 0, clicks: 0, spend: 0, leads: 0, conversions: 0 });
  }, [campaignAds]);

  const leadInsights = useMemo(() => {
    if (!campaign || !allLeads) return null;
    const insights = buildCampaignLeadInsights(allLeads || [], [campaign]);
    return insights.find(i => i.campaignId === campaign.id) || null;
  }, [campaign, allLeads]);

  // ── Attribution: leads linked to this campaign ──────────────────────

  /** Real leads that have campaignId matching + mock-attributed leads for ads that report leads */
  const campaignLeads = useMemo(() => {
    const real = (allLeads || []).filter(l => l.campaignId === campaignId);
    // If real leads exist and already have adSetId/adId, use them directly
    if (real.length > 0 && real.some(l => l.adSetId || l.adId)) return real;
    // Otherwise, generate mock-attributed leads from ad metrics (MVP)
    if (campaignAds.length === 0 || campaignAdSets.length === 0) return real;
    const mockLeads: Lead[] = [];
    const names = ['יוסי כהן', 'רונית לוי', 'אבי מזרחי', 'דנה שרון', 'עומר גולן',
      'מיכל אברהם', 'אורי דוד', 'נועה ביטון', 'איתי פרץ', 'שירה חדד',
      'תמר רוזנברג', 'גיא סלומון', 'הילה ברק', 'רועי ניסים', 'ליאור קפלן',
      'עדי פריד', 'שגיא טל', 'מאיה רון', 'אלון הרשקו', 'רוני עמר'];
    const sources = ['Facebook', 'Instagram', 'Google', 'TikTok', 'אורגני'];
    const statuses: Lead['status'][] = ['new', 'contacted', 'interested', 'proposal_sent', 'won', 'lost'];
    let mockIdx = 0;
    for (const ad of campaignAds) {
      if (ad.leads <= 0) continue;
      const adSet = campaignAdSets.find(s => s.id === ad.adSetId);
      const leadCount = Math.min(ad.leads, 5); // cap mock leads per ad for readability
      for (let i = 0; i < leadCount; i++) {
        const seed = (ad.id || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0) + i;
        const dayOffset = Math.floor(Math.abs(Math.sin(seed * 3.7) * 14));
        const date = new Date();
        date.setDate(date.getDate() - dayOffset);
        mockLeads.push({
          id: `mock_lead_${campaignId}_${mockIdx}`,
          fullName: names[mockIdx % names.length],
          name: names[mockIdx % names.length],
          email: `lead${mockIdx}@example.com`,
          phone: `05${Math.floor(10000000 + Math.abs(Math.sin(seed * 7.1)) * 89999999)}`,
          source: sources[Math.floor(Math.abs(Math.sin(seed * 2.3)) * sources.length)],
          interestType: 'marketing' as Lead['interestType'],
          proposalSent: false,
          proposalAmount: 0,
          status: statuses[Math.floor(Math.abs(Math.sin(seed * 5.1)) * statuses.length)],
          followupDone: false,
          notes: '',
          company: '',
          value: 0,
          assigneeId: null,
          followUpAt: null,
          convertedAt: null,
          convertedClientId: null,
          convertedEntityType: null,
          convertedEntityId: null,
          campaignId: campaignId,
          campaignName: campaign?.campaignName || '',
          adAccountId: '',
          adSetId: ad.adSetId,
          adId: ad.id,
          adSetName: adSet?.name || '',
          adName: ad.name,
          clientId: campaign?.clientId || null,
          createdAt: date.toISOString(),
          updatedAt: date.toISOString(),
        });
        mockIdx++;
      }
    }
    return mockLeads.length > 0 ? mockLeads : real;
  }, [allLeads, campaignId, campaignAds, campaignAdSets, campaign]);

  /** Attribution: leads per ad set */
  const leadsPerAdSet = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of campaignAdSets) map[s.id] = 0;
    for (const l of campaignLeads) {
      if (l.adSetId && map[l.adSetId] !== undefined) map[l.adSetId]++;
    }
    return map;
  }, [campaignLeads, campaignAdSets]);

  /** Attribution: leads per ad */
  const leadsPerAd = useMemo(() => {
    const map: Record<string, number> = {};
    for (const a of campaignAds) map[a.id] = 0;
    for (const l of campaignLeads) {
      if (l.adId && map[l.adId] !== undefined) map[l.adId]++;
    }
    return map;
  }, [campaignLeads, campaignAds]);

  // ── Lead detail modal ───────────────────────────────────────────────

  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  // ── Lead filters ───────────────────────────────────────────────────
  const [leadFilterAdSet, setLeadFilterAdSet] = useState<string>('all');
  const [leadFilterAd, setLeadFilterAd] = useState<string>('all');
  const [leadFilterStatus, setLeadFilterStatus] = useState<string>('all');

  const filteredLeads = useMemo(() => {
    let result = campaignLeads;
    if (leadFilterAdSet !== 'all') result = result.filter(l => l.adSetId === leadFilterAdSet);
    if (leadFilterAd !== 'all') result = result.filter(l => l.adId === leadFilterAd);
    if (leadFilterStatus !== 'all') result = result.filter(l => l.status === leadFilterStatus);
    return result;
  }, [campaignLeads, leadFilterAdSet, leadFilterAd, leadFilterStatus]);

  // ── Filter, Sort, Group, View Mode, Compare ─────────────────────────

  const [adFilter, setAdFilter] = useState<AdFilter>('all');
  const [adViewMode, setAdViewMode] = useState<AdViewMode>('grid');
  const [adSortMode, setAdSortMode] = useState<AdSortMode>('default');
  const [adGroupMode, setAdGroupMode] = useState<AdGroupMode>('none');
  const [selectedAdIds, setSelectedAdIds] = useState<Set<string>>(new Set());
  const [showComparePanel, setShowComparePanel] = useState(false);
  const [selectedAdSetFilter, setSelectedAdSetFilter] = useState<string>('all');

  const filteredAdsByAdSet = useMemo(() => {
    const map: Record<string, Ad[]> = {};
    for (const adSet of campaignAdSets) {
      const setAds = adsByAdSet[adSet.id] || [];
      const filtered = setAds.filter((ad) => {
        switch (adFilter) {
          case 'all': return true;
          case 'best': return getAdAIStatus(ad) === 'scale';
          case 'worst': return getAdAIStatus(ad) === 'improve';
          case 'active': return ad.status === 'active';
          case 'paused': return ad.status === 'paused';
          case 'image': return ad.creativeType === 'image';
          case 'video': return ad.creativeType === 'video';
          case 'ai_scale': return getAdAIStatus(ad) === 'scale';
          case 'ai_fatigued': return getAdAIStatus(ad) === 'fatigued';
          case 'ai_improve': return getAdAIStatus(ad) === 'improve';
          default: return true;
        }
      });
      map[adSet.id] = filtered;
    }
    return map;
  }, [campaignAdSets, adsByAdSet, adFilter]);

  const filteredAdCount = useMemo(() => {
    return Object.values(filteredAdsByAdSet).reduce((sum, arr) => sum + arr.length, 0);
  }, [filteredAdsByAdSet]);

  const selectedAdsForCompare = useMemo(() => {
    return campaignAds.filter((ad) => selectedAdIds.has(ad.id));
  }, [campaignAds, selectedAdIds]);

  const handleToggleSelect = useCallback((ad: Ad) => {
    setSelectedAdIds((prev) => {
      const next = new Set(prev);
      if (next.has(ad.id)) next.delete(ad.id);
      else next.add(ad.id);
      return next;
    });
  }, []);

  // ── Duplicate & Variation handlers ────────────────────────────────

  const handleDuplicate = useCallback(async (ad: Ad) => {
    try {
      await createAd({
        adSetId: ad.adSetId,
        campaignId: ad.campaignId,
        name: `${ad.name} (עותק)`,
        status: 'draft' as AdStatus,
        creativeType: ad.creativeType,
        mediaUrl: ad.mediaUrl,
        thumbnailUrl: ad.thumbnailUrl,
        primaryText: ad.primaryText,
        headline: ad.headline,
        description: ad.description,
        ctaType: ad.ctaType,
        ctaLink: ad.ctaLink,
        linkedVideoProjectId: ad.linkedVideoProjectId,
        linkedClientFileId: ad.linkedClientFileId,
        impressions: 0, clicks: 0, spend: 0, leads: 0, conversions: 0,
        ctr: 0, cpl: 0, cpc: 0, roas: 0,
        notes: ad.notes,
      });
      toast('מודעה שוכפלה בהצלחה', 'success');
    } catch { toast('שגיאה בשכפול', 'error'); }
  }, [createAd, toast]);

  const handleCreateVariation = useCallback(async (ad: Ad) => {
    try {
      await createAd({
        adSetId: ad.adSetId,
        campaignId: ad.campaignId,
        name: `${ad.name} (וריאציה AI)`,
        status: 'draft' as AdStatus,
        creativeType: ad.creativeType,
        mediaUrl: ad.mediaUrl,
        thumbnailUrl: ad.thumbnailUrl,
        primaryText: ad.primaryText ? `${ad.primaryText} ✨` : '',
        headline: ad.headline ? `${ad.headline} — גרסה חדשה` : '',
        description: ad.description,
        ctaType: ad.ctaType,
        ctaLink: ad.ctaLink,
        linkedVideoProjectId: ad.linkedVideoProjectId,
        linkedClientFileId: ad.linkedClientFileId,
        impressions: 0, clicks: 0, spend: 0, leads: 0, conversions: 0,
        ctr: 0, cpl: 0, cpc: 0, roas: 0,
        notes: `וריאציה של מודעה: ${ad.id}`,
      });
      toast('וריאציה נוצרה — ערוך את הקריאייטיב', 'success');
    } catch { toast('שגיאה ביצירת וריאציה', 'error'); }
  }, [createAd, toast]);

  const handleInlineEdit = useCallback(async (ad: Ad, field: string, value: string) => {
    try {
      await updateAd(ad.id, { [field]: value });
      toast('עודכן בהצלחה', 'success');
    } catch { toast('שגיאה בעדכון', 'error'); }
  }, [updateAd, toast]);

  // ── Campaign Actions ────────────────────────────────────────────────

  const handlePauseResume = useCallback(async () => {
    if (!campaign) return;
    const newStatus = campaign.status === 'active' ? 'paused' : 'active';
    try {
      await updateCampaign(campaign.id, { status: newStatus });
      toast(newStatus === 'paused' ? 'הקמפיין הושהה' : 'הקמפיין הופעל', 'success');
    } catch { toast('שגיאה בעדכון סטטוס', 'error'); }
  }, [campaign, updateCampaign, toast]);

  const handleDuplicateCampaign = useCallback(async () => {
    if (!campaign) return;
    try {
      await createCampaign({
        clientId: campaign.clientId,
        clientName: campaign.clientName,
        campaignName: `${campaign.campaignName} (העתק)`,
        campaignType: campaign.campaignType,
        objective: campaign.objective,
        platform: campaign.platform,
        status: 'draft',
        startDate: campaign.startDate,
        endDate: campaign.endDate,
        budget: campaign.budget,
        caption: '', mediaType: campaign.mediaType,
        linkedVideoProjectId: null, linkedClientFileId: null,
        externalMediaUrl: '', notes: '',
        adAccountId: campaign.adAccountId,
        leadFormIds: campaign.leadFormIds,
      });
      toast('קמפיין שוכפל — טיוטה חדשה נוצרה', 'success');
    } catch { toast('שגיאה בשכפול', 'error'); }
  }, [campaign, createCampaign, toast]);

  const [showEditCampaignModal, setShowEditCampaignModal] = useState(false);
  const [editCampaignForm, setEditCampaignForm] = useState({ name: '', objective: '', budget: '' });

  const handleOpenEditCampaign = useCallback(() => {
    if (!campaign) return;
    setEditCampaignForm({
      name: campaign.campaignName,
      objective: campaign.objective || '',
      budget: campaign.budget ? String(campaign.budget) : '',
    });
    setShowEditCampaignModal(true);
  }, [campaign]);

  const handleSubmitEditCampaign = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campaign) return;
    try {
      await updateCampaign(campaign.id, {
        campaignName: editCampaignForm.name,
        objective: editCampaignForm.objective,
        budget: editCampaignForm.budget ? parseFloat(editCampaignForm.budget) : 0,
      });
      toast('קמפיין עודכן', 'success');
      setShowEditCampaignModal(false);
    } catch { toast('שגיאה בעדכון', 'error'); }
  }, [campaign, editCampaignForm, updateCampaign, toast]);

  const handleAIImprove = useCallback(() => {
    toast('🧠 ניתוח AI בקרוב — הפיצ\'ר בפיתוח', 'info');
  }, [toast]);

  // ── Publish to Meta ──────────────────────────────────────────────────

  const [publishLoading, setPublishLoading] = useState(false);
  const [publishResult, setPublishResult] = useState<{
    show: boolean;
    success: boolean;
    message: string;
    results: Array<{ step: string; entity: string; success: boolean; metaId?: string; error?: string; skipped?: boolean }>;
  } | null>(null);

  const handlePublishToMeta = useCallback(async () => {
    if (!campaign) return;
    if (publishLoading) return;

    // Safety: prevent double-publish
    if (campaign.metaCampaignId && campaign.status === 'active') {
      toast('הקמפיין כבר פורסם למטא', 'info');
      return;
    }

    // Validate: must have ad sets
    if (campaignAdSets.length === 0) {
      toast('יש להוסיף קבוצת מודעות לפחות אחת לפני פרסום', 'error');
      return;
    }

    // Validate: must have ads
    if (campaignAds.length === 0) {
      toast('יש להוסיף מודעה לפחות אחת לפני פרסום', 'error');
      return;
    }

    setPublishLoading(true);
    try {
      const res = await fetch('/api/data/meta-publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId: campaign.id }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast(data.error || 'שגיאה בפרסום למטא', 'error');
        setPublishLoading(false);
        return;
      }

      setPublishResult({
        show: true,
        success: data.success,
        message: data.message,
        results: data.results || [],
      });

      if (data.success) {
        toast('הקמפיין פורסם בהצלחה למטא!', 'success');
      } else {
        toast(data.message || 'פרסום חלקי — בדוק את הפרטים', 'error');
      }
    } catch {
      toast('שגיאה בחיבור לשרת', 'error');
    }
    setPublishLoading(false);
  }, [campaign, publishLoading, campaignAdSets, campaignAds, toast]);

  // ── Report Generation ────────────────────────────────────────────────

  const [reportGenerating, setReportGenerating] = useState(false);

  const handleGenerateReport = useCallback(async () => {
    if (!campaign || reportGenerating) return;
    setReportGenerating(true);
    try {
      const now = new Date();
      const periodEnd = now.toISOString().split('T')[0];
      const periodStart = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()).toISOString().split('T')[0];

      const clientObj = clients?.find(c => c.id === campaign.clientId);

      const res = await fetch('/api/data/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'campaign',
          mode: 'client_facing',
          clientId: campaign.clientId,
          clientName: clientObj?.name || campaign.clientName || '',
          campaignId: campaign.id,
          campaignName: campaign.campaignName,
          periodStart,
          periodEnd,
        }),
      });
      const data = await res.json();
      if (res.ok && data.report) {
        toast('הדוח הופק בהצלחה!', 'success');
        // Open preview in new tab
        window.open(`/api/data/reports/${data.report.id}?format=html`, '_blank');
      } else {
        toast(data.error || 'שגיאה בהפקת דוח', 'error');
      }
    } catch {
      toast('שגיאה בחיבור לשרת', 'error');
    }
    setReportGenerating(false);
  }, [campaign, clients, reportGenerating, toast]);

  // ── AI Content → Ads Generation ────────────────────────────────────

  const [aiAdsGenerating, setAiAdsGenerating] = useState(false);

  const handleGenerateAiAds = useCallback(async () => {
    if (!campaign || aiAdsGenerating) return;
    const firstAdSet = (allAdSets || []).find((as: any) => as.campaignId === campaign.id);
    if (!firstAdSet) { toast('אין קבוצת מודעות — צור קבוצה קודם', 'error'); return; }

    setAiAdsGenerating(true);
    try {
      const clientObj = (clients as any[])?.find((c: any) => c.id === campaign.clientId);
      const res = await fetch('/api/data/content-to-ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: {
            type: 'manual',
            title: campaign.name || campaign.campaignName || 'קמפיין',
            description: (campaign as any).objective || campaign.name || '',
            businessField: clientObj?.businessField || '',
            clientName: clientObj?.name || '',
          },
          campaignId: campaign.id,
          adSetId: firstAdSet.id,
          save: true,
        }),
      });
      const data = await res.json();
      if (res.ok && data.saved > 0) {
        toast(`נוצרו ${data.saved} מודעות AI כטיוטה`, 'success');
      } else {
        toast(data.error || 'שגיאה ביצירת מודעות', 'error');
      }
    } catch {
      toast('שגיאה בחיבור לשרת', 'error');
    }
    setAiAdsGenerating(false);
  }, [campaign, allAdSets, clients, aiAdsGenerating, toast]);

  // ── Auto Engine State ──────────────────────────────────────────────

  const [autoFindings, setAutoFindings] = useState<Array<{
    id: string; type: string; severity: string; confidence: number;
    reason: string; expectedImpact: string; adName: string | null;
    adSetName: string | null; suggestedAction: string;
  }>>([]);
  const [autoScanning, setAutoScanning] = useState(false);

  const handleAutoScan = useCallback(async () => {
    if (!campaign || autoScanning) return;
    setAutoScanning(true);
    try {
      const res = await fetch('/api/data/auto-campaign/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId: campaign.id, triggeredBy: 'manual' }),
      });
      const data = await res.json();
      setAutoFindings(data.findings || []);
      toast(data.summary || 'סריקה הושלמה', data.findings?.length > 0 ? 'info' : 'success');
    } catch {
      toast('שגיאה בסריקה אוטומטית', 'error');
    }
    setAutoScanning(false);
  }, [campaign, autoScanning, toast]);

  // Load findings on mount
  useEffect(() => {
    if (!campaign) return;
    fetch(`/api/data/auto-campaign/findings?campaignId=${campaign.id}&limit=10`)
      .then(r => r.ok ? r.json() : { findings: [] })
      .then(d => setAutoFindings(d.findings || []))
      .catch(() => {});
  }, [campaign]);

  // ── Mock Trend Data (deterministic from campaign metrics) ────────────

  const trendData = useMemo(() => {
    if (!campaign) return [];
    const days = 7;
    const base = totalMetrics.leads > 0 ? totalMetrics.leads : 3;
    const spendBase = totalMetrics.spend > 0 ? totalMetrics.spend : 150;
    const seed = (campaign.id || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    return Array.from({ length: days }, (_, i) => {
      const noise = Math.sin(seed + i * 7.3) * 0.35 + 0.65;
      return {
        day: ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'][i],
        leads: Math.max(0, Math.round(base / days * noise * 2.5)),
        spend: Math.round(spendBase / days * noise * 2),
      };
    });
  }, [campaign, totalMetrics]);

  // ── Filtered Ad Sets (by selectedAdSetFilter) ──────────────────────

  const visibleAdSets = useMemo(() => {
    if (selectedAdSetFilter === 'all') return campaignAdSets;
    return campaignAdSets.filter(s => s.id === selectedAdSetFilter);
  }, [campaignAdSets, selectedAdSetFilter]);

  // ── Modals ──────────────────────────────────────────────────────────

  const [adSetModalOpen, setAdSetModalOpen] = useState(false);
  const [editingAdSet, setEditingAdSet] = useState<AdSet | null>(null);
  const [adSetForm, setAdSetForm] = useState({
    name: '', status: 'draft' as AdSetStatus,
    geoLocations: '', interests: '', dailyBudget: '',
    placements: 'feed',
  });

  const [adModalOpen, setAdModalOpen] = useState(false);
  const [editingAd, setEditingAd] = useState<Ad | null>(null);
  const [adModalAdSetId, setAdModalAdSetId] = useState<string>('');
  const [adForm, setAdForm] = useState({
    name: '', creativeType: 'image' as AdCreativeType, status: 'draft' as AdStatus,
    mediaUrl: '', primaryText: '', headline: '', description: '',
    ctaType: 'LEARN_MORE', ctaLink: '',
  });

  const handleOpenAdSetModal = useCallback((adSet?: AdSet) => {
    if (adSet) {
      setEditingAdSet(adSet);
      setAdSetForm({
        name: adSet.name, status: adSet.status,
        geoLocations: adSet.geoLocations.join(', '),
        interests: adSet.interests.join(', '),
        dailyBudget: adSet.dailyBudget ? String(adSet.dailyBudget) : '',
        placements: adSet.placements.join(', ') || 'feed',
      });
    } else {
      setEditingAdSet(null);
      setAdSetForm({ name: '', status: 'draft', geoLocations: '', interests: '', dailyBudget: '', placements: 'feed' });
    }
    setAdSetModalOpen(true);
  }, []);

  const handleSubmitAdSet = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adSetForm.name.trim()) { toast('נא להכניס שם לקבוצת מודעות', 'error'); return; }
    try {
      const payload = {
        campaignId,
        name: adSetForm.name,
        status: adSetForm.status,
        ageMin: null, ageMax: null,
        genders: ['all' as const],
        geoLocations: adSetForm.geoLocations.split(',').map((s) => s.trim()).filter(Boolean),
        interests: adSetForm.interests.split(',').map((s) => s.trim()).filter(Boolean),
        customAudiences: [] as string[], excludedAudiences: [] as string[],
        placements: adSetForm.placements.split(',').map((s) => s.trim()).filter(Boolean),
        dailyBudget: adSetForm.dailyBudget ? parseFloat(adSetForm.dailyBudget) : null,
        lifetimeBudget: null,
        startDate: campaign?.startDate || null,
        endDate: campaign?.endDate || null,
        bidStrategy: null, bidAmount: null,
        notes: '',
      };
      if (editingAdSet) {
        await updateAdSet(editingAdSet.id, payload);
        toast('קבוצת מודעות עודכנה', 'success');
      } else {
        await createAdSet(payload);
        toast('קבוצת מודעות נוצרה', 'success');
      }
      setAdSetModalOpen(false);
    } catch { toast('שגיאה בשמירת קבוצת מודעות', 'error'); }
  }, [adSetForm, campaignId, campaign, editingAdSet, createAdSet, updateAdSet, toast]);

  const handleOpenAdModal = useCallback((adSetId: string, ad?: Ad) => {
    setAdModalAdSetId(adSetId);
    if (ad) {
      setEditingAd(ad);
      setAdForm({
        name: ad.name, creativeType: ad.creativeType, status: ad.status,
        mediaUrl: ad.mediaUrl, primaryText: ad.primaryText, headline: ad.headline,
        description: ad.description, ctaType: ad.ctaType, ctaLink: ad.ctaLink,
      });
    } else {
      setEditingAd(null);
      setAdForm({
        name: '', creativeType: 'image', status: 'draft',
        mediaUrl: '', primaryText: '', headline: '', description: '',
        ctaType: 'LEARN_MORE', ctaLink: '',
      });
    }
    setAdModalOpen(true);
  }, []);

  const handleSubmitAd = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adForm.name.trim()) { toast('נא להכניס שם למודעה', 'error'); return; }
    try {
      const payload = {
        adSetId: adModalAdSetId,
        campaignId,
        name: adForm.name,
        status: adForm.status,
        creativeType: adForm.creativeType,
        mediaUrl: adForm.mediaUrl,
        thumbnailUrl: null,
        primaryText: adForm.primaryText,
        headline: adForm.headline,
        description: adForm.description,
        ctaType: adForm.ctaType,
        ctaLink: adForm.ctaLink,
        linkedVideoProjectId: null,
        linkedClientFileId: null,
        impressions: 0, clicks: 0, spend: 0, leads: 0, conversions: 0,
        ctr: 0, cpl: 0, cpc: 0, roas: 0,
        notes: '',
      };
      if (editingAd) {
        await updateAd(editingAd.id, payload);
        toast('מודעה עודכנה', 'success');
      } else {
        await createAd(payload);
        toast('מודעה נוצרה', 'success');
      }
      setAdModalOpen(false);
    } catch { toast('שגיאה בשמירת מודעה', 'error'); }
  }, [adForm, adModalAdSetId, campaignId, editingAd, createAd, updateAd, toast]);

  // ── Loading ─────────────────────────────────────────────────────────

  if (!campaign) {
    return (
      <main style={{ maxWidth: '1400px', margin: '0 auto', padding: '2rem 1.5rem', direction: 'rtl' }}>
        <SkeletonKPIRow count={5} />
      </main>
    );
  }

  const health = computeHealth(campaign);
  const avgCtr = totalMetrics.impressions > 0 ? (totalMetrics.clicks / totalMetrics.impressions * 100) : 0;
  const avgCpl = totalMetrics.leads > 0 ? (totalMetrics.spend / totalMetrics.leads) : 0;
  const conversionRate = totalMetrics.clicks > 0 ? (totalMetrics.leads / totalMetrics.clicks * 100) : 0;
  const hasPerformanceData = totalMetrics.impressions > 0 || totalMetrics.spend > 0 || totalMetrics.leads > 0;

  // Best / worst performing ads (by composite score)
  const bestAd = useMemo(() => {
    if (campaignAds.length === 0) return null;
    const withScores = campaignAds.filter(a => a.impressions > 0 || a.leads > 0);
    if (withScores.length === 0) return null;
    return withScores.reduce((best, a) => getAdPerformanceScore(a) > getAdPerformanceScore(best) ? a : best);
  }, [campaignAds]);
  const worstAd = useMemo(() => {
    if (campaignAds.length < 2) return null;
    const withScores = campaignAds.filter(a => a.impressions > 0 || a.leads > 0);
    if (withScores.length < 2) return null;
    return withScores.reduce((worst, a) => getAdPerformanceScore(a) < getAdPerformanceScore(worst) ? a : worst);
  }, [campaignAds]);

  // Optimization recommendations
  const recommendations = useMemo(() => {
    if (!campaign || !hasPerformanceData) return [];
    return analyzeCampaignFull(campaign, campaignAdSets, campaignAds);
  }, [campaign, campaignAdSets, campaignAds, hasPerformanceData]);

  const topRecommendations = recommendations.slice(0, 3);

  const [dismissedRecs, setDismissedRecs] = useState<Set<string>>(new Set());

  // Variation preview modal state
  const [variationPreview, setVariationPreview] = useState<{
    show: boolean;
    variation: ReturnType<typeof generateVariation> | null;
    ad: Ad | null;
    rec: Recommendation | null;
  }>({ show: false, variation: null, ad: null, rec: null });

  // Activity log state
  const [activityEntries, setActivityEntries] = useState<Array<{ id: string; activityType: string; title: string; description: string; createdAt: string }>>([]);
  useEffect(() => {
    if (!campaign) return;
    fetch(`/api/data/campaign-activity?campaignId=${campaign.id}&limit=10`)
      .then(r => r.ok ? r.json() : { entries: [] })
      .then(d => setActivityEntries(d.entries || []))
      .catch(() => {});
  }, [campaign]);

  const handleRecAction = useCallback(async (rec: Recommendation, action: RecommendationAction) => {
    if (action === 'ignore') {
      setDismissedRecs(prev => new Set(prev).add(rec.id));
      toast.info('ההמלצה הוסתרה');
      return;
    }

    const targetAd = campaignAds.find(a => a.id === rec.objectId);

    if (action === 'create_variation' && targetAd && campaign) {
      // Show preview modal instead of immediately creating
      const variation = generateVariation(targetAd);
      setVariationPreview({ show: true, variation, ad: targetAd, rec });
      return;
    }

    if (action === 'send_to_approval' && targetAd && campaign) {
      const actionObj = buildDuplicateAdAction(
        targetAd, campaign,
        campaign.clientId, campaign.clientName || '',
        rec,
      );
      try {
        await fetch('/api/data/campaign-actions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(actionObj),
        });
        toast.success('הפעולה נשלחה לתור האישורים');
      } catch { toast.error('שגיאה בשליחה לאישור'); }
      return;
    }

    if (action === 'mark_for_review' && campaign) {
      const actionObj = {
        id: `act_${Date.now()}`,
        type: 'mark_for_review',
        title: `בדיקה: ${rec.objectName}`,
        objectType: rec.objectType,
        objectId: rec.objectId,
        objectName: rec.objectName,
        campaignId: campaign.id,
        campaignName: campaign.campaignName,
        adSetId: null,
        adId: targetAd?.id || null,
        clientId: campaign.clientId,
        clientName: campaign.clientName || '',
        recommendationId: rec.id,
        payload: { reviewReason: rec.reason, reviewPriority: rec.severity },
        status: 'pending',
        sourceRecommendationId: rec.id,
        sourceRecommendationType: rec.type,
        description: `סימון "${rec.objectName}" לבדיקה — ${rec.reason}`,
        previewBefore: `פריט: ${rec.objectName}`,
        previewAfter: `סומן לבדיקה`,
        createdBy: 'system',
        approvedBy: null, approvedAt: null, rejectionReason: null, executedAt: null, failedReason: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      try {
        await fetch('/api/data/campaign-actions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(actionObj),
        });
        toast.info('סומן לבדיקה ונשלח לתור');
      } catch { toast.error('שגיאה'); }
      return;
    }
  }, [toast, campaignAds, campaign]);

  // Variation preview — save draft or send for approval
  const handleVariationSave = useCallback(async (sendForApproval: boolean) => {
    const { variation, ad, rec } = variationPreview;
    if (!variation || !ad || !campaign) return;

    const actionObj = buildCreateVariationAction(
      ad, campaign,
      campaign.clientId, campaign.clientName || '',
      {
        newPrimaryText: variation.newPrimaryText,
        newHeadline: variation.newHeadline,
        newDescription: variation.newDescription,
        newCtaType: variation.newCtaType,
        newMediaSuggestion: variation.newMediaSuggestion,
        explanation: variation.explanation,
        strategy: variation.strategy,
      },
      rec,
    );
    if (sendForApproval) {
      actionObj.status = 'approval_required';
    }

    try {
      await fetch('/api/data/campaign-actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(actionObj),
      });
      toast.success(sendForApproval
        ? `וריאציה נשלחה לאישור — ${VARIATION_STRATEGY_META[variation.strategy]?.label || ''}`
        : 'טיוטת וריאציה נשמרה');
      setVariationPreview({ show: false, variation: null, ad: null, rec: null });
    } catch { toast.error('שגיאה ביצירת וריאציה'); }
  }, [variationPreview, campaign, toast]);

  const fieldStyle: React.CSSProperties = {
    width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.82rem',
    borderRadius: '0.375rem', border: '1px solid var(--border)',
    background: 'var(--surface-sunken, var(--background))', color: 'var(--foreground)',
    fontFamily: 'inherit',
  };

  return (
    <main style={{ maxWidth: '1400px', margin: '0 auto', padding: '2rem 1.5rem', direction: 'rtl' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

        {/* Breadcrumb + Title */}
        <div className="ux-hero-enter">
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.75rem', color: 'var(--foreground-muted)', marginBottom: '0.5rem' }}>
            <Link href="/campaigns" style={{ color: 'var(--accent)', textDecoration: 'none' }}>קמפיינים</Link>
            <span>›</span>
            <span>{campaign.campaignName}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--foreground)', margin: 0, letterSpacing: '-0.02em' }}>
                {campaign.campaignName}
              </h1>
              <p style={{ color: 'var(--foreground-muted)', fontSize: '0.8rem', marginTop: '0.15rem' }}>
                {campaign.clientName || 'ללא לקוח'} · {PLATFORM_LABELS[campaign.platform] || campaign.platform}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{
                ...badgeStyle(STATUS_COLORS[campaign.status] || '#6b7280', STATUS_COLORS[campaign.status] || '#6b7280'),
                fontSize: '0.72rem', padding: '0.3rem 0.6rem',
              }}>
                {STATUS_LABELS[campaign.status] || campaign.status}
              </span>
              <span style={{
                fontSize: '0.72rem', fontWeight: 700, padding: '0.3rem 0.6rem',
                borderRadius: '0.375rem', background: `${health.color}18`, color: health.color,
                border: `1px solid ${health.color}30`,
              }}>
                ❤ {health.score}
              </span>
              {/* Campaign action buttons */}
              <div style={{ display: 'flex', gap: '0.35rem', marginInlineStart: '0.5rem' }}>
                <button
                  className="mod-btn-ghost"
                  onClick={handlePauseResume}
                  style={{ fontSize: '0.7rem', padding: '0.3rem 0.55rem', fontWeight: 600, cursor: 'pointer' }}
                  title={campaign.status === 'active' ? 'השהה קמפיין' : 'הפעל קמפיין'}
                >
                  {campaign.status === 'active' ? '⏸ השהה' : '▶ הפעל'}
                </button>
                <button
                  className="mod-btn-ghost"
                  onClick={handleOpenEditCampaign}
                  style={{ fontSize: '0.7rem', padding: '0.3rem 0.55rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  ✏️ ערוך
                </button>
                <button
                  className="mod-btn-ghost"
                  onClick={handleDuplicateCampaign}
                  style={{ fontSize: '0.7rem', padding: '0.3rem 0.55rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  📋 שכפל
                </button>
                <button
                  className="mod-btn-ghost"
                  onClick={handleAIImprove}
                  style={{ fontSize: '0.7rem', padding: '0.3rem 0.55rem', fontWeight: 600, cursor: 'pointer', color: 'var(--accent)' }}
                >
                  🧠 שיפור AI
                </button>
                <button
                  onClick={handlePublishToMeta}
                  disabled={publishLoading}
                  style={{
                    fontSize: '0.7rem', padding: '0.3rem 0.7rem', fontWeight: 700, cursor: publishLoading ? 'wait' : 'pointer',
                    background: campaign.metaCampaignId ? 'var(--success, #22c55e)' : 'var(--accent)',
                    color: '#fff', border: 'none', borderRadius: '0.375rem',
                    opacity: publishLoading ? 0.6 : 1,
                    display: 'flex', alignItems: 'center', gap: '0.3rem',
                  }}
                  title={campaign.metaCampaignId ? 'הקמפיין כבר פורסם — לחץ לסנכרון מחדש' : 'פרסם את הקמפיין למטא'}
                >
                  {publishLoading ? '⏳ מפרסם...' : campaign.metaCampaignId ? '✅ פורסם למטא' : '🚀 פרסם למטא'}
                </button>
                <button
                  onClick={handleGenerateReport}
                  disabled={reportGenerating}
                  style={{
                    fontSize: '0.7rem', padding: '0.3rem 0.7rem', fontWeight: 700, cursor: reportGenerating ? 'wait' : 'pointer',
                    background: 'var(--surface-raised)', color: 'var(--foreground)',
                    border: '1px solid var(--border)', borderRadius: '0.375rem',
                    opacity: reportGenerating ? 0.6 : 1,
                    display: 'flex', alignItems: 'center', gap: '0.3rem',
                  }}
                  title="הפקת דוח ביצועים לקמפיין"
                >
                  {reportGenerating ? '⏳ מפיק...' : '📊 הפק דוח'}
                </button>
                <button
                  onClick={handleGenerateAiAds}
                  disabled={aiAdsGenerating}
                  style={{
                    fontSize: '0.7rem', padding: '0.3rem 0.7rem', fontWeight: 700, cursor: aiAdsGenerating ? 'wait' : 'pointer',
                    background: 'linear-gradient(135deg, #8b5cf6, #6366f1)', color: '#fff',
                    border: 'none', borderRadius: '0.375rem',
                    opacity: aiAdsGenerating ? 0.6 : 1,
                    display: 'flex', alignItems: 'center', gap: '0.3rem',
                    transition: 'all 0.2s ease',
                  }}
                  title="צור מודעות AI אוטומטיות מתוכן הקמפיין"
                >
                  {aiAdsGenerating ? '⏳ יוצר...' : '🤖 צור מודעות AI'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* KPI Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.75rem' }}>
          {[
            { label: 'קבוצות מודעות', value: campaignAdSets.length, color: 'var(--foreground)' },
            { label: 'מודעות', value: campaignAds.length, color: 'var(--accent)' },
            { label: 'תקציב', value: `₪${(campaign.budget || 0).toLocaleString('he-IL')}`, color: 'var(--foreground)' },
            { label: 'חשיפות', value: totalMetrics.impressions > 0 ? `${(totalMetrics.impressions / 1000).toFixed(1)}K` : '—', color: '#3b82f6' },
            { label: 'CTR', value: avgCtr > 0 ? `${avgCtr.toFixed(1)}%` : '—', color: avgCtr >= 2 ? '#22c55e' : avgCtr > 0 ? '#f59e0b' : 'var(--foreground-muted)' },
            { label: 'CPL', value: avgCpl > 0 ? `₪${avgCpl.toFixed(0)}` : '—', color: 'var(--foreground)' },
            { label: 'לידים', value: totalMetrics.leads || (leadInsights?.leadCount || 0), color: '#0092cc' },
            { label: 'הוצאה', value: totalMetrics.spend > 0 ? `₪${totalMetrics.spend.toFixed(0)}` : '—', color: totalMetrics.spend > 0 ? '#ef4444' : 'var(--foreground-muted)' },
            { label: 'המרה', value: conversionRate > 0 ? `${conversionRate.toFixed(1)}%` : '—', color: conversionRate >= 5 ? '#22c55e' : conversionRate > 0 ? '#f59e0b' : 'var(--foreground-muted)' },
          ].map((kpi) => (
            <div key={kpi.label} className="premium-card" style={{ padding: '0.85rem', textAlign: 'center' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: kpi.color }}>{kpi.value}</div>
              <div style={{ fontSize: '0.62rem', color: 'var(--foreground-muted)', fontWeight: 600, marginTop: '0.1rem' }}>{kpi.label}</div>
            </div>
          ))}
        </div>

        {/* BI Early Warnings Strip */}
        <CampaignBIWarnings clientId={campaign.clientId} campaignId={campaign.id} />

        {/* No performance data empty state */}
        {!hasPerformanceData && campaignAds.length > 0 && (
          <div className="premium-card" style={{ padding: '1.25rem', textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '0.4rem' }}>📊</div>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--foreground)', marginBottom: '0.2rem' }}>
              אין עדיין נתוני ביצועים אמיתיים
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--foreground-muted)' }}>
              נתוני ביצועים יופיעו כאן ברגע שהמודעות יתחילו לרוץ ולצבור חשיפות, קליקים ולידים
            </div>
          </div>
        )}

        {/* Best / Worst Ad Highlight */}
        {bestAd && hasPerformanceData && (
          <div style={{ display: 'grid', gridTemplateColumns: worstAd ? '1fr 1fr' : '1fr', gap: '0.75rem' }}>
            <div className="premium-card" style={{ padding: '0.85rem 1rem', borderRight: '3px solid #22c55e' }}>
              <div style={{ fontSize: '0.62rem', fontWeight: 600, color: '#22c55e', marginBottom: '0.25rem' }}>🏆 מודעה מובילה</div>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {bestAd.headline || bestAd.name}
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.3rem', fontSize: '0.65rem', color: 'var(--foreground-muted)' }}>
                <span>CTR {bestAd.ctr.toFixed(1)}%</span>
                <span>{bestAd.leads} לידים</span>
                {bestAd.cpl > 0 && <span>CPL ₪{bestAd.cpl.toFixed(0)}</span>}
                <span style={{ color: '#22c55e', fontWeight: 700 }}>ציון {getAdPerformanceScore(bestAd)}</span>
              </div>
            </div>
            {worstAd && worstAd.id !== bestAd.id && (
              <div className="premium-card" style={{ padding: '0.85rem 1rem', borderRight: '3px solid #ef4444' }}>
                <div style={{ fontSize: '0.62rem', fontWeight: 600, color: '#ef4444', marginBottom: '0.25rem' }}>⚠️ מודעה חלשה</div>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {worstAd.headline || worstAd.name}
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.3rem', fontSize: '0.65rem', color: 'var(--foreground-muted)' }}>
                  <span>CTR {worstAd.ctr.toFixed(1)}%</span>
                  <span>{worstAd.leads} לידים</span>
                  {worstAd.cpl > 0 && <span>CPL ₪{worstAd.cpl.toFixed(0)}</span>}
                  <span style={{ color: '#ef4444', fontWeight: 700 }}>ציון {getAdPerformanceScore(worstAd)}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* AI Optimization Recommendations */}
        {hasPerformanceData && topRecommendations.filter(r => !dismissedRecs.has(r.id)).length > 0 && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.625rem' }}>
              <span style={{ fontSize: '0.9rem' }}>🧠</span>
              <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: 'var(--foreground)' }}>
                המלצות אופטימיזציה ({recommendations.length})
              </h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {topRecommendations.filter(r => !dismissedRecs.has(r.id)).map((rec) => {
                const typeMeta = RECOMMENDATION_TYPE_META[rec.type];
                const sevMeta = SEVERITY_META[rec.severity];
                return (
                  <div key={rec.id} className="premium-card" style={{
                    padding: '0.85rem 1rem',
                    borderRight: `3px solid ${typeMeta.color}`,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.3rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span style={{ fontSize: '0.85rem' }}>{typeMeta.icon}</span>
                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--foreground)' }}>{rec.title}</span>
                        <span style={{
                          fontSize: '0.58rem', padding: '0.1rem 0.35rem', borderRadius: '999px',
                          background: sevMeta.bgColor, color: sevMeta.color, fontWeight: 600,
                        }}>
                          {sevMeta.label}
                        </span>
                        <span style={{
                          fontSize: '0.58rem', padding: '0.1rem 0.35rem', borderRadius: '999px',
                          background: typeMeta.bgColor, color: typeMeta.color, fontWeight: 500,
                        }}>
                          {typeMeta.label}
                        </span>
                      </div>
                      <span style={{ fontSize: '0.6rem', color: 'var(--foreground-muted)', whiteSpace: 'nowrap' }}>
                        ביטחון {rec.confidence}%
                      </span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--foreground-muted)', marginBottom: '0.25rem', lineHeight: 1.5 }}>
                      {rec.reason}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--foreground)', fontWeight: 500, marginBottom: '0.4rem' }}>
                      💡 {rec.recommendedAction}
                    </div>
                    <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                      {rec.actions.map((action) => (
                        <button
                          key={action}
                          onClick={() => handleRecAction(rec, action)}
                          style={{
                            fontSize: '0.65rem', padding: '0.2rem 0.5rem', borderRadius: '0.3rem',
                            border: action === 'ignore' ? '1px solid var(--border)' : `1px solid ${typeMeta.color}30`,
                            background: action === 'ignore' ? 'transparent' : typeMeta.bgColor,
                            color: action === 'ignore' ? 'var(--foreground-muted)' : typeMeta.color,
                            cursor: 'pointer', fontWeight: 500,
                          }}
                        >
                          {ACTION_LABELS[action]}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* No performance, no recommendations empty state */}
        {!hasPerformanceData && campaignAds.length > 0 && campaign.metaSyncSource === 'meta_sync' && (
          <div className="premium-card" style={{ padding: '1rem', textAlign: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: '#1877F2', fontWeight: 500 }}>ממתין לנתוני ביצועים ממטא</span>
            <div style={{ fontSize: '0.7rem', color: 'var(--foreground-muted)', marginTop: '0.2rem' }}>
              המלצות אופטימיזציה יופיעו כאן לאחר סנכרון נתוני ביצועים
            </div>
          </div>
        )}

        {hasPerformanceData && recommendations.length === 0 && (
          <div className="premium-card" style={{ padding: '1rem', textAlign: 'center' }}>
            <span style={{ fontSize: '1rem' }}>✅</span>
            <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--foreground)', marginTop: '0.2rem' }}>
              לא נמצאו בעיות משמעותיות כרגע
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--foreground-muted)', marginTop: '0.15rem' }}>
              הקמפיין פועל כראוי — המערכת תתריע אם יזוהו בעיות
            </div>
          </div>
        )}

        {/* Objective & Navigation */}
        {campaign.objective && (
          <div className="premium-card" style={{ padding: '0.85rem 1.25rem', display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
            <span style={{ fontSize: '0.9rem', flexShrink: 0, marginTop: '0.1rem' }}>🎯</span>
            <div>
              <div style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--foreground-muted)', marginBottom: '0.15rem' }}>מטרה</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--foreground)', lineHeight: 1.5 }}>{campaign.objective}</div>
            </div>
          </div>
        )}

        {/* Hierarchy Navigation */}
        <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', fontSize: '0.72rem', color: 'var(--foreground-muted)' }}>
          <span style={{ fontWeight: 700, color: 'var(--foreground)' }}>📊 {campaign.campaignName}</span>
          <span>→</span>
          <span>{campaignAdSets.length} קבוצות מודעות</span>
          <span>→</span>
          <span>{campaignAds.length} מודעות</span>
          {selectedAdSetFilter !== 'all' && (
            <>
              <span style={{ margin: '0 0.25rem' }}>|</span>
              <button
                className="mod-btn-ghost"
                onClick={() => setSelectedAdSetFilter('all')}
                style={{ fontSize: '0.68rem', padding: '0.1rem 0.35rem', color: 'var(--accent)', cursor: 'pointer' }}
              >
                הצג הכל
              </button>
            </>
          )}
        </div>

        {/* Performance Trend (mini bar chart) */}
        {trendData.length > 0 && (
          <div className="premium-card" style={{ padding: '1rem 1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--foreground)' }}>מגמת ביצועים — 7 ימים אחרונים</span>
              <span style={{ fontSize: '0.65rem', color: 'var(--foreground-muted)' }}>לידים / הוצאה יומית (משוער)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.35rem', height: '64px' }}>
              {trendData.map((d, i) => {
                const maxLeads = Math.max(1, ...trendData.map(t => t.leads));
                const barH = Math.max(4, (d.leads / maxLeads) * 56);
                return (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.15rem' }}>
                    <span style={{ fontSize: '0.55rem', fontWeight: 700, color: 'var(--accent)' }}>{d.leads}</span>
                    <div style={{
                      width: '100%', maxWidth: '36px', height: `${barH}px`,
                      borderRadius: '3px 3px 0 0',
                      background: `linear-gradient(180deg, var(--accent) 0%, rgba(0,181,254,0.4) 100%)`,
                      transition: 'height 300ms ease',
                    }} />
                    <span style={{ fontSize: '0.55rem', color: 'var(--foreground-muted)', fontWeight: 600 }}>{d.day}</span>
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', borderTop: '1px solid var(--border)', paddingTop: '0.4rem' }}>
              <span style={{ fontSize: '0.65rem', color: 'var(--foreground-muted)' }}>
                סה"כ לידים: <strong style={{ color: 'var(--foreground)' }}>{trendData.reduce((s, d) => s + d.leads, 0)}</strong>
              </span>
              <span style={{ fontSize: '0.65rem', color: 'var(--foreground-muted)' }}>
                סה"כ הוצאה: <strong style={{ color: 'var(--foreground)' }}>₪{trendData.reduce((s, d) => s + d.spend, 0).toLocaleString('he-IL')}</strong>
              </span>
            </div>
          </div>
        )}

        {/* ── Attribution Summary ── */}
        {campaignLeads.length > 0 && (
          <div className="premium-card" style={{ padding: '1rem 1.25rem' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--foreground)', marginBottom: '0.75rem' }}>
              📈 שיוך לידים — Attribution
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              {/* Leads per Ad Set */}
              <div>
                <div style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--foreground-muted)', marginBottom: '0.4rem' }}>
                  לידים לפי קבוצת מודעות
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  {campaignAdSets.map(s => {
                    const count = leadsPerAdSet[s.id] || 0;
                    const pct = campaignLeads.length > 0 ? (count / campaignLeads.length * 100) : 0;
                    return (
                      <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.68rem', color: 'var(--foreground)', fontWeight: 600, minWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {s.name}
                        </span>
                        <div style={{ flex: 1, height: '6px', borderRadius: '3px', background: 'var(--border)', overflow: 'hidden' }}>
                          <div style={{ width: `${Math.max(pct, 2)}%`, height: '100%', borderRadius: '3px', background: 'var(--accent)', transition: 'width 300ms ease' }} />
                        </div>
                        <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--foreground)', minWidth: '32px', textAlign: 'left' }}>
                          {count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
              {/* Leads per Ad (top 5) */}
              <div>
                <div style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--foreground-muted)', marginBottom: '0.4rem' }}>
                  לידים לפי מודעה (טופ 5)
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  {campaignAds
                    .filter(a => (leadsPerAd[a.id] || 0) > 0)
                    .sort((a, b) => (leadsPerAd[b.id] || 0) - (leadsPerAd[a.id] || 0))
                    .slice(0, 5)
                    .map(a => {
                      const count = leadsPerAd[a.id] || 0;
                      const pct = campaignLeads.length > 0 ? (count / campaignLeads.length * 100) : 0;
                      const cpl = count > 0 && a.spend > 0 ? (a.spend / count) : 0;
                      return (
                        <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.68rem', color: 'var(--foreground)', fontWeight: 600, minWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {a.headline || a.name}
                          </span>
                          <div style={{ flex: 1, height: '6px', borderRadius: '3px', background: 'var(--border)', overflow: 'hidden' }}>
                            <div style={{ width: `${Math.max(pct, 2)}%`, height: '100%', borderRadius: '3px', background: '#22c55e', transition: 'width 300ms ease' }} />
                          </div>
                          <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--foreground)', minWidth: '24px', textAlign: 'left' }}>
                            {count}
                          </span>
                          {cpl > 0 && (
                            <span style={{ fontSize: '0.58rem', color: 'var(--foreground-muted)', minWidth: '40px' }}>
                              ₪{cpl.toFixed(0)} CPL
                            </span>
                          )}
                        </div>
                      );
                    })}
                  {campaignAds.filter(a => (leadsPerAd[a.id] || 0) > 0).length === 0 && (
                    <span style={{ fontSize: '0.65rem', color: 'var(--foreground-muted)' }}>אין לידים משויכים למודעות</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Leads Table with Filters ── */}
        {campaignLeads.length > 0 && (
          <div className="premium-card" style={{ padding: '1rem 1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--foreground)' }}>
                👤 לידים ({filteredLeads.length}{filteredLeads.length !== campaignLeads.length ? ` מתוך ${campaignLeads.length}` : ''})
              </span>
              <span style={{ fontSize: '0.62rem', color: 'var(--foreground-muted)' }}>
                לחץ על שורה לפרטים
              </span>
            </div>

            {/* Filter Controls */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
              {campaignAdSets.length > 1 && (
                <select
                  value={leadFilterAdSet}
                  onChange={(e) => { setLeadFilterAdSet(e.target.value); setLeadFilterAd('all'); }}
                  style={{ fontSize: '0.68rem', padding: '0.3rem 0.5rem', borderRadius: '0.3rem', border: '1px solid var(--border)', background: 'var(--surface-sunken, var(--background))', color: 'var(--foreground)', fontFamily: 'inherit' }}
                >
                  <option value="all">כל קבוצות המודעות</option>
                  {campaignAdSets.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              )}
              {campaignAds.length > 1 && (
                <select
                  value={leadFilterAd}
                  onChange={(e) => setLeadFilterAd(e.target.value)}
                  style={{ fontSize: '0.68rem', padding: '0.3rem 0.5rem', borderRadius: '0.3rem', border: '1px solid var(--border)', background: 'var(--surface-sunken, var(--background))', color: 'var(--foreground)', fontFamily: 'inherit' }}
                >
                  <option value="all">כל המודעות</option>
                  {(leadFilterAdSet !== 'all' ? campaignAds.filter(a => a.adSetId === leadFilterAdSet) : campaignAds).map(a => (
                    <option key={a.id} value={a.id}>{a.headline || a.name}</option>
                  ))}
                </select>
              )}
              <select
                value={leadFilterStatus}
                onChange={(e) => setLeadFilterStatus(e.target.value)}
                style={{ fontSize: '0.68rem', padding: '0.3rem 0.5rem', borderRadius: '0.3rem', border: '1px solid var(--border)', background: 'var(--surface-sunken, var(--background))', color: 'var(--foreground)', fontFamily: 'inherit' }}
              >
                <option value="all">כל הסטטוסים</option>
                {Object.entries(LEAD_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              {(leadFilterAdSet !== 'all' || leadFilterAd !== 'all' || leadFilterStatus !== 'all') && (
                <button
                  type="button"
                  onClick={() => { setLeadFilterAdSet('all'); setLeadFilterAd('all'); setLeadFilterStatus('all'); }}
                  style={{ fontSize: '0.65rem', padding: '0.3rem 0.5rem', borderRadius: '0.3rem', border: '1px solid var(--border)', background: 'transparent', color: 'var(--accent)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}
                >
                  נקה פילטרים
                </button>
              )}
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)' }}>
                    {['שם', 'טלפון', 'תאריך', 'מודעה', 'קבוצת מודעות', 'מקור', 'סטטוס'].map(h => (
                      <th key={h} style={{ padding: '0.5rem 0.6rem', textAlign: 'right', fontWeight: 700, color: 'var(--foreground-muted)', fontSize: '0.65rem', whiteSpace: 'nowrap' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.slice(0, 30).map(lead => {
                    const ad = campaignAds.find(a => a.id === lead.adId);
                    const adSet = campaignAdSets.find(s => s.id === lead.adSetId);
                    return (
                      <tr
                        key={lead.id}
                        onClick={() => setSelectedLead(lead)}
                        style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 150ms' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-raised, rgba(0,0,0,0.02))')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <td style={{ padding: '0.5rem 0.6rem', fontWeight: 600, color: 'var(--foreground)' }}>
                          {lead.fullName || lead.name}
                        </td>
                        <td style={{ padding: '0.5rem 0.6rem', color: 'var(--foreground-muted)', whiteSpace: 'nowrap', fontSize: '0.68rem', direction: 'ltr', textAlign: 'right' }}>
                          {lead.phone || '—'}
                        </td>
                        <td style={{ padding: '0.5rem 0.6rem', color: 'var(--foreground-muted)', whiteSpace: 'nowrap' }}>
                          {new Date(lead.createdAt).toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })}
                        </td>
                        <td style={{ padding: '0.5rem 0.6rem', color: 'var(--foreground)', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {ad?.headline || ad?.name || lead.adName || '—'}
                        </td>
                        <td style={{ padding: '0.5rem 0.6rem', color: 'var(--foreground)', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {adSet?.name || lead.adSetName || '—'}
                        </td>
                        <td style={{ padding: '0.5rem 0.6rem', color: 'var(--foreground-muted)', fontSize: '0.65rem' }}>
                          {lead.source || '—'}
                        </td>
                        <td style={{ padding: '0.5rem 0.6rem' }}>
                          <span style={{
                            fontSize: '0.6rem', fontWeight: 700, padding: '0.15rem 0.4rem',
                            borderRadius: '999px',
                            background: `${LEAD_STATUS_COLORS[lead.status] || '#6b7280'}18`,
                            color: LEAD_STATUS_COLORS[lead.status] || '#6b7280',
                          }}>
                            {LEAD_STATUS_LABELS[lead.status] || lead.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredLeads.length > 30 && (
                <div style={{ textAlign: 'center', padding: '0.5rem', fontSize: '0.65rem', color: 'var(--foreground-muted)' }}>
                  מציג 30 מתוך {filteredLeads.length} לידים
                </div>
              )}
              {filteredLeads.length === 0 && (
                <div style={{ textAlign: 'center', padding: '1.5rem', fontSize: '0.72rem', color: 'var(--foreground-muted)' }}>
                  אין לידים התואמים לפילטרים שנבחרו
                </div>
              )}
            </div>
          </div>
        )}

        {/* Ad Sets Header + AdSet filter */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h2 style={sectionTitleStyle}>קבוצות מודעות ({campaignAdSets.length})</h2>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {campaignAdSets.length > 1 && (
              <select
                value={selectedAdSetFilter}
                onChange={(e) => setSelectedAdSetFilter(e.target.value)}
                style={{
                  fontSize: '0.72rem', padding: '0.35rem 0.6rem',
                  borderRadius: '0.375rem', border: '1px solid var(--border)',
                  background: 'var(--surface)', color: 'var(--foreground)',
                  fontFamily: 'inherit', cursor: 'pointer',
                }}
              >
                <option value="all">כל קבוצות המודעות ({campaignAdSets.length})</option>
                {campaignAdSets.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({(adsByAdSet[s.id] || []).length} מודעות)</option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={() => handleOpenAdSetModal()}
              className="mod-btn-primary"
              style={{ padding: '0.45rem 1rem', fontSize: '0.78rem', fontWeight: 700, borderRadius: '0.5rem', cursor: 'pointer' }}
            >
              + קבוצת מודעות חדשה
            </button>
          </div>
        </div>

        {/* Filter & View Mode Bar */}
        {campaignAds.length > 0 && (
          <AdFilterBar
            filter={adFilter}
            onFilter={setAdFilter}
            viewMode={adViewMode}
            onViewMode={setAdViewMode}
            adCount={filteredAdCount}
            sortMode={adSortMode}
            onSort={setAdSortMode}
            groupMode={adGroupMode}
            onGroup={setAdGroupMode}
            compareCount={selectedAdIds.size}
            onOpenCompare={() => setShowComparePanel(true)}
          />
        )}

        {/* A/B Compare Panel */}
        {showComparePanel && selectedAdsForCompare.length >= 2 && (
          <ABComparePanel
            ads={selectedAdsForCompare}
            onClose={() => { setShowComparePanel(false); setSelectedAdIds(new Set()); }}
          />
        )}

        {campaignAdSets.length === 0 ? (
          <div style={{ ...cardStyle, textAlign: 'center', padding: '3rem' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📦</div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--foreground)', margin: '0 0 0.5rem' }}>
              עדיין אין קבוצות מודעות
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--foreground-muted)', margin: '0 0 1rem' }}>
              הוסף קבוצת מודעות כדי להתחיל לארגן את המודעות שלך
            </p>
            <button
              type="button"
              onClick={() => handleOpenAdSetModal()}
              className="mod-btn-primary"
              style={{ padding: '0.5rem 1.25rem', fontSize: '0.82rem', fontWeight: 700, borderRadius: '0.5rem', cursor: 'pointer' }}
            >
              + צור קבוצת מודעות ראשונה
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {visibleAdSets.map((adSet) => (
              <AdSetSection
                key={adSet.id}
                adSet={adSet}
                adsForSet={filteredAdsByAdSet[adSet.id] || []}
                onEditAd={(ad) => handleOpenAdModal(adSet.id, ad)}
                onEditAdSet={(s) => handleOpenAdSetModal(s)}
                onAddAd={(adSetId) => handleOpenAdModal(adSetId)}
                onDuplicate={handleDuplicate}
                onCreateVariation={handleCreateVariation}
                onInlineEdit={handleInlineEdit}
                viewMode={adViewMode}
                sortMode={adSortMode}
                groupMode={adGroupMode}
                selectedAdIds={selectedAdIds}
                onToggleSelect={handleToggleSelect}
                recBadge={(() => {
                  if (!campaign) return null;
                  const badge = getAdSetBadge(adSet, campaignAds, campaign);
                  if (!badge) return null;
                  const meta = RECOMMENDATION_TYPE_META[badge.type];
                  return { title: badge.title, icon: meta.icon, color: meta.color };
                })()}
                adNotes={(() => {
                  if (!campaign) return {};
                  const notes: Record<string, { title: string; icon: string; color: string }> = {};
                  const adsInSet = filteredAdsByAdSet[adSet.id] || [];
                  for (const ad of adsInSet) {
                    const note = getAdNote(ad, adsInSet, campaign);
                    if (note) {
                      const meta = RECOMMENDATION_TYPE_META[note.type];
                      notes[ad.id] = { title: note.title, icon: meta.icon, color: meta.color };
                    }
                  }
                  return notes;
                })()}
              />
            ))}
          </div>
        )}

        {/* Migration hint */}
        {campaignAdSets.length === 0 && (campaign.caption || campaign.externalMediaUrl) && (
          <div style={{
            ...cardStyle, borderRight: '3px solid var(--accent)',
            display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.25rem',
          }}>
            <span style={{ fontSize: '1.2rem' }}>💡</span>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>
                לקמפיין זה יש נתוני קריאייטיב ישנים
              </p>
              <p style={{ fontSize: '0.72rem', color: 'var(--foreground-muted)', margin: '0.2rem 0 0' }}>
                הפעל את כלי ההגירה כדי להמיר אותם אוטומטית לקבוצת מודעות + מודעה
              </p>
            </div>
            <button
              type="button"
              onClick={async () => {
                try {
                  const res = await fetch('/api/data/migrate-campaign-structure', { method: 'POST' });
                  const json = await res.json();
                  if (res.ok) {
                    toast(`הגירה הושלמה: ${json.migrated} קמפיינים הומרו`, 'success');
                    window.location.reload();
                  } else {
                    toast(json.error || 'שגיאה בהגירה', 'error');
                  }
                } catch { toast('שגיאת רשת', 'error'); }
              }}
              className="mod-btn-primary"
              style={{ padding: '0.45rem 1rem', fontSize: '0.75rem', fontWeight: 700, borderRadius: '0.5rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              🔄 המר עכשיו
            </button>
          </div>
        )}
      </div>

      {/* Ad Set Modal */}
      <Modal open={adSetModalOpen} onClose={() => setAdSetModalOpen(false)} title={editingAdSet ? 'עריכת קבוצת מודעות' : 'קבוצת מודעות חדשה'}>
        <div style={{ padding: '1.5rem', maxWidth: '500px' }}>
          <form onSubmit={handleSubmitAdSet} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>שם *</label>
              <input type="text" value={adSetForm.name} onChange={(e) => setAdSetForm({ ...adSetForm, name: e.target.value })} placeholder="שם קבוצת המודעות" style={fieldStyle} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>סטטוס</label>
              <select value={adSetForm.status} onChange={(e) => setAdSetForm({ ...adSetForm, status: e.target.value as AdSetStatus })} style={{ ...fieldStyle, cursor: 'pointer' }}>
                <option value="draft">טיוטה</option>
                <option value="active">פעיל</option>
                <option value="paused">מושהה</option>
                <option value="archived">ארכיון</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>מיקומים (מופרדים בפסיק)</label>
              <input type="text" value={adSetForm.geoLocations} onChange={(e) => setAdSetForm({ ...adSetForm, geoLocations: e.target.value })} placeholder="תל אביב, ירושלים, חיפה" style={fieldStyle} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>תחומי עניין (מופרדים בפסיק)</label>
              <input type="text" value={adSetForm.interests} onChange={(e) => setAdSetForm({ ...adSetForm, interests: e.target.value })} placeholder="שיווק דיגיטלי, עסקים קטנים" style={fieldStyle} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>תקציב יומי ₪</label>
              <input type="number" value={adSetForm.dailyBudget} onChange={(e) => setAdSetForm({ ...adSetForm, dailyBudget: e.target.value })} min="0" style={fieldStyle} />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '0.5rem' }}>
              <button type="submit" className="mod-btn-primary" style={{ flex: 1, padding: '0.6rem', fontSize: '0.85rem', fontWeight: 700, borderRadius: '0.5rem', cursor: 'pointer' }}>
                {editingAdSet ? 'עדכן' : 'צור'}
              </button>
              <button type="button" onClick={() => setAdSetModalOpen(false)} className="mod-btn-ghost" style={{ flex: 1, padding: '0.6rem', fontSize: '0.85rem', fontWeight: 600, borderRadius: '0.5rem', cursor: 'pointer' }}>
                ביטול
              </button>
            </div>
          </form>
        </div>
      </Modal>

      {/* Ad Modal */}
      <Modal open={adModalOpen} onClose={() => setAdModalOpen(false)} title={editingAd ? 'עריכת מודעה' : 'מודעה חדשה'}>
        <div style={{ padding: '1.5rem', maxWidth: '550px' }}>
          <form onSubmit={handleSubmitAd} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>שם מודעה *</label>
              <input type="text" value={adForm.name} onChange={(e) => setAdForm({ ...adForm, name: e.target.value })} placeholder="שם המודעה" style={fieldStyle} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>סוג קריאייטיב</label>
                <select value={adForm.creativeType} onChange={(e) => setAdForm({ ...adForm, creativeType: e.target.value as AdCreativeType })} style={{ ...fieldStyle, cursor: 'pointer' }}>
                  <option value="image">תמונה</option>
                  <option value="video">וידאו</option>
                  <option value="carousel">קרוסלה</option>
                  <option value="slideshow">מצגת</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>סטטוס</label>
                <select value={adForm.status} onChange={(e) => setAdForm({ ...adForm, status: e.target.value as AdStatus })} style={{ ...fieldStyle, cursor: 'pointer' }}>
                  <option value="draft">טיוטה</option>
                  <option value="active">פעיל</option>
                  <option value="paused">מושהה</option>
                  <option value="archived">ארכיון</option>
                </select>
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>כתובת מדיה (URL)</label>
              <input type="url" value={adForm.mediaUrl} onChange={(e) => setAdForm({ ...adForm, mediaUrl: e.target.value })} placeholder="https://..." style={fieldStyle} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>כותרת</label>
              <input type="text" value={adForm.headline} onChange={(e) => setAdForm({ ...adForm, headline: e.target.value })} placeholder="כותרת מודעה" style={fieldStyle} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>טקסט ראשי</label>
              <textarea value={adForm.primaryText} onChange={(e) => setAdForm({ ...adForm, primaryText: e.target.value })} placeholder="הטקסט הראשי של המודעה" style={{ ...fieldStyle, minHeight: '70px', resize: 'vertical' as const }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>תיאור</label>
              <input type="text" value={adForm.description} onChange={(e) => setAdForm({ ...adForm, description: e.target.value })} placeholder="שורת תיאור (אופציונלי)" style={fieldStyle} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>CTA</label>
                <select value={adForm.ctaType} onChange={(e) => setAdForm({ ...adForm, ctaType: e.target.value })} style={{ ...fieldStyle, cursor: 'pointer' }}>
                  {Object.entries(CTA_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>קישור יעד</label>
                <input type="url" value={adForm.ctaLink} onChange={(e) => setAdForm({ ...adForm, ctaLink: e.target.value })} placeholder="https://..." style={fieldStyle} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '0.5rem' }}>
              <button type="submit" className="mod-btn-primary" style={{ flex: 1, padding: '0.6rem', fontSize: '0.85rem', fontWeight: 700, borderRadius: '0.5rem', cursor: 'pointer' }}>
                {editingAd ? 'עדכן' : 'צור'}
              </button>
              <button type="button" onClick={() => setAdModalOpen(false)} className="mod-btn-ghost" style={{ flex: 1, padding: '0.6rem', fontSize: '0.85rem', fontWeight: 600, borderRadius: '0.5rem', cursor: 'pointer' }}>
                ביטול
              </button>
            </div>
          </form>
        </div>
      </Modal>

      {/* Lead Detail Modal */}
      <Modal open={!!selectedLead} onClose={() => setSelectedLead(null)} title="פרטי ליד">
        {selectedLead && (() => {
          const ad = campaignAds.find(a => a.id === selectedLead.adId);
          const adSet = campaignAdSets.find(s => s.id === selectedLead.adSetId);
          return (
            <div style={{ padding: '1.5rem', maxWidth: '480px' }}>
              {/* Lead name + status */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>
                  {selectedLead.fullName || selectedLead.name}
                </h3>
                <span style={{
                  fontSize: '0.65rem', fontWeight: 700, padding: '0.2rem 0.55rem',
                  borderRadius: '999px',
                  background: `${LEAD_STATUS_COLORS[selectedLead.status] || '#6b7280'}18`,
                  color: LEAD_STATUS_COLORS[selectedLead.status] || '#6b7280',
                }}>
                  {LEAD_STATUS_LABELS[selectedLead.status] || selectedLead.status}
                </span>
              </div>

              {/* Contact info */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginBottom: '1.25rem' }}>
                {selectedLead.email && (
                  <div>
                    <div style={{ fontSize: '0.62rem', color: 'var(--foreground-muted)', fontWeight: 600 }}>אימייל</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--foreground)' }}>{selectedLead.email}</div>
                  </div>
                )}
                {selectedLead.phone && (
                  <div>
                    <div style={{ fontSize: '0.62rem', color: 'var(--foreground-muted)', fontWeight: 600 }}>טלפון</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--foreground)' }}>{selectedLead.phone}</div>
                  </div>
                )}
                <div>
                  <div style={{ fontSize: '0.62rem', color: 'var(--foreground-muted)', fontWeight: 600 }}>מקור</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--foreground)' }}>{selectedLead.source || '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.62rem', color: 'var(--foreground-muted)', fontWeight: 600 }}>תאריך</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--foreground)' }}>
                    {new Date(selectedLead.createdAt).toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>
                </div>
              </div>

              {/* Attribution path */}
              <div style={{
                background: 'var(--surface-sunken, var(--background))',
                borderRadius: '0.5rem', padding: '0.85rem', border: '1px solid var(--border)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--foreground)' }}>
                    🎯 הגיע מ: מסלול שיוך
                  </div>
                  {selectedLead.source && (
                    <span style={{
                      fontSize: '0.6rem', fontWeight: 700, padding: '0.15rem 0.45rem',
                      borderRadius: '999px', background: 'var(--accent-bg, rgba(0,146,204,0.1))',
                      color: 'var(--accent)',
                    }}>
                      {selectedLead.source}
                    </span>
                  )}
                </div>
                {(!selectedLead.campaignId && !selectedLead.campaignName) ? (
                  <div style={{ fontSize: '0.72rem', color: 'var(--foreground-muted)', fontStyle: 'italic', padding: '0.5rem 0' }}>
                    ללא שיוך קמפיין — ליד זה הגיע ללא מידע על מקור הקמפיין
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {/* Campaign */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.75rem' }}>📊</span>
                      <div>
                        <div style={{ fontSize: '0.58rem', color: 'var(--foreground-muted)', fontWeight: 600 }}>קמפיין</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--foreground)', fontWeight: 600 }}>
                          {campaign?.campaignName || selectedLead.campaignName || '—'}
                        </div>
                      </div>
                    </div>
                    <div style={{ borderRight: '2px solid var(--border)', height: '8px', marginRight: '0.45rem' }} />
                    {/* Ad Set */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.75rem' }}>📦</span>
                      <div>
                        <div style={{ fontSize: '0.58rem', color: 'var(--foreground-muted)', fontWeight: 600 }}>קבוצת מודעות</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--foreground)', fontWeight: 600 }}>
                          {adSet?.name || selectedLead.adSetName || (selectedLead.adSetId ? '—' : <span style={{ color: 'var(--foreground-muted)', fontStyle: 'italic' }}>ללא שיוך</span>)}
                        </div>
                      </div>
                    </div>
                    <div style={{ borderRight: '2px solid var(--border)', height: '8px', marginRight: '0.45rem' }} />
                    {/* Ad */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.75rem' }}>🖼️</span>
                      <div>
                        <div style={{ fontSize: '0.58rem', color: 'var(--foreground-muted)', fontWeight: 600 }}>מודעה</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--foreground)', fontWeight: 600 }}>
                          {ad?.headline || ad?.name || selectedLead.adName || (selectedLead.adId ? '—' : <span style={{ color: 'var(--foreground-muted)', fontStyle: 'italic' }}>ללא שיוך</span>)}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setSelectedLead(null)}
                className="mod-btn-primary"
                style={{ width: '100%', padding: '0.55rem', fontSize: '0.82rem', fontWeight: 700, borderRadius: '0.5rem', cursor: 'pointer', marginTop: '1rem' }}
              >
                סגור
              </button>
            </div>
          );
        })()}
      </Modal>

      {/* Edit Campaign Modal */}
      <Modal open={showEditCampaignModal} onClose={() => setShowEditCampaignModal(false)} title="עריכת קמפיין">
        <div style={{ padding: '1.5rem', maxWidth: '500px' }}>
          <form onSubmit={handleSubmitEditCampaign} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>שם קמפיין</label>
              <input type="text" value={editCampaignForm.name} onChange={(e) => setEditCampaignForm({ ...editCampaignForm, name: e.target.value })} placeholder="שם הקמפיין" style={fieldStyle} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>מטרה / תיאור</label>
              <textarea value={editCampaignForm.objective} onChange={(e) => setEditCampaignForm({ ...editCampaignForm, objective: e.target.value })} placeholder="מטרת הקמפיין" rows={3} style={{ ...fieldStyle, resize: 'vertical' as const, minHeight: '60px', fontFamily: 'inherit' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>תקציב (₪)</label>
              <input type="number" value={editCampaignForm.budget} onChange={(e) => setEditCampaignForm({ ...editCampaignForm, budget: e.target.value })} placeholder="0" style={fieldStyle} />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '0.5rem' }}>
              <button type="submit" className="mod-btn-primary" style={{ flex: 1, padding: '0.6rem', fontSize: '0.85rem', fontWeight: 700, borderRadius: '0.5rem', cursor: 'pointer' }}>
                שמור
              </button>
              <button type="button" onClick={() => setShowEditCampaignModal(false)} className="mod-btn-ghost" style={{ flex: 1, padding: '0.6rem', fontSize: '0.85rem', fontWeight: 600, borderRadius: '0.5rem', cursor: 'pointer' }}>
                ביטול
              </button>
            </div>
          </form>
        </div>
      </Modal>

      {/* ── Activity Log Section ──────────────────────────────────── */}
      {activityEntries.length > 0 && (
        <div style={{ marginTop: '1.5rem', padding: '1rem', borderRadius: '0.75rem', background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--foreground)' }}>
            📋 פעילות אחרונה
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {activityEntries.slice(0, 8).map(entry => (
              <div key={entry.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.72rem', color: 'var(--foreground-muted)', padding: '0.3rem 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: '0.8rem' }}>
                  {entry.activityType === 'action_approved' ? '✅' : entry.activityType === 'action_rejected' ? '❌' : entry.activityType === 'action_executed' ? '🚀' : entry.activityType === 'draft_ad_created' ? '📝' : entry.activityType === 'action_generated' ? '⚡' : '📋'}
                </span>
                <span style={{ fontWeight: 600, color: 'var(--foreground)' }}>{entry.title}</span>
                <span style={{ marginRight: 'auto' }}>{new Date(entry.createdAt).toLocaleDateString('he-IL')} {new Date(entry.createdAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Auto Campaign Engine Panel ────────────────────────────── */}
      <div style={{ marginTop: '1.5rem', padding: '1rem', borderRadius: '0.75rem', background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 700, margin: 0, color: 'var(--foreground)' }}>
            🤖 מנוע אוטומטי
          </h3>
          <button
            onClick={handleAutoScan}
            disabled={autoScanning}
            className="mod-btn-ghost"
            style={{ fontSize: '0.68rem', padding: '0.25rem 0.5rem', fontWeight: 600, cursor: autoScanning ? 'wait' : 'pointer', opacity: autoScanning ? 0.6 : 1 }}
          >
            {autoScanning ? '⏳ סורק...' : '🔍 סרוק עכשיו'}
          </button>
        </div>

        {autoFindings.length === 0 && !autoScanning && (
          <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--foreground-muted)', fontSize: '0.78rem' }}>
            {hasPerformanceData ? '✅ לא זוהו בעיות — הקמפיין נראה תקין' : 'ממתין לנתוני ביצועים ממטא'}
          </div>
        )}

        {autoFindings.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {autoFindings.slice(0, 5).map(f => {
              const typeIcons: Record<string, string> = {
                creative_fatigue: '🎨', budget_waste: '💸', scale_opportunity: '📈',
                weak_audience: '🎯', winning_ad: '🏆', tracking_issue: '🔍',
              };
              const sevColors: Record<string, string> = {
                critical: '#dc2626', high: '#ef4444', medium: '#f59e0b', low: '#6b7280',
              };
              return (
                <div key={f.id} style={{
                  display: 'flex', alignItems: 'flex-start', gap: '0.5rem', padding: '0.5rem 0.6rem',
                  borderRadius: '0.5rem', background: 'var(--surface-sunken, var(--background))',
                  border: '1px solid var(--border)', fontSize: '0.72rem',
                }}>
                  <span style={{ fontSize: '0.85rem', flexShrink: 0, marginTop: '0.05rem' }}>{typeIcons[f.type] || '📋'}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.15rem' }}>
                      <span style={{ fontWeight: 700, color: 'var(--foreground)' }}>{f.adName || f.adSetName || ''}</span>
                      <span style={{
                        fontSize: '0.55rem', padding: '0.05rem 0.25rem', borderRadius: '999px',
                        background: `${sevColors[f.severity] || '#6b7280'}15`,
                        color: sevColors[f.severity] || '#6b7280', fontWeight: 600,
                      }}>
                        {f.severity === 'critical' ? 'קריטי' : f.severity === 'high' ? 'גבוה' : f.severity === 'medium' ? 'בינוני' : 'נמוך'}
                      </span>
                      <span style={{ fontSize: '0.6rem', color: 'var(--foreground-muted)' }}>ביטחון {f.confidence}%</span>
                    </div>
                    <div style={{ color: 'var(--foreground-muted)', lineHeight: 1.4 }}>{f.reason}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Variation Preview Modal ───────────────────────────────── */}
      {variationPreview.show && variationPreview.variation && variationPreview.ad && (
        <Modal open={variationPreview.show} onClose={() => setVariationPreview({ show: false, variation: null, ad: null, rec: null })} title="תצוגה מקדימה — וריאציה חדשה">
          <div style={{ direction: 'rtl' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '1rem', fontSize: '0.75rem', color: '#8b5cf6', fontWeight: 600 }}>
              {VARIATION_STRATEGY_META[variationPreview.variation.strategy]?.icon} אסטרטגיה: {VARIATION_STRATEGY_META[variationPreview.variation.strategy]?.label}
            </div>

            {/* Before / After comparison */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ padding: '0.75rem', borderRadius: '0.5rem', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#ef4444', marginBottom: '0.4rem' }}>מקור (לפני)</div>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>{variationPreview.ad.headline || '—'}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--foreground-muted)', whiteSpace: 'pre-wrap' }}>{(variationPreview.ad.primaryText || '').substring(0, 120)}</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--foreground-subtle)', marginTop: '0.3rem' }}>CTA: {variationPreview.ad.ctaType || '—'}</div>
              </div>
              <div style={{ padding: '0.75rem', borderRadius: '0.5rem', background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.15)' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#22c55e', marginBottom: '0.4rem' }}>וריאציה (אחרי)</div>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>{variationPreview.variation.newHeadline}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--foreground-muted)', whiteSpace: 'pre-wrap' }}>{variationPreview.variation.newPrimaryText.substring(0, 120)}</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--foreground-subtle)', marginTop: '0.3rem' }}>CTA: {variationPreview.variation.newCtaType || '—'}</div>
              </div>
            </div>

            {/* Explanation */}
            <div style={{ padding: '0.6rem', borderRadius: '0.375rem', background: 'var(--surface-sunken, var(--background))', fontSize: '0.72rem', color: 'var(--foreground-muted)', marginBottom: '1rem', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
              {variationPreview.variation.explanation}
            </div>

            {variationPreview.variation.newMediaSuggestion && (
              <div style={{ padding: '0.5rem', borderRadius: '0.375rem', background: 'rgba(59,130,246,0.06)', fontSize: '0.7rem', color: '#3b82f6', marginBottom: '1rem' }}>
                🖼️ {variationPreview.variation.newMediaSuggestion}
              </div>
            )}

            <p style={{ fontSize: '0.68rem', color: 'var(--foreground-subtle)', marginBottom: '0.75rem' }}>
              פעולה פנימית — טרם פורסם למטא
            </p>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="mod-btn-primary ux-btn ux-btn-glow" onClick={() => handleVariationSave(true)} style={{ flex: 1, padding: '0.5rem', fontSize: '0.8rem' }}>
                📤 שלח לאישור
              </button>
              <button className="mod-btn-ghost ux-btn" onClick={() => handleVariationSave(false)} style={{ flex: 1, padding: '0.5rem', fontSize: '0.8rem' }}>
                💾 שמור טיוטה
              </button>
              <button className="mod-btn-ghost ux-btn" onClick={() => setVariationPreview({ show: false, variation: null, ad: null, rec: null })} style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem', color: '#6b7280' }}>
                ביטול
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Publish to Meta Result Modal ──────────────────────────── */}
      {publishResult?.show && (
        <Modal open={publishResult.show} onClose={() => setPublishResult(null)} title={publishResult.success ? '🎉 פורסם בהצלחה' : '⚠️ תוצאות פרסום'}>
          <div style={{ direction: 'rtl', padding: '0.5rem' }}>
            <div style={{
              padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem',
              background: publishResult.success ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
              border: `1px solid ${publishResult.success ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
              fontSize: '0.82rem', fontWeight: 600,
              color: publishResult.success ? '#22c55e' : '#ef4444',
            }}>
              {publishResult.message}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {publishResult.results.map((r, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  fontSize: '0.72rem', padding: '0.4rem 0.5rem',
                  borderRadius: '0.375rem', background: 'var(--surface-sunken, var(--background))',
                  border: '1px solid var(--border)',
                }}>
                  <span>{r.success ? (r.skipped ? '⏭️' : '✅') : '❌'}</span>
                  <span style={{
                    fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase',
                    color: r.step === 'campaign' ? '#3b82f6' : r.step === 'adset' ? '#8b5cf6' : '#f59e0b',
                    minWidth: '4rem',
                  }}>
                    {r.step === 'campaign' ? 'קמפיין' : r.step === 'adset' ? 'קבוצה' : 'מודעה'}
                  </span>
                  <span style={{ fontWeight: 600, color: 'var(--foreground)', flex: 1 }}>{r.entity}</span>
                  {r.metaId && (
                    <span style={{ fontSize: '0.6rem', color: 'var(--foreground-muted)', fontFamily: 'monospace' }}>
                      {r.metaId.slice(0, 12)}...
                    </span>
                  )}
                  {r.error && (
                    <span style={{ fontSize: '0.65rem', color: '#ef4444' }}>{r.error}</span>
                  )}
                  {r.skipped && (
                    <span style={{ fontSize: '0.6rem', color: 'var(--foreground-muted)' }}>כבר קיים</span>
                  )}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button
                className="mod-btn-primary"
                onClick={() => setPublishResult(null)}
                style={{ flex: 1, padding: '0.5rem', fontSize: '0.8rem', borderRadius: '0.5rem', cursor: 'pointer' }}
              >
                סגור
              </button>
            </div>
          </div>
        </Modal>
      )}
    </main>
  );
}
