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
import { useMemo, useState, useCallback, Suspense } from 'react';
import type { ClientNotification } from '@/lib/db/schema';

/* ── Helper ── */
function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) {
    const hours = Math.floor(diff / 3600000);
    if (hours === 0) return 'ממש עכשיו';
    return `לפני ${hours} שעות`;
  }
  if (days === 1) return 'אתמול';
  if (days < 7) return `לפני ${days} ימים`;
  return date.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });
}

function friendlyMetric(label: string, value: string | number): string {
  // Client-friendly language — no technical jargon
  const map: Record<string, string> = {
    cpl: 'עלות ממוצעת לליד',
    ctr: 'אחוז הקלקות',
    spend: 'סה״כ הוצאה',
    leads: 'לידים שהתקבלו',
  };
  return map[label] || label;
}

/* ── Status logic ── */
function getClientStatus(pendingApprovals: number, activeCampaigns: number, leadsThisWeek: number): {
  text: string; color: string; bg: string;
} {
  if (pendingApprovals > 3) return { text: 'דורש תשומת לב', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)' };
  if (activeCampaigns === 0) return { text: 'יש הזדמנויות לשיפור', color: '#3b82f6', bg: 'rgba(59,130,246,0.08)' };
  return { text: 'הכל מתקדם כרגיל', color: '#22c55e', bg: 'rgba(34,197,94,0.08)' };
}

