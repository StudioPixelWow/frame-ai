'use client';

import { useSearchParams } from 'next/navigation';
import {
  useClients,
  useApprovals,
  useLeads,
  useCampaigns,
  useAds,
  useAdSets,
  useActivities,
  useClientNotifications,
} from '@/lib/api/use-entity';
import { useMemo, useState, useCallback, useEffect, Suspense } from 'react';

/* ═══════════════════════════════════════════════
   CSS — Apple-level micro-interactions
   ═══════════════════════════════════════════════ */
const STYLES = `
  @keyframes clientFadeIn {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes clientPulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
  @keyframes clientStatusDot {
    0%, 100% { box-shadow: 0 0 0 0 currentColor; }
    50% { box-shadow: 0 0 0 4px transparent; }
  }
  .client-fade-in {
    animation: clientFadeIn 0.5s ease-out both;
  }
  .client-fade-in-d1 { animation-delay: 0.05s; }
  .client-fade-in-d2 { animation-delay: 0.1s; }
  .client-fade-in-d3 { animation-delay: 0.15s; }
  .client-fade-in-d4 { animation-delay: 0.2s; }
  .client-fade-in-d5 { animation-delay: 0.25s; }
  .client-skeleton {
    background: linear-gradient(90deg, var(--border) 25%, transparent 50%, var(--border) 75%);
    background-size: 200% 100%;
    animation: clientPulse 1.5s ease-in-out infinite;
    border-radius: 0.5rem;
  }
  .client-card {
    background: var(--surface);
    border: 1px solid rgba(0,0,0,0.06);
    border-radius: 1rem;
    transition: transform 0.25s cubic-bezier(0.25,0.46,0.45,0.94),
                box-shadow 0.25s cubic-bezier(0.25,0.46,0.45,0.94),
                border-color 0.25s ease;
  }
  .client-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(0,0,0,0.06);
    border-color: rgba(0,0,0,0.1);
  }
  .client-btn {
    transition: all 0.2s cubic-bezier(0.25,0.46,0.45,0.94);
  }
  .client-btn:hover {
    transform: scale(1.02);
  }
  .client-btn:active {
    transform: scale(0.98);
  }
`;

/* ── Helpers ── */
function formatRelativeDate(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) {
    const hours = Math.floor(diff / 3600000);
    if (hours === 0) return 'ממש עכשיו';
    return `לפני ${hours} שעות`;
  }
  if (days === 1) return 'אתמול';
  if (days < 7) return `לפני ${days} ימים`;
  return new Date(dateStr).toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });
}

/* ── Status Logic ── */
function getClientStatus(pending: number, active: number) {
  if (pending > 3) return { text: 'דורש תשומת לב', color: '#f59e0b', bg: 'rgba(245,158,11,0.06)' };
  if (active === 0) return { text: 'יש הזדמנויות לשיפור', color: '#3b82f6', bg: 'rgba(59,130,246,0.06)' };
  return { text: 'הכל מתקדם מצוין', color: '#22c55e', bg: 'rgba(34,197,94,0.06)' };
}

/* ── Skeleton ── */
function SkeletonBlock({ w, h }: { w: string; h: string }) {
  return <div className="client-skeleton" style={{ width: w, height: h }} />;
}

