'use client';

/**
 * TabSeoGeo — Premium SEO/GEO Plans tab for Client profile.
 *
 * Shows plan cards with scores, progress, status, and actions.
 * Premium empty state with CTA to build a plan.
 * Design tokens: primary #00B5FE, accent #E8F401, bg #F7F9FC, cards white/20px radius.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

// ── Design tokens ──
const C = {
  primary: '#00B5FE',
  primaryDark: '#0095D0',
  primaryLight: '#E6F7FF',
  accent: '#E8F401',
  accentDark: '#C8D400',
  bg: '#F7F9FC',
  card: '#FFFFFF',
  text: '#1A1A2E',
  textSecondary: '#5A5A7A',
  textMuted: '#9A9AB0',
  border: '#E8EAF0',
  borderLight: '#F0F2F5',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#3B82F6',
};

interface SeoPlan {
  id: string;
  clientId: string;
  clientName: string;
  websiteUrl: string;
  status: string;
  overallScore: number;
  technicalScore: number;
  contentScore: number;
  visibilityScore: number;
  totalTasks: number;
  completedTasks: number;
  createdAt: string;
  updatedAt: string;
  generatedAt: string | null;
  // From wizard save
  websiteScan?: {
    scannedAt?: string;
    domainAuthority?: number;
    hasSSL?: boolean;
    loadTimeMs?: number;
  } | null;
  weeks?: any[];
  goals?: any[];
  insights?: any[];
}

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: 'טיוטה', color: '#6B7280', bg: '#F3F4F6' },
  scanning: { label: 'בסריקה', color: C.info, bg: `${C.info}12` },
  goals_set: { label: 'יעדים הוגדרו', color: C.warning, bg: `${C.warning}12` },
  visibility_done: { label: 'נראות הושלמה', color: C.primary, bg: `${C.primary}12` },
  insights_ready: { label: 'תובנות מוכנות', color: '#8B5CF6', bg: '#8B5CF612' },
  plan_generated: { label: 'תוכנית מוכנה', color: C.success, bg: `${C.success}12` },
  tasks_created: { label: 'משימות נוצרו', color: C.success, bg: `${C.success}12` },
  active: { label: 'פעיל', color: C.success, bg: `${C.success}12` },
  completed: { label: 'הושלם', color: C.primary, bg: `${C.primary}12` },
};

function formatDate(d: string | null | undefined): string {
  if (!d) return '—';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '—';
  const months = ['ינו', 'פבר', 'מרץ', 'אפר', 'מאי', 'יונ', 'יול', 'אוג', 'ספט', 'אוק', 'נוב', 'דצמ'];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

export default function TabSeoGeo({ client }: { client: any }) {
  const router = useRouter();
  const [plans, setPlans] = useState<SeoPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  const fetchPlans = useCallback(async () => {
    if (!client?.id) { setLoading(false); return; }
    try {
      const res = await fetch(`/api/data/seo-plans?clientId=${client.id}`);
      if (res.ok) {
        const result = await res.json();
        setPlans(Array.isArray(result) ? result : (result?.plans ?? []));
      }
    } catch (err) {
      console.error('Failed to fetch SEO plans:', err);
    }
    setLoading(false);
  }, [client?.id]);

  useEffect(() => { fetchPlans(); }, [fetchPlans]);

  const handleBuildPlan = () => {
    const params = new URLSearchParams();
    params.set('clientId', client.id);
    if (client.name) params.set('clientName', encodeURIComponent(client.name));
    if (client.websiteUrl) params.set('websiteUrl', encodeURIComponent(client.websiteUrl));
    router.push(`/seo-geo?${params.toString()}`);
  };

  const handleOpenPlan = (planId: string) => {
    router.push(`/seo-geo/${planId}`);
  };

  const handleGenerateReport = async (planId: string) => {
    router.push(`/seo-geo/${planId}/report?lang=he`);
  };

  // ── Loading state ──
  if (loading) {
    return (
      <div style={{ direction: 'rtl', padding: 32 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[1, 2].map(i => (
            <div key={i} style={{
              height: 200, borderRadius: 20, background: C.borderLight,
              animation: 'pulse 1.5s ease-in-out infinite',
            }} />
          ))}
        </div>
      </div>
    );
  }

  const hasPlans = plans.length > 0;

  return (
    <div style={{ direction: 'rtl', padding: 32, fontFamily: 'inherit' }}>
      {/* ── Header ── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        marginBottom: 28,
      }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: C.text, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              width: 36, height: 36, borderRadius: 10,
              background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18,
            }}>🔍</span>
            תוכניות SEO/GEO
          </h2>
          <p style={{ fontSize: 13, color: C.textMuted, margin: '6px 0 0 0' }}>
            {hasPlans
              ? `${plans.length} תוכניות · ניהול ומעקב צמיחה אורגנית ונראות AI`
              : 'בנה תוכנית צמיחה ראשונה ללקוח'}
          </p>
        </div>

        <button
          onClick={handleBuildPlan}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '12px 28px',
            background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`,
            color: '#fff', border: 'none', borderRadius: 12,
            fontSize: 14, fontWeight: 700, cursor: 'pointer',
            boxShadow: `0 4px 16px ${C.primary}40`,
            transition: 'all 0.2s',
          }}
        >
          <span style={{ fontSize: 16 }}>+</span>
          בנה תוכנית SEO/GEO
        </button>
      </div>

      {/* ── Plans grid or empty state ── */}
      {hasPlans ? (
        <>
          {/* Summary KPIs */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24,
          }}>
            {[
              { label: 'תוכניות', value: plans.length, icon: '📊', color: C.primary },
              { label: 'ציון ממוצע', value: plans.length > 0 ? Math.round(plans.reduce((s, p) => s + (p.overallScore || 0), 0) / plans.length) : 0, icon: '🎯', color: C.success, suffix: '%' },
              { label: 'משימות פעילות', value: plans.reduce((s, p) => s + ((p.totalTasks || 0) - (p.completedTasks || 0)), 0), icon: '📋', color: C.warning },
              { label: 'משימות שהושלמו', value: plans.reduce((s, p) => s + (p.completedTasks || 0), 0), icon: '✓', color: C.success },
            ].map((kpi, i) => (
              <div key={i} style={{
                background: C.card, borderRadius: 16, border: `1px solid ${C.border}`,
                padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14,
                boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: `${kpi.color}12`, color: kpi.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, flexShrink: 0,
                }}>{kpi.icon}</div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: C.text }}>
                    {kpi.value}{kpi.suffix || ''}
                  </div>
                  <div style={{ fontSize: 11, color: C.textMuted }}>{kpi.label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Plan cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {plans.map(plan => {
              const status = STATUS_MAP[plan.status] || STATUS_MAP.draft;
              const progress = plan.totalTasks > 0
                ? Math.round((plan.completedTasks / plan.totalTasks) * 100)
                : 0;
              const isHovered = hoveredCard === plan.id;
              const domain = plan.websiteUrl
                ? plan.websiteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')
                : '—';
              const lastScan = plan.websiteScan?.scannedAt || plan.generatedAt || plan.updatedAt;

              return (
                <div
                  key={plan.id}
                  onMouseEnter={() => setHoveredCard(plan.id)}
                  onMouseLeave={() => setHoveredCard(null)}
                  style={{
                    background: C.card, borderRadius: 20,
                    border: `1px solid ${isHovered ? `${C.primary}40` : C.border}`,
                    padding: 24,
                    boxShadow: isHovered ? `0 8px 24px ${C.primary}12` : '0 2px 8px rgba(0,0,0,0.03)',
                    transition: 'all 0.25s ease',
                    cursor: 'default',
                  }}
                >
                  {/* Top row: name + status + domain */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                        <h3 style={{ fontSize: 17, fontWeight: 700, color: C.text, margin: 0 }}>
                          {plan.clientName || 'תוכנית SEO/GEO'}
                        </h3>
                        <span style={{
                          fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 8,
                          background: status.bg, color: status.color,
                        }}>{status.label}</span>
                      </div>
                      <div style={{ fontSize: 13, color: C.textSecondary, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 14 }}>🌐</span> {domain}
                      </div>
                    </div>

                    {/* Dates */}
                    <div style={{ textAlign: 'left', fontSize: 11, color: C.textMuted, lineHeight: 1.8 }}>
                      <div>נוצר: {formatDate(plan.createdAt)}</div>
                      <div>סריקה אחרונה: {formatDate(lastScan)}</div>
                    </div>
                  </div>

                  {/* Scores row */}
                  <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20,
                  }}>
                    {[
                      { label: 'ציון כללי', value: plan.overallScore || 0, color: C.primary },
                      { label: 'טכני', value: plan.technicalScore || 0, color: C.info },
                      { label: 'תוכן', value: plan.contentScore || 0, color: C.warning },
                      { label: 'נראות GEO', value: plan.visibilityScore || 0, color: '#8B5CF6' },
                    ].map((score, i) => (
                      <div key={i} style={{
                        background: C.bg, borderRadius: 12, padding: '14px 16px', textAlign: 'center',
                      }}>
                        <div style={{ fontSize: 24, fontWeight: 800, color: score.color }}>
                          {score.value}<span style={{ fontSize: 12, fontWeight: 500 }}>%</span>
                        </div>
                        <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>{score.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Progress bar */}
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: C.textSecondary }}>
                        התקדמות: {plan.completedTasks || 0} / {plan.totalTasks || 0} משימות
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: progress >= 60 ? C.success : C.primary }}>
                        {progress}%
                      </span>
                    </div>
                    <div style={{
                      width: '100%', height: 6, background: C.borderLight,
                      borderRadius: 3, overflow: 'hidden',
                    }}>
                      <div style={{
                        height: '100%',
                        width: `${progress}%`,
                        background: progress >= 60
                          ? `linear-gradient(90deg, ${C.success}, #34D399)`
                          : `linear-gradient(90deg, ${C.primary}, ${C.accent})`,
                        borderRadius: 3,
                        transition: 'width 0.5s ease',
                      }} />
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      onClick={() => handleOpenPlan(plan.id)}
                      style={{
                        flex: 1, padding: '11px 20px',
                        background: C.primary, color: '#fff',
                        border: 'none', borderRadius: 10,
                        fontSize: 13, fontWeight: 600, cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      }}
                    >
                      <span style={{ fontSize: 14 }}>📋</span> פתח תוכנית
                    </button>
                    <button
                      onClick={() => handleGenerateReport(plan.id)}
                      style={{
                        flex: 1, padding: '11px 20px',
                        background: 'transparent',
                        border: `1px solid ${C.border}`,
                        borderRadius: 10,
                        fontSize: 13, fontWeight: 600, color: C.textSecondary,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      }}
                    >
                      <span style={{ fontSize: 14 }}>📄</span> הפק דוח
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        /* ── Empty state ── */
        <div style={{
          background: C.card, borderRadius: 24,
          border: `1px solid ${C.border}`,
          padding: '64px 40px', textAlign: 'center',
          boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
        }}>
          {/* Animated icon */}
          <div style={{
            width: 80, height: 80, borderRadius: 20, margin: '0 auto 24px',
            background: `linear-gradient(135deg, ${C.primaryLight}, ${C.bg})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 40,
          }}>🔍</div>

          <h3 style={{ fontSize: 20, fontWeight: 800, color: C.text, margin: '0 0 10px 0' }}>
            אין תוכניות SEO/GEO עדיין
          </h3>
          <p style={{
            fontSize: 14, color: C.textSecondary, margin: '0 auto 32px',
            maxWidth: 420, lineHeight: 1.7,
          }}>
            בנה תוכנית צמיחה מותאמת אישית ל-{client?.name || 'הלקוח'}.
            הכוללת סריקת אתר, בדיקת נראות במנועי AI, ותוכנית 60 יום עם משימות מפורטות.
          </p>

          {/* Feature highlights */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16,
            maxWidth: 560, margin: '0 auto 36px',
          }}>
            {[
              { icon: '🔍', label: 'סריקה טכנית', desc: 'SSL, מהירות, מטא' },
              { icon: '🤖', label: 'נראות AI', desc: '5 מנועי AI' },
              { icon: '📋', label: 'תוכנית 60 יום', desc: 'משימות יומיות' },
            ].map((f, i) => (
              <div key={i} style={{
                background: C.bg, borderRadius: 14, padding: '16px 12px',
                border: `1px solid ${C.borderLight}`,
              }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>{f.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{f.label}</div>
                <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{f.desc}</div>
              </div>
            ))}
          </div>

          <button
            onClick={handleBuildPlan}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '14px 40px',
              background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`,
              color: '#fff', border: 'none', borderRadius: 14,
              fontSize: 16, fontWeight: 700, cursor: 'pointer',
              boxShadow: `0 4px 20px ${C.primary}40`,
              transition: 'all 0.2s',
            }}
          >
            <span style={{ fontSize: 18 }}>+</span>
            בנה תוכנית SEO/GEO
          </button>

          {!client?.websiteUrl && (
            <p style={{ fontSize: 12, color: C.textMuted, marginTop: 16 }}>
              * אם לא הוגדר אתר ללקוח, תתבקש להזין כתובת אתר בתחילת האשף
            </p>
          )}
        </div>
      )}
    </div>
  );
}