/* ══════════════════════════════════════════════
   MAIN DASHBOARD
   ══════════════════════════════════════════════ */
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
  const { data: notifications, update: updateNotification } = useClientNotifications();

  const [showNotifications, setShowNotifications] = useState(false);

  const client = useMemo(() => clients.find(c => c.id === clientId), [clients, clientId]);

  // Scoped data
  const clientCampaigns = useMemo(() => campaigns.filter((c: any) => c.clientId === clientId), [campaigns, clientId]);
  const activeCampaigns = useMemo(() => clientCampaigns.filter((c: any) => c.status === 'active'), [clientCampaigns]);
  const clientLeads = useMemo(() => leads.filter(l => l.convertedClientId === clientId || l.clientId === clientId), [leads, clientId]);
  const clientAds = useMemo(() => {
    const campaignIds = clientCampaigns.map(c => c.id);
    const clientAdSetIds = adSets.filter(as => campaignIds.includes(as.campaignId)).map(as => as.id);
    return allAds.filter(a => clientAdSetIds.includes(a.adSetId));
  }, [allAds, adSets, clientCampaigns]);
  const pendingApprovals = useMemo(() => approvals.filter(a => a.status === 'pending_approval'), [approvals]);
  const clientNotifs = useMemo(() =>
    notifications.filter(n => n.clientId === clientId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [notifications, clientId]
  );
  const unreadCount = useMemo(() => clientNotifs.filter(n => !n.read).length, [clientNotifs]);

  // Recent activities (last 7 days)
  const recentActivities = useMemo(() => {
    const weekAgo = Date.now() - 7 * 86400000;
    return [...activities]
      .filter(a => new Date(a.createdAt).getTime() > weekAgo)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 8);
  }, [activities]);

  // Performance KPIs
  const kpis = useMemo(() => {
    const totalSpend = activeCampaigns.reduce((s: number, c: any) => s + (c.spend || 0), 0);
    const totalLeads = clientLeads.length;
    const cpl = totalLeads > 0 ? totalSpend / totalLeads : 0;
    // Best ad by CTR
    let bestAd = null as any;
    let bestCtr = 0;
    for (const ad of clientAds) {
      const a = ad as any;
      const ctr = a.ctr || (a.impressions > 0 ? (a.clicks / a.impressions) * 100 : 0);
      if (ctr > bestCtr) { bestCtr = ctr; bestAd = a; }
    }
    return { totalSpend, totalLeads, cpl, bestAd, bestCtr };
  }, [activeCampaigns, clientLeads, clientAds]);

  // Top performing ads
  const topAds = useMemo(() => {
    return [...clientAds]
      .sort((a: any, b: any) => {
        const ctrA = a.ctr || (a.impressions > 0 ? (a.clicks / a.impressions) * 100 : 0);
        const ctrB = b.ctr || (b.impressions > 0 ? (b.clicks / b.impressions) * 100 : 0);
        return ctrB - ctrA;
      })
      .slice(0, 3);
  }, [clientAds]);

  // Mark notifications read
  const markAllRead = useCallback(async () => {
    const unread = clientNotifs.filter(n => !n.read);
    if (unread.length === 0) return;
    try {
      await fetch('/api/data/client-notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: unread.map(n => n.id), read: true }),
      });
    } catch {}
  }, [clientNotifs]);

  // ── Loading / Not Found ──
  if (clientsLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
        <div style={{ fontSize: '2rem', marginBottom: '1rem', animation: 'pulse 1.5s infinite' }}>✨</div>
        <p style={{ color: 'var(--foreground-muted)', fontSize: '0.9rem' }}>טוען את הפורטל שלך...</p>
      </div>
    );
  }

  if (!client) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔍</div>
        <p style={{ color: 'var(--foreground-muted)' }}>לא נמצא לקוח</p>
      </div>
    );
  }

  const color = client.color || '#00B5FE';
  const initials = client.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2);
  const status = getClientStatus(pendingApprovals.length, activeCampaigns.length, kpis.totalLeads);
  const now = new Date();

  return (
    <div style={{ direction: 'rtl', maxWidth: '900px', margin: '0 auto' }}>

      {/* ═══════════════════════════════════════
          PREMIUM HEADER
          ═══════════════════════════════════════ */}
      <div style={{
        background: `linear-gradient(135deg, ${color}06, ${color}12)`,
        border: `1px solid ${color}20`,
        borderRadius: '1.25rem',
        padding: '2rem 2rem 1.75rem',
        marginBottom: '1.5rem',
        position: 'relative',
      }}>
        {/* Notification Bell */}
        <button
          onClick={() => { setShowNotifications(!showNotifications); if (!showNotifications) markAllRead(); }}
          style={{
            position: 'absolute', top: '1.25rem', left: '1.25rem',
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: '0.75rem', width: '2.75rem', height: '2.75rem',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', fontSize: '1.1rem', transition: 'all 200ms',
          }}
        >
          🔔
          {unreadCount > 0 && (
            <span style={{
              position: 'absolute', top: '-4px', right: '-4px',
              background: '#ef4444', color: '#fff', fontSize: '0.6rem', fontWeight: 800,
              width: '18px', height: '18px', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{unreadCount > 9 ? '9+' : unreadCount}</span>
          )}
        </button>

        {/* Notification Dropdown */}
        {showNotifications && (
          <div style={{
            position: 'absolute', top: '4.5rem', left: '1.25rem', zIndex: 50,
            width: '320px', maxHeight: '400px', overflowY: 'auto',
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: '0.75rem', boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
          }}>
            <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: '0.85rem' }}>
              התראות
            </div>
            {clientNotifs.length > 0 ? clientNotifs.slice(0, 10).map(n => (
              <div key={n.id} style={{
                padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)',
                background: n.read ? 'transparent' : 'rgba(0,181,254,0.04)',
              }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '1rem' }}>{n.icon || '📌'}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>{n.title}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--foreground-muted)', marginTop: '0.15rem' }}>{n.body}</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--foreground-subtle)', marginTop: '0.25rem' }}>{formatRelativeDate(n.createdAt)}</div>
                  </div>
                </div>
              </div>
            )) : (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--foreground-muted)', fontSize: '0.8rem' }}>
                אין התראות חדשות
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          {client.logoUrl ? (
            <img src={client.logoUrl} alt={client.company || client.name} style={{
              height: '4rem', width: '4rem', borderRadius: '1rem', objectFit: 'cover',
              border: `2px solid ${color}25`,
            }} onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
          ) : (
            <div style={{
              width: '4rem', height: '4rem', borderRadius: '1rem',
              background: `${color}15`, border: `2px solid ${color}25`, color,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: '1.15rem',
            }}>{initials}</div>
          )}
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 0.2rem 0', letterSpacing: '-0.01em' }}>
              שלום, {client.contactPerson || client.name}
            </h1>
            <p style={{ fontSize: '0.85rem', color: 'var(--foreground-muted)', margin: '0 0 0.5rem 0' }}>
              {client.company || client.name}
            </p>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                fontSize: '0.75rem', fontWeight: 600, color: status.color,
                background: status.bg, padding: '0.3rem 0.75rem', borderRadius: '999px',
              }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: status.color }} />
                {status.text}
              </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--foreground-muted)' }}>
                {activeCampaigns.length} קמפיינים פעילים
              </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--foreground-muted)' }}>
                {kpis.totalLeads} לידים החודש
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════
          D. PENDING APPROVALS
          ═══════════════════════════════════════ */}
      {pendingApprovals.length > 0 && (
        <div style={{
          background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)',
          borderRadius: '1rem', padding: '1.25rem', marginBottom: '1.5rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <span style={{ fontSize: '1.25rem' }}>✋</span>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>ממתין לאישור שלך</h2>
            <span style={{
              fontSize: '0.7rem', fontWeight: 700, background: 'rgba(245,158,11,0.15)',
              color: '#f59e0b', padding: '0.15rem 0.5rem', borderRadius: '999px',
            }}>{pendingApprovals.length}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {pendingApprovals.slice(0, 3).map(approval => (
              <a key={approval.id} href={`/client-portal/approvals?clientId=${clientId}`} style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem', textDecoration: 'none', color: 'var(--foreground)',
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: '0.75rem', padding: '0.85rem 1rem', transition: 'border-color 200ms',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#f59e0b'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; }}
              >
                <span style={{ fontSize: '1.25rem' }}>📋</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {approval.title}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--foreground-muted)' }}>
                    {formatRelativeDate(approval.createdAt)}
                  </div>
                </div>
                <span style={{ fontSize: '0.75rem', color: '#f59e0b', fontWeight: 600 }}>צפה ←</span>
              </a>
            ))}
          </div>
          {pendingApprovals.length > 3 && (
            <a href={`/client-portal/approvals?clientId=${clientId}`} style={{
              display: 'block', textAlign: 'center', marginTop: '0.75rem',
              fontSize: '0.8rem', color: '#f59e0b', fontWeight: 600, textDecoration: 'none',
            }}>
              צפה בכל {pendingApprovals.length} הפריטים ←
            </a>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════
          B. PERFORMANCE KPIs
          ═══════════════════════════════════════ */}
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 1rem 0' }}>ביצועים בקצרה</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
          {[
            { icon: '🎯', label: 'לידים שהתקבלו', value: kpis.totalLeads, color: '#22c55e' },
            { icon: '💰', label: 'עלות ממוצעת לליד', value: kpis.cpl > 0 ? `₪${kpis.cpl.toFixed(0)}` : '—', color: '#3b82f6' },
            { icon: '📊', label: 'סה״כ הוצאה', value: kpis.totalSpend > 0 ? `₪${kpis.totalSpend.toLocaleString('he-IL')}` : '—', color: '#a78bfa' },
            { icon: '⭐', label: 'מודעה מובילה', value: kpis.bestAd ? (kpis.bestAd.name || kpis.bestAd.headline || 'מודעה מצטיינת').slice(0, 20) : '—', color: '#f59e0b', small: true },
          ].map((kpi, i) => (
            <div key={i} style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: '0.75rem', padding: '1.25rem', textAlign: 'center',
              transition: 'border-color 200ms, transform 200ms',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = kpi.color; (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.transform = 'none'; }}
            >
              <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{kpi.icon}</div>
              <div style={{
                fontSize: (kpi as any).small ? '1rem' : '1.75rem',
                fontWeight: 800, color: kpi.color, marginBottom: '0.2rem',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {kpi.value}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--foreground-muted)', fontWeight: 500 }}>{kpi.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══════════════════════════════════════
          A. "מה עשינו בשבילך השבוע"
          ═══════════════════════════════════════ */}
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 1rem 0' }}>מה עשינו בשבילך השבוע</h2>
        {recentActivities.length > 0 ? (
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: '0.75rem', overflow: 'hidden',
          }}>
            {recentActivities.map((activity, idx) => {
              const iconMap: Record<string, string> = {
                campaign_created: '🚀', ad_created: '🎨', optimization: '⚡',
                approval: '✅', recommendation: '💡', report: '📊',
              };
              const friendlyTitle = (activity as any).clientFriendlyTitle || activity.title;
              return (
                <div key={activity.id} style={{
                  display: 'flex', gap: '1rem', padding: '1rem 1.25rem',
                  borderBottom: idx < recentActivities.length - 1 ? '1px solid var(--border)' : 'none',
                  alignItems: 'center',
                }}>
                  <div style={{
                    width: '2.5rem', height: '2.5rem', borderRadius: '0.75rem',
                    background: 'rgba(0,181,254,0.08)', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0,
                  }}>
                    {iconMap[(activity as any).type] || activity.icon || '📌'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.1rem' }}>
                      {friendlyTitle}
                    </div>
                    {activity.description && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--foreground-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {activity.description}
                      </div>
                    )}
                  </div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--foreground-subtle)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {formatRelativeDate(activity.createdAt)}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: '0.75rem', padding: '2.5rem', textAlign: 'center',
          }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🌱</div>
            <p style={{ fontSize: '0.9rem', color: 'var(--foreground-muted)', margin: 0, fontWeight: 500 }}>
              אנחנו רק מתחילים — בקרוב תראה כאן פעילות
            </p>
          </div>
        )}
        <a href={`/client-portal/timeline?clientId=${clientId}`} style={{
          display: 'block', textAlign: 'center', marginTop: '0.75rem',
          fontSize: '0.8rem', color, fontWeight: 600, textDecoration: 'none',
        }}>
          צפה בכל הפעילות ←
        </a>
      </div>

      {/* ═══════════════════════════════════════
          C. TOP ADS
          ═══════════════════════════════════════ */}
      {topAds.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 1rem 0' }}>מודעות מובילות</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem' }}>
            {topAds.map((ad: any, idx) => {
              const ctr = ad.ctr || (ad.impressions > 0 ? (ad.clicks / ad.impressions) * 100 : 0);
              const perfLabel = ctr > 3 ? 'ביצועים מצוינים' : ctr > 1.5 ? 'ביצועים טובים' : 'פעילה';
              const perfColor = ctr > 3 ? '#22c55e' : ctr > 1.5 ? '#3b82f6' : '#6b7280';
              return (
                <div key={ad.id} style={{
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: '0.75rem', overflow: 'hidden', transition: 'border-color 200ms',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = perfColor; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; }}
                >
                  {/* Ad preview image */}
                  {(ad.imageUrl || ad.thumbnailUrl) && (
                    <div style={{ height: '140px', overflow: 'hidden', background: '#f5f5f5' }}>
                      <img src={ad.imageUrl || ad.thumbnailUrl} alt="" style={{
                        width: '100%', height: '100%', objectFit: 'cover',
                      }} onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
                    </div>
                  )}
                  <div style={{ padding: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{
                        fontSize: '0.65rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: '999px',
                        background: `${perfColor}12`, color: perfColor,
                      }}>{perfLabel}</span>
                      {idx === 0 && <span style={{ fontSize: '0.85rem' }}>🏆</span>}
                    </div>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ad.name || ad.headline || 'מודעה'}
                    </div>
                    {(ad.primaryText || ad.description) && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--foreground-muted)', marginBottom: '0.25rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {(ad.primaryText || ad.description || '').slice(0, 60)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════
          E. AI RECOMMENDATIONS
          ═══════════════════════════════════════ */}
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 1rem 0' }}>מה מומלץ לעשות עכשיו</h2>
        {activeCampaigns.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {activeCampaigns.slice(0, 3).map((campaign: any) => {
              // Generate client-friendly recommendation
              const leads = clientLeads.filter(l => l.campaignId === campaign.id).length;
              const spend = campaign.spend || 0;
              const cpl = leads > 0 ? spend / leads : 0;

              let recText = '';
              let recAction = '';
              let recIcon = '💡';

              if (cpl > 100 && leads > 0) {
                recText = `קמפיין "${campaign.name}" — אפשר לשפר את עלות הלידים`;
                recAction = 'בדוק';
                recIcon = '🔍';
              } else if (leads === 0 && spend > 50) {
                recText = `קמפיין "${campaign.name}" — הוצאה בלי לידים, נבדוק ונשפר`;
                recAction = 'בדוק';
                recIcon = '⚠️';
              } else if (leads > 5) {
                recText = `קמפיין "${campaign.name}" מביא תוצאות טובות — שווה לשקול להגדיל תקציב`;
                recAction = 'אשר שינוי';
                recIcon = '🚀';
              } else {
                recText = `קמפיין "${campaign.name}" פעיל ועובד — ממשיכים לעקוב`;
                recAction = 'בסדר';
                recIcon = '✅';
              }

              return (
                <div key={campaign.id} style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: '0.75rem', padding: '1rem 1.25rem',
                }}>
                  <span style={{ fontSize: '1.25rem', flexShrink: 0 }}>{recIcon}</span>
                  <div style={{ flex: 1, fontSize: '0.85rem', color: 'var(--foreground)' }}>
                    {recText}
                  </div>
                  <button style={{
                    padding: '0.4rem 0.85rem', borderRadius: '0.5rem',
                    border: `1px solid ${color}30`, background: `${color}08`, color,
                    fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                    whiteSpace: 'nowrap', transition: 'all 200ms',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `${color}15`; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = `${color}08`; }}
                  >
                    {recAction}
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: '0.75rem', padding: '2.5rem', textAlign: 'center',
          }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>💡</div>
            <p style={{ fontSize: '0.9rem', color: 'var(--foreground-muted)', margin: 0, fontWeight: 500 }}>
              ברגע שקמפיינים יתחילו לעבוד, כאן יופיעו המלצות מותאמות אישית
            </p>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════
          REPORTS ACCESS
          ═══════════════════════════════════════ */}
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 1rem 0' }}>דוחות אחרונים</h2>
        <a href={`/client-portal/reports?clientId=${clientId}`} style={{
          display: 'flex', alignItems: 'center', gap: '1rem', textDecoration: 'none', color: 'var(--foreground)',
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: '0.75rem', padding: '1.25rem', transition: 'border-color 200ms',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = color; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; }}
        >
          <div style={{
            width: '2.75rem', height: '2.75rem', borderRadius: '0.75rem',
            background: `${color}10`, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.25rem',
          }}>📊</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>צפה בדוחות הביצועים שלך</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--foreground-muted)' }}>סיכומי קמפיינים, תוצאות ונתונים</div>
          </div>
          <span style={{ fontSize: '0.8rem', color, fontWeight: 600 }}>פתח ←</span>
        </a>
      </div>

      {/* ═══════════════════════════════════════
          QUICK NAV
          ═══════════════════════════════════════ */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: '0.5rem', marginBottom: '2rem',
      }}>
        {[
          { label: 'פעילות', href: 'timeline', icon: '📋', color: '#3b82f6' },
          { label: 'אישורים', href: 'approvals', icon: '✅', color: '#22c55e' },
          { label: 'דוחות', href: 'reports', icon: '📊', color: '#a78bfa' },
          { label: 'לידים', href: 'leads', icon: '🎯', color: '#f59e0b' },
        ].map(link => (
          <a key={link.href} href={`/client-portal/${link.href}?clientId=${clientId}`} style={{
            display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.85rem',
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: '0.75rem', textDecoration: 'none', color: 'var(--foreground)',
            transition: 'all 200ms', fontSize: '0.85rem', fontWeight: 600,
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = link.color; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.transform = 'none'; }}
          >
            <span style={{ fontSize: '1.1rem' }}>{link.icon}</span>
            {link.label}
          </a>
        ))}
      </div>

      {/* Footer */}
      <div style={{
        textAlign: 'center', padding: '1.5rem 1rem',
        borderTop: '1px solid var(--border)',
        color: 'var(--foreground-subtle)', fontSize: '0.72rem',
      }}>
        Studio Pixel — פורטל לקוח &copy; {now.getFullYear()}
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