function SkeletonCards() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
      {[1,2,3,4].map(i => (
        <div key={i} style={{ padding: '1.5rem', borderRadius: '1rem', border: '1px solid var(--border)' }}>
          <SkeletonBlock w="60%" h="0.8rem" />
          <div style={{ marginTop: '0.75rem' }}><SkeletonBlock w="40%" h="1.5rem" /></div>
          <div style={{ marginTop: '0.5rem' }}><SkeletonBlock w="80%" h="0.65rem" /></div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   MAIN DASHBOARD
   ═══════════════════════════════════════════════ */
function DashboardContentInner() {
  const searchParams = useSearchParams();
  const clientId = searchParams.get('clientId');

  const { data: clients, loading: clientsLoading } = useClients();
  const { data: approvals } = useApprovals();
  const { data: leads } = useLeads();
  const { data: campaigns } = useCampaigns();
  const { data: allAds } = useAds();
  const { data: adSets } = useAdSets();
  const { data: activities } = useActivities();
  const { data: notifications } = useClientNotifications();

  const [showNotifs, setShowNotifs] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const client = useMemo(() => clients.find(c => c.id === clientId), [clients, clientId]);

  const clientCampaigns = useMemo(() => campaigns.filter((c: any) => c.clientId === clientId), [campaigns, clientId]);
  const activeCampaigns = useMemo(() => clientCampaigns.filter((c: any) => c.status === 'active'), [clientCampaigns]);
  const clientLeads = useMemo(() => leads.filter(l => l.convertedClientId === clientId || l.clientId === clientId), [leads, clientId]);
  const clientAds = useMemo(() => {
    const cmpIds = clientCampaigns.map(c => c.id);
    const asIds = adSets.filter(as => cmpIds.includes(as.campaignId)).map(as => as.id);
    return allAds.filter(a => asIds.includes(a.adSetId));
  }, [allAds, adSets, clientCampaigns]);

  const pendingApprovals = useMemo(() => approvals.filter(a => a.status === 'pending_approval'), [approvals]);

  const clientNotifs = useMemo(() =>
    notifications.filter(n => n.clientId === clientId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [notifications, clientId]);
  const unreadCount = useMemo(() => clientNotifs.filter(n => !n.read).length, [clientNotifs]);

  const recentActivities = useMemo(() => {
    const weekAgo = Date.now() - 7 * 86400000;
    return [...activities]
      .filter(a => new Date(a.createdAt).getTime() > weekAgo)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 6);
  }, [activities]);

  const kpis = useMemo(() => {
    const totalSpend = activeCampaigns.reduce((s: number, c: any) => s + (c.spend || 0), 0);
    const totalLeads = clientLeads.length;
    const cpl = totalLeads > 0 ? totalSpend / totalLeads : 0;
    let bestAd = null as any;
    let bestCtr = 0;
    for (const ad of clientAds) {
      const a = ad as any;
      const ctr = a.ctr || (a.impressions > 0 ? (a.clicks / a.impressions) * 100 : 0);
      if (ctr > bestCtr) { bestCtr = ctr; bestAd = a; }
    }
    return { totalSpend, totalLeads, cpl, bestAd };
  }, [activeCampaigns, clientLeads, clientAds]);

  const topAds = useMemo(() =>
    [...clientAds].sort((a: any, b: any) => {
      const cA = a.ctr || (a.impressions > 0 ? (a.clicks / a.impressions) * 100 : 0);
      const cB = b.ctr || (b.impressions > 0 ? (b.clicks / b.impressions) * 100 : 0);
      return cB - cA;
    }).slice(0, 3),
    [clientAds]);

  const markAllRead = useCallback(async () => {
    const unread = clientNotifs.filter(n => !n.read);
    if (!unread.length) return;
    try {
      await fetch('/api/data/client-notifications', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: unread.map(n => n.id), read: true }),
      });
    } catch {}
  }, [clientNotifs]);

  /* ── Loading ── */
  if (clientsLoading) {
    return (
      <div style={{ maxWidth: '900px', margin: '0 auto', direction: 'rtl' }}>
        <style>{STYLES}</style>
        <div style={{ padding: '2rem 0' }}>
          <SkeletonBlock w="200px" h="1.5rem" />
          <div style={{ marginTop: '0.5rem' }}><SkeletonBlock w="140px" h="0.9rem" /></div>
          <div style={{ marginTop: '2rem' }}><SkeletonCards /></div>
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div style={{ textAlign: 'center', padding: '5rem 1rem', direction: 'rtl' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '1rem', opacity: 0.5 }}>🔍</div>
        <p style={{ color: 'var(--foreground-muted)', fontSize: '1rem' }}>לא נמצא לקוח</p>
      </div>
    );
  }

  const color = client.color || '#00B5FE';
  const initials = client.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2);
  const status = getClientStatus(pendingApprovals.length, activeCampaigns.length);
  const now = new Date();

  return (
    <div style={{ direction: 'rtl', maxWidth: '900px', margin: '0 auto', position: 'relative' }}>
      <style>{STYLES}</style>

      {/* ══════════════════════════════════════
          HERO HEADER
          ══════════════════════════════════════ */}
      <div className={mounted ? 'client-fade-in' : ''} style={{
        padding: '2.5rem 0 2rem', marginBottom: '0.5rem',
      }}>
        {/* Notification Bell — top left */}
        <div style={{ position: 'absolute', top: '2rem', left: 0 }}>
          <button
            onClick={() => { setShowNotifs(!showNotifs); if (!showNotifs) markAllRead(); }}
            className="client-btn"
            style={{
              background: 'var(--surface)', border: '1px solid rgba(0,0,0,0.06)',
              borderRadius: '0.875rem', width: '2.75rem', height: '2.75rem',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', fontSize: '1.1rem', position: 'relative',
              boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
            }}
          >
            🔔
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute', top: '-3px', right: '-3px',
                background: '#ef4444', color: '#fff', fontSize: '0.55rem', fontWeight: 800,
                width: '16px', height: '16px', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 6px rgba(239,68,68,0.3)',
              }}>{unreadCount > 9 ? '9+' : unreadCount}</span>
            )}
          </button>

          {showNotifs && (
            <div className="client-fade-in" style={{
              position: 'absolute', top: '3.25rem', left: 0, zIndex: 50,
              width: '320px', maxHeight: '380px', overflowY: 'auto',
              background: 'var(--surface)', border: '1px solid rgba(0,0,0,0.06)',
              borderRadius: '1rem', boxShadow: '0 12px 40px rgba(0,0,0,0.1)',
            }}>
              <div style={{ padding: '0.85rem 1.15rem', borderBottom: '1px solid rgba(0,0,0,0.05)', fontWeight: 700, fontSize: '0.85rem' }}>
                התראות
              </div>
              {clientNotifs.length > 0 ? clientNotifs.slice(0, 8).map(n => (
                <div key={n.id} style={{
                  padding: '0.75rem 1.15rem', borderBottom: '1px solid rgba(0,0,0,0.03)',
                  background: n.read ? 'transparent' : 'rgba(0,181,254,0.03)',
                  transition: 'background 0.2s',
                }}>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '1rem', marginTop: '0.1rem' }}>{n.icon || '📌'}</span>
                    <div>
                      <div style={{ fontSize: '0.8rem', fontWeight: 600, lineHeight: 1.4 }}>{n.title}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--foreground-muted)', marginTop: '0.1rem' }}>{n.body}</div>
                      <div style={{ fontSize: '0.62rem', color: 'var(--foreground-subtle)', marginTop: '0.2rem' }}>{formatRelativeDate(n.createdAt)}</div>
                    </div>
                  </div>
                </div>
              )) : (
                <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--foreground-muted)', fontSize: '0.8rem' }}>
                  אין התראות חדשות
                </div>
              )}
            </div>
          )}
        </div>

        {/* Name + Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          {client.logoUrl ? (
            <img src={client.logoUrl} alt="" style={{
              height: '3.5rem', width: '3.5rem', borderRadius: '1rem', objectFit: 'cover',
              border: '1px solid rgba(0,0,0,0.06)',
            }} onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
          ) : (
            <div style={{
              width: '3.5rem', height: '3.5rem', borderRadius: '1rem',
              background: `${color}10`, color, fontWeight: 800, fontSize: '1rem',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{initials}</div>
          )}
          <div>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
              שלום, {client.contactPerson || client.name}
            </h1>
            <p style={{ fontSize: '0.85rem', color: 'var(--foreground-muted)', margin: '0.2rem 0 0 0' }}>
              {client.company || client.name}
            </p>
          </div>
        </div>

        {/* Status Bubble */}
        <div className={mounted ? 'client-fade-in client-fade-in-d1' : ''} style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.4rem', marginTop: '1rem',
          background: status.bg, padding: '0.45rem 1rem', borderRadius: '999px',
        }}>
          <span style={{
            width: '7px', height: '7px', borderRadius: '50%', background: status.color,
            animation: 'clientStatusDot 2s ease infinite', color: status.color,
          }} />
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: status.color }}>{status.text}</span>
          <span style={{ fontSize: '0.72rem', color: 'var(--foreground-muted)', marginRight: '0.25rem' }}>
            · {activeCampaigns.length} קמפיינים · {kpis.totalLeads} לידים
          </span>
        </div>
      </div>

      {/* ══════════════════════════════════════
          PENDING APPROVALS (if any)
          ══════════════════════════════════════ */}
      {pendingApprovals.length > 0 && (
        <div className={mounted ? 'client-fade-in client-fade-in-d2' : ''} style={{ marginBottom: '2rem' }}>
          <a href={`/client-portal/approvals?clientId=${clientId}`} className="client-card" style={{
            display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.15rem 1.5rem',
            textDecoration: 'none', color: 'var(--foreground)',
            background: 'rgba(251,191,36,0.04)', borderColor: 'rgba(251,191,36,0.15)',
          }}>
            <span style={{ fontSize: '1.35rem' }}>✋</span>
            <div style={{ flex: 1 }}>
              <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                {pendingApprovals.length === 1 ? 'פריט אחד ממתין לאישורך' : `${pendingApprovals.length} פריטים ממתינים לאישורך`}
              </span>
            </div>
            <span style={{ fontSize: '0.8rem', color: '#f59e0b', fontWeight: 600 }}>צפה ←</span>
          </a>
        </div>
      )}

      {/* ══════════════════════════════════════
          KPI STRIP
          ══════════════════════════════════════ */}
      <div className={mounted ? 'client-fade-in client-fade-in-d2' : ''} style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '2.5rem',
      }}>
        {[
          { icon: '🎯', val: String(kpis.totalLeads), label: 'לידים שהתקבלו', sub: kpis.totalLeads > 0 ? 'מכל הקמפיינים' : 'עדיין לא הגיעו — נעבוד על זה' },
          { icon: '💰', val: kpis.cpl > 0 ? `₪${kpis.cpl.toFixed(0)}` : '—', label: 'עלות לליד', sub: kpis.cpl > 0 ? (kpis.cpl < 50 ? 'עלות טובה מאוד' : kpis.cpl < 100 ? 'בטווח הנורמלי' : 'עובדים על הורדה') : 'אין מספיק נתונים' },
          { icon: '📊', val: kpis.totalSpend > 0 ? `₪${kpis.totalSpend.toLocaleString('he-IL')}` : '—', label: 'הוצאה כוללת', sub: kpis.totalSpend > 0 ? 'סה״כ השקעה פעילה' : 'לא התחלנו עדיין' },
          { icon: '⭐', val: kpis.bestAd ? (kpis.bestAd.name || kpis.bestAd.headline || '✓').slice(0, 18) : '—', label: 'מודעה מובילה', sub: kpis.bestAd ? 'מביאה את התוצאות הכי טובות' : 'נזהה בקרוב' },
        ].map((kpi, i) => (
          <div key={i} className="client-card" style={{ padding: '1.25rem 1rem', textAlign: 'center' }}>
            <div style={{ fontSize: '1.35rem', marginBottom: '0.65rem' }}>{kpi.icon}</div>
            <div style={{
              fontSize: i === 3 ? '0.95rem' : '1.5rem', fontWeight: 800, letterSpacing: '-0.02em',
              color: 'var(--foreground)', marginBottom: '0.25rem', lineHeight: 1.2,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{kpi.val}</div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--foreground-muted)', marginBottom: '0.15rem' }}>{kpi.label}</div>
            <div style={{ fontSize: '0.65rem', color: 'var(--foreground-subtle)', lineHeight: 1.4 }}>{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* ══════════════════════════════════════
          "מה עשינו בשבילך השבוע"
          ══════════════════════════════════════ */}
      <div className={mounted ? 'client-fade-in client-fade-in-d3' : ''} style={{ marginBottom: '2.5rem' }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 1rem 0', letterSpacing: '-0.01em' }}>
          מה עשינו בשבילך השבוע
        </h2>
        {recentActivities.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {recentActivities.map((activity, idx) => {
              const iconMap: Record<string, string> = {
                campaign_created: '🚀', ad_created: '🎨', optimization: '⚡',
                approval: '✅', recommendation: '💡', report: '📊',
              };
              return (
                <div key={activity.id} className="client-card" style={{
                  display: 'flex', gap: '0.85rem', padding: '1rem 1.25rem', alignItems: 'center',
                  animationDelay: `${0.15 + idx * 0.04}s`,
                }}>
                  <div style={{
                    width: '2.25rem', height: '2.25rem', borderRadius: '0.65rem',
                    background: 'rgba(0,181,254,0.06)', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: '1rem', flexShrink: 0,
                  }}>
                    {iconMap[(activity as any).type] || activity.icon || '📌'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', lineHeight: 1.3 }}>
                      {(activity as any).clientFriendlyTitle || activity.title}
                    </div>
                    {activity.description && (
                      <div style={{ fontSize: '0.73rem', color: 'var(--foreground-muted)', marginTop: '0.1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {activity.description}
                      </div>
                    )}
                  </div>
                  <span style={{ fontSize: '0.68rem', color: 'var(--foreground-subtle)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {formatRelativeDate(activity.createdAt)}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="client-card" style={{ padding: '3rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.75rem', opacity: 0.7 }}>🌱</div>
            <p style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--foreground-muted)', margin: '0 0 0.2rem 0' }}>
              אנחנו רק מתחילים
            </p>
            <p style={{ fontSize: '0.8rem', color: 'var(--foreground-subtle)', margin: 0 }}>
              בקרוב תראה כאן את כל מה שעשינו בשבילך
            </p>
          </div>
        )}
        <a href={`/client-portal/timeline?clientId=${clientId}`} className="client-btn" style={{
          display: 'block', textAlign: 'center', marginTop: '0.85rem',
          fontSize: '0.8rem', color, fontWeight: 600, textDecoration: 'none',
          padding: '0.5rem', borderRadius: '0.5rem',
        }}>
          צפה בכל הפעילות ←
        </a>
      </div>

      {/* ══════════════════════════════════════
          TOP ADS
          ══════════════════════════════════════ */}
      {topAds.length > 0 && (
        <div className={mounted ? 'client-fade-in client-fade-in-d4' : ''} style={{ marginBottom: '2.5rem' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 1rem 0', letterSpacing: '-0.01em' }}>
            מודעות מובילות
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
            {topAds.map((ad: any, idx) => {
              const ctr = ad.ctr || (ad.impressions > 0 ? (ad.clicks / ad.impressions) * 100 : 0);
              const perfLabel = ctr > 3 ? 'ביצועים מצוינים' : ctr > 1.5 ? 'ביצועים טובים' : 'פעילה';
              const perfColor = ctr > 3 ? '#22c55e' : ctr > 1.5 ? '#3b82f6' : '#6b7280';
              return (
                <div key={ad.id} className="client-card" style={{ overflow: 'hidden' }}>
                  {(ad.imageUrl || ad.thumbnailUrl) && (
                    <div style={{ height: '130px', overflow: 'hidden', background: 'rgba(0,0,0,0.02)' }}>
                      <img src={ad.imageUrl || ad.thumbnailUrl} alt="" style={{
                        width: '100%', height: '100%', objectFit: 'cover',
                        transition: 'transform 0.4s ease',
                      }} onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
                    </div>
                  )}
                  <div style={{ padding: '1rem 1.15rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{
                        fontSize: '0.62rem', fontWeight: 700, padding: '0.2rem 0.55rem', borderRadius: '999px',
                        background: `${perfColor}08`, color: perfColor,
                      }}>{perfLabel}</span>
                      {idx === 0 && <span style={{ fontSize: '0.85rem' }}>🏆</span>}
                    </div>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', lineHeight: 1.3, marginBottom: '0.25rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ad.name || ad.headline || 'מודעה'}
                    </div>
                    {(ad.primaryText || ad.description) && (
                      <div style={{ fontSize: '0.72rem', color: 'var(--foreground-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {(ad.primaryText || ad.description || '').slice(0, 55)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════
          AI RECOMMENDATIONS
          ══════════════════════════════════════ */}
      <div className={mounted ? 'client-fade-in client-fade-in-d5' : ''} style={{ marginBottom: '2.5rem' }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 1rem 0', letterSpacing: '-0.01em' }}>
          מה מומלץ לעשות עכשיו
        </h2>
        {activeCampaigns.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {activeCampaigns.slice(0, 3).map((campaign: any) => {
              const cLeads = clientLeads.filter(l => l.campaignId === campaign.id).length;
              const spend = campaign.spend || 0;
              const cpl = cLeads > 0 ? spend / cLeads : 0;

              let text = '', action = '', icon = '💡';
              if (cpl > 100 && cLeads > 0) {
                text = `העלות לליד בקמפיין "${campaign.name}" גבוהה מהרגיל — עובדים על הורדה`;
                action = 'בדוק'; icon = '🔍';
              } else if (cLeads === 0 && spend > 50) {
                text = `קמפיין "${campaign.name}" עדיין לא הביא לידים — נבדוק ונשפר`;
                action = 'בדוק'; icon = '⚠️';
              } else if (cLeads > 5) {
                text = `קמפיין "${campaign.name}" מביא תוצאות יפות — שווה לשקול להגדיל תקציב`;
                action = 'אשר שינוי'; icon = '🚀';
              } else {
                text = `קמפיין "${campaign.name}" פעיל ועובד — ממשיכים לעקוב`;
                action = 'בסדר'; icon = '✅';
              }

              return (
                <div key={campaign.id} className="client-card" style={{
                  display: 'flex', alignItems: 'center', gap: '0.85rem', padding: '1rem 1.25rem',
                }}>
                  <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>{icon}</span>
                  <div style={{ flex: 1, fontSize: '0.85rem', lineHeight: 1.5 }}>{text}</div>
                  <button className="client-btn" style={{
                    padding: '0.4rem 0.85rem', borderRadius: '0.6rem',
                    border: '1px solid rgba(0,0,0,0.08)', background: 'var(--surface)',
                    color: 'var(--foreground)', fontSize: '0.78rem', fontWeight: 600,
                    cursor: 'pointer', whiteSpace: 'nowrap',
                  }}>
                    {action}
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="client-card" style={{ padding: '3rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.75rem', opacity: 0.7 }}>💡</div>
            <p style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--foreground-muted)', margin: '0 0 0.2rem 0' }}>
              המלצות מותאמות אישית
            </p>
            <p style={{ fontSize: '0.8rem', color: 'var(--foreground-subtle)', margin: 0 }}>
              ברגע שהקמפיינים יתחילו לעבוד, נציג כאן רעיונות לשיפור
            </p>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════
          REPORTS + QUICK NAV
          ══════════════════════════════════════ */}
      <div className={mounted ? 'client-fade-in client-fade-in-d5' : ''} style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', marginBottom: '2.5rem',
      }}>
        {[
          { label: 'פעילות', href: 'timeline', icon: '📋' },
          { label: 'אישורים', href: 'approvals', icon: '✅' },
          { label: 'דוחות', href: 'reports', icon: '📊' },
          { label: 'לידים', href: 'leads', icon: '🎯' },
        ].map(link => (
          <a key={link.href} href={`/client-portal/${link.href}?clientId=${clientId}`}
            className="client-card client-btn"
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem',
              padding: '1rem 0.5rem', textDecoration: 'none', color: 'var(--foreground)',
              fontSize: '0.82rem', fontWeight: 600,
            }}
          >
            <span style={{ fontSize: '1.2rem' }}>{link.icon}</span>
            {link.label}
          </a>
        ))}
      </div>

      {/* Footer */}
      <div style={{
        textAlign: 'center', padding: '1.5rem 0',
        borderTop: '1px solid rgba(0,0,0,0.04)',
        color: 'var(--foreground-subtle)', fontSize: '0.7rem',
      }}>
        Studio Pixel &copy; {now.getFullYear()}
      </div>
    </div>
  );
}

export default function DashboardContent() {
  return (
    <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center' }}>...טוען</div>}>
      <DashboardContentInner />
    </Suspense>
  );
}
