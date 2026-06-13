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
  useEmployees,
} from '@/lib/api/use-entity';
import { useMemo, useState, useCallback, useEffect, Suspense } from 'react';
import WelcomeBand from '@/components/ui/welcome-band';
import PortalHighlights from './PortalHighlights';
import PortalTaskRequest from './PortalTaskRequest';
import PortalVisibility from './PortalVisibility';

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
  const { data: employees } = useEmployees();

  const [showNotifs, setShowNotifs] = useState(false);
  const [aiQ, setAiQ] = useState('');
  const [aiA, setAiA] = useState('');
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

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const leadsThisMonth = clientLeads.filter((l: any) => l.createdAt && new Date(l.createdAt).getTime() >= monthStart).length;
  const digits = (s: string) => { const d = String(s || '').replace(/\D/g, ''); return d.startsWith('0') ? '972' + d.slice(1) : d; };
  const findEmp = (names: string[]) => (employees || []).find((e: any) => names.some((n) => String(e.name || '').includes(n)));
  const tal = findEmp(['טל זטלמן', 'טל ']);
  const maya = findEmp(['מאיה']);
  const waLink = (emp: any, msg: string) => { const d = digits((emp as any)?.phone || ''); return d ? `https://wa.me/${d}?text=${encodeURIComponent(msg)}` : '#'; };
  const team = [
    { emp: tal, name: tal?.name || 'טל זטלמן', title: 'מייסד ומנהל אסטרטגי' },
    { emp: maya, name: maya?.name || 'מאיה זטלמן', title: 'מנהלת הלקוח שלך' },
  ];
  const greet = now.getHours() < 12 ? 'בוקר טוב' : now.getHours() < 18 ? 'צהריים טובים' : 'ערב טוב';
  const delivered = [
    { ic: '📣', n: activeCampaigns.length, l: 'קמפיינים פעילים' },
    { ic: '🎯', n: leadsThisMonth, l: 'לידים החודש' },
    { ic: '✅', n: recentActivities.length, l: 'עדכונים השבוע' },
    { ic: '🔔', n: pendingApprovals.length, l: 'ממתינים לאישורך' },
  ];
  const aiRecs: string[] = [];
  if (pendingApprovals.length) aiRecs.push(`יש ${pendingApprovals.length} פריטים שממתינים לאישורך`);
  if (activeCampaigns.length === 0) aiRecs.push('מומלץ להפעיל קמפיין חדש להגדלת לידים');
  else aiRecs.push('הקמפיינים פעילים — מומלץ לשקול הגדלת תקציב למוביל');
  aiRecs.push('מומלץ להוסיף סרטון נוסף החודש להגברת מעורבות');
  const askAI = () => {
    const q = aiQ.trim(); if (!q) return;
    let a = '';
    if (/אישור/.test(q)) a = pendingApprovals.length ? `יש ${pendingApprovals.length} פריטים הממתינים לאישורך כרגע — תוכל לאשר אותם בקטע "דורש את תשומת הלב שלך".` : 'אין כרגע פריטים הממתינים לאישורך 🎉';
    else if (/שבוע|מתוכנן|הבא|הקרוב/.test(q)) a = `לשבוע הקרוב: ${activeCampaigns.length} קמפיינים פעילים נמשכים${leadsThisMonth ? `, ועד כה נכנסו ${leadsThisMonth} לידים החודש` : ''}. הצוות ממשיך בהפקת התוכן המתוכנן.`;
    else if (/ביצוע|מצב|איך/.test(q)) a = `סטטוס החשבון: ${activeCampaigns.length} קמפיינים פעילים, ${clientLeads.length} לידים סה"כ, ${leadsThisMonth} החודש. ${pendingApprovals.length ? `${pendingApprovals.length} פריטים ממתינים לאישורך.` : 'הכל מאושר ומעודכן.'}`;
    else a = `הנה תמונת מצב: ${activeCampaigns.length} קמפיינים פעילים, ${leadsThisMonth} לידים החודש, ${pendingApprovals.length} ממתינים לאישורך. לכל שאלה נוספת אפשר לפנות לצוות הליווי.`;
    setAiA(a);
  };
  const quickActions = [
    { ic: '➕', l: 'משימה חדשה', href: '/client-portal/tasks?clientId=' + (clientId || '') },
    { ic: '📎', l: 'העלאת חומרים', href: '/client-portal/tasks?clientId=' + (clientId || '') },
    { ic: '🎨', l: 'בקשת גרפיקה', href: '/client-portal/tasks?clientId=' + (clientId || '') },
    { ic: '🎥', l: 'בקשת סרטון', href: '/client-portal/tasks?clientId=' + (clientId || '') },
    { ic: '📢', l: 'בקשת קמפיין', href: '/client-portal/tasks?clientId=' + (clientId || '') },
    { ic: '📅', l: 'קביעת פגישה', href: waLink(maya, 'היי, אשמח לקבוע פגישה') },
    { ic: '💬', l: 'שליחת הודעה', href: waLink(maya, 'היי מאיה,') },
    { ic: '📊', l: 'בקשת דוח', href: '/client-portal/reports?clientId=' + (clientId || '') },
  ];
  const sCard: React.CSSProperties = { background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: 18, padding: '1.4rem' };
  const sTitle: React.CSSProperties = { fontSize: '1.1rem', fontWeight: 800, color: 'var(--foreground)', marginBottom: 14 };

  return (
    <div style={{ direction: 'rtl', maxWidth: 1120, margin: '0 auto', position: 'relative', display: 'flex', flexDirection: 'column', gap: 22, paddingBottom: 40 }}>
      <style>{STYLES}</style>

      {/* 1 · HERO */}
      <div style={{ borderRadius: 24, padding: '2rem 2.2rem', background: 'linear-gradient(120deg,#4F46E5,#2563EB 55%,#06B6D4)', color: '#fff', display: 'flex', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '1.9rem', fontWeight: 900, margin: 0 }}>👋 {greet}, {client.name}</h1>
          <div style={{ fontSize: '0.9rem', opacity: 0.9, marginTop: 4 }}>ברוך הבא לפורטל הלקוח שלך</div>
          <div style={{ marginTop: 16, display: 'flex', gap: 18, flexWrap: 'wrap' }}>
            {delivered.map((d, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 14, padding: '0.7rem 1rem', textAlign: 'center', minWidth: 96 }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 900 }}>{d.n}</div>
                <div style={{ fontSize: '0.66rem', opacity: 0.9 }}>{d.ic} {d.l}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          {(client as any).logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={(client as any).logoUrl} alt={client.name} style={{ width: 72, height: 72, borderRadius: 16, objectFit: 'contain', background: '#fff', padding: 6 }} />
          ) : <div style={{ width: 72, height: 72, borderRadius: 16, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '1.5rem', margin: '0 auto' }}>{initials}</div>}
          <div style={{ marginTop: 10, fontSize: '0.82rem', fontWeight: 700 }}>{now.toLocaleDateString('he-IL', { day: 'numeric', month: 'long' })}</div>
          <div style={{ fontSize: '0.7rem', opacity: 0.9 }} suppressHydrationWarning>{mounted ? now.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : ''}</div>
          <div style={{ marginTop: 8, display: 'inline-block', fontSize: '0.7rem', fontWeight: 700, background: 'rgba(255,255,255,0.18)', borderRadius: 999, padding: '2px 10px' }}>מצב חשבון: {status.text}</div>
        </div>
      </div>

      {/* 2 · CLIENT SUCCESS TEAM */}
      <div style={{ ...sCard, background: 'linear-gradient(135deg,#eff6ff,#f5f3ff)', border: '1px solid #dbeafe' }}>
        <div style={sTitle}>💬 צוות הליווי שלך</div>
        <div style={{ fontSize: '0.78rem', color: 'var(--foreground-muted)', marginTop: -8, marginBottom: 14 }}>אנחנו כאן בשבילך, בכל שאלה ופנייה.</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }} className="cp-2col">
          {team.map((m, i) => (
            <div key={i} style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: 14, padding: '1.1rem', textAlign: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: '1rem' }}>{m.name}</div>
              <div style={{ fontSize: '0.74rem', color: 'var(--foreground-muted)', marginBottom: 12 }}>{m.title}</div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                <a href={waLink(m.emp, `היי ${m.name.split(' ')[0]},`)} target="_blank" rel="noopener noreferrer" style={{ flex: 1, fontSize: '0.78rem', fontWeight: 700, color: '#16a34a', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '0.5rem', textDecoration: 'none' }}>💬 שלח הודעה</a>
                <a href={waLink(m.emp, `היי ${m.name.split(' ')[0]}, אשמח לקבוע שיחה`)} target="_blank" rel="noopener noreferrer" style={{ flex: 1, fontSize: '0.78rem', fontWeight: 700, color: '#4f46e5', background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 10, padding: '0.5rem', textDecoration: 'none' }}>📞 קביעת שיחה</a>
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12, fontSize: '0.78rem', color: 'var(--foreground-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>🟢 זמן תגובה ממוצע: עד שעה</div>
      </div>

      {/* 3 · REQUIRES YOUR ATTENTION */}
      <div>
        <div style={sTitle}>🔔 דורש את תשומת הלב שלך {pendingApprovals.length > 0 && <span style={{ fontSize: '0.7rem', color: '#fff', background: '#ef4444', borderRadius: 999, padding: '1px 9px' }}>{pendingApprovals.length}</span>}</div>
        {pendingApprovals.length === 0 ? (
          <div style={{ ...sCard, color: '#16a34a', fontWeight: 700 }}>אין פריטים הממתינים לאישורך — הכל מעודכן 🎉</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 12 }}>
            {pendingApprovals.slice(0, 6).map((a: any, i: number) => {
              const tone = i % 3 === 0 ? '#ef4444' : i % 3 === 1 ? '#f59e0b' : '#eab308';
              return (
                <a key={a.id} href={'/client-portal/approvals?clientId=' + (clientId || '')} style={{ ...sCard, padding: '1.1rem', textDecoration: 'none', display: 'block', borderInlineStart: `4px solid ${tone}`, background: tone + '0d' }}>
                  <div style={{ fontSize: '0.66rem', fontWeight: 800, color: tone }}>● ממתין לאישור</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--foreground)', margin: '6px 0 4px' }}>{a.title || a.itemTitle || 'פריט לאישור'}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--foreground-muted)' }}>{a.clientName || client.name}{a.createdAt ? ` · ${formatRelativeDate(a.createdAt)}` : ''}</div>
                  <div style={{ marginTop: 10, fontSize: '0.76rem', fontWeight: 700, color: '#fff', background: tone, borderRadius: 8, padding: '0.4rem', textAlign: 'center' }}>אשר עכשיו</div>
                </a>
              );
            })}
          </div>
        )}
      </div>

      {/* 4 · QUICK ACTIONS */}
      <div>
        <div style={sTitle}>⚡ פעולות מהירות</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10, marginBottom: 16 }}>
          {quickActions.map((q, i) => (
            <a key={i} href={q.href} target={q.href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer" style={{ ...sCard, padding: '1rem 0.6rem', textAlign: 'center', textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 }} className="cp-qa">
              <span style={{ fontSize: '1.5rem' }}>{q.ic}</span>
              <span style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--foreground)' }}>{q.l}</span>
            </a>
          ))}
        </div>
        <PortalTaskRequest clientId={clientId || ''} />
      </div>

      {/* 5 · MONTHLY CALENDAR + CONTENT VISIBILITY */}
      <div>
        <div style={sTitle}>📅 לוח התוכן החודשי</div>
        <PortalVisibility clientId={clientId || ''} />
      </div>

      {/* 6 · MARKETING GANTT */}
      <a href={'/client-portal/gantt?clientId=' + (clientId || '')} style={{ ...sCard, textDecoration: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg,#eef2ff,#faf5ff)', border: '1px solid #ddd6fe' }}>
        <div><div style={{ ...sTitle, marginBottom: 4 }}>📊 גאנט שיווקי</div><div style={{ fontSize: '0.78rem', color: 'var(--foreground-muted)' }}>צפה בלוח הזמנים המלא של התוכן והקמפיינים שלך</div></div>
        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#7c3aed' }}>פתח גאנט ←</span>
      </a>

      {/* 7 · REAL-TIME ACTIVITY FEED */}
      <div style={sCard}>
        <div style={sTitle}>🔄 פעילות בזמן אמת</div>
        {recentActivities.length === 0 ? <div style={{ fontSize: '0.82rem', color: 'var(--foreground-muted)' }}>אין פעילות אחרונה</div> :
          recentActivities.map((a: any, i: number) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '0.55rem 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#06b6d4', marginTop: 6, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.82rem', color: 'var(--foreground)' }}>{a.description || a.title || a.action || 'עדכון'}</div>
                <div style={{ fontSize: '0.66rem', color: 'var(--foreground-subtle)' }}>{a.userName ? a.userName + ' · ' : ''}{a.createdAt ? formatRelativeDate(a.createdAt) : ''}</div>
              </div>
            </div>
          ))}
      </div>

      {/* 8 · CONTENT CENTER */}
      <div>
        <div style={sTitle}>📱 מרכז התוכן שלך</div>
        <PortalHighlights client={client} clientId={clientId || ''} />
      </div>

      {/* 9 · PIXEL AI ACCOUNT MANAGER */}
      <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 20, padding: '1.6rem', background: 'linear-gradient(145deg,#1e1b4b,#312e81 55%,#4c1d95)', color: '#fff' }}>
        <div style={{ position: 'absolute', insetInlineStart: -20, top: 0, width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle, rgba(167,139,250,0.4), transparent 70%)' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}><span>🤖</span><span style={{ fontSize: '1.1rem', fontWeight: 900 }}>Pixel AI — מנהל החשבון שלך</span></div>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 14 }}>
            {[{ n: activeCampaigns.length, l: 'קמפיינים פעילים' }, { n: clientLeads.length, l: 'לידים' }, { n: leadsThisMonth, l: 'לידים החודש' }, { n: pendingApprovals.length, l: 'ממתינים לאישור' }].map((s, i) => (
              <div key={i}><div style={{ fontSize: '1.6rem', fontWeight: 900 }}>{s.n}</div><div style={{ fontSize: '0.66rem', color: '#c4b5fd' }}>{s.l}</div></div>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
            {aiRecs.slice(0, 3).map((r, i) => <div key={i} style={{ fontSize: '0.78rem', color: '#ede9fe', display: 'flex', gap: 7 }}><span style={{ color: '#a5b4fc' }}>✦</span>{r}</div>)}
          </div>
          <div style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 12, padding: '0.7rem' }}>
            <div style={{ fontSize: '0.74rem', fontWeight: 700, marginBottom: 6 }}>שאל את Pixel AI</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={aiQ} onChange={(e) => setAiQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') askAI(); }} placeholder="איך החשבון שלי מתפקד? מה מתוכנן לשבוע הבא?" style={{ flex: 1, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 9, padding: '0.5rem 0.7rem', color: '#fff', fontSize: '0.78rem', direction: 'rtl' }} />
              <button onClick={askAI} style={{ background: '#a78bfa', color: '#1e1b4b', border: 'none', borderRadius: 9, padding: '0.5rem 1rem', fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer' }}>שאל</button>
            </div>
            {aiA && <div style={{ marginTop: 10, fontSize: '0.8rem', color: '#ede9fe', lineHeight: 1.6, background: 'rgba(0,0,0,0.2)', borderRadius: 9, padding: '0.7rem' }}>{aiA}</div>}
          </div>
        </div>
      </div>

      {/* 10 · RESULTS */}
      <div style={{ ...sCard, background: 'linear-gradient(135deg,#eff6ff,#ecfeff)', border: '1px solid #bfdbfe' }}>
        <div style={sTitle}>📈 התוצאות שלך</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 12 }}>
          {[
            { l: 'לידים', v: clientLeads.length },
            { l: 'חשיפות', v: clientAds.reduce((s: number, a: any) => s + (a.impressions || 0), 0).toLocaleString('he-IL') },
            { l: 'קליקים', v: clientAds.reduce((s: number, a: any) => s + (a.clicks || 0), 0).toLocaleString('he-IL') },
            { l: 'המרות', v: clientLeads.filter((l: any) => l.status === 'won' || l.convertedClientId).length },
            { l: 'קמפיינים פעילים', v: activeCampaigns.length },
            { l: 'לידים החודש', v: leadsThisMonth },
          ].map((r, i) => (
            <div key={i} style={{ background: 'var(--surface-raised)', borderRadius: 12, padding: '0.9rem 1rem' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--foreground-muted)' }}>{r.l}</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#1d4ed8' }}>{r.v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 11 · DOCUMENTS & FILES */}
      <a href={'/client-portal/files?clientId=' + (clientId || '')} style={{ ...sCard, textDecoration: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div><div style={{ ...sTitle, marginBottom: 4 }}>📁 מסמכים וקבצים</div><div style={{ fontSize: '0.78rem', color: 'var(--foreground-muted)' }}>חוזים, חשבוניות, דוחות, בריפים וסיכומי פגישות</div></div>
        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--accent)' }}>פתח מסמכים ←</span>
      </a>

      <div style={{ textAlign: 'center', padding: '1rem 0', color: 'var(--foreground-subtle)', fontSize: '0.7rem' }}>Studio Pixel &copy; {now.getFullYear()}</div>
      <style>{`@media (max-width:760px){.cp-2col{grid-template-columns:1fr !important}}`}</style>
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
