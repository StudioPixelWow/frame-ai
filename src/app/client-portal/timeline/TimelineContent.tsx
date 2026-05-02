'use client';

import { useState, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useActivities, useCampaigns, useApprovals, useAds } from '@/lib/api/use-entity';

/* ── Helpers ── */
function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('he-IL', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function formatRelative(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) {
    const hours = Math.floor(diff / 3600000);
    if (hours === 0) return 'ממש עכשיו';
    return `לפני ${hours} שעות`;
  }
  if (days === 1) return 'אתמול';
  if (days < 7) return `לפני ${days} ימים`;
  return formatDate(dateStr);
}

type FilterRange = '7' | '30' | 'all';

const FILTER_OPTIONS: { key: FilterRange; label: string }[] = [
  { key: '7', label: '7 ימים אחרונים' },
  { key: '30', label: '30 ימים אחרונים' },
  { key: 'all', label: 'הכל' },
];

/* Client-friendly event type mapping */
const EVENT_META: Record<string, { icon: string; label: string; color: string }> = {
  campaign_created: { icon: '🚀', label: 'קמפיין חדש', color: '#3b82f6' },
  campaign_updated: { icon: '✏️', label: 'עדכון קמפיין', color: '#6366f1' },
  ad_created: { icon: '🎨', label: 'מודעה חדשה', color: '#a78bfa' },
  optimization: { icon: '⚡', label: 'שיפור ביצועים', color: '#f59e0b' },
  approval: { icon: '✅', label: 'אישור', color: '#22c55e' },
  approval_completed: { icon: '✅', label: 'אישור הושלם', color: '#22c55e' },
  report_generated: { icon: '📊', label: 'דוח הוכן', color: '#3b82f6' },
  recommendation: { icon: '💡', label: 'המלצה', color: '#f97316' },
  content_published: { icon: '📣', label: 'תוכן פורסם', color: '#22c55e' },
  lead_received: { icon: '🎯', label: 'ליד חדש', color: '#10b981' },
  default: { icon: '📌', label: 'פעילות', color: '#6b7280' },
};

function TimelineContentInner() {
  const searchParams = useSearchParams();
  const clientId = searchParams.get('clientId');
  const [filter, setFilter] = useState<FilterRange>('30');

  const { data: activities } = useActivities();
  const { data: campaigns } = useCampaigns();
  const { data: approvals } = useApprovals();
  const { data: allAds } = useAds();

  // Build unified timeline from multiple sources
  const timelineEvents = useMemo(() => {
    const events: Array<{
      id: string;
      type: string;
      title: string;
      description: string;
      date: string;
      icon: string;
      color: string;
    }> = [];

    // Activities
    for (const a of activities) {
      const meta = EVENT_META[(a as any).type] || EVENT_META.default;
      events.push({
        id: `act-${a.id}`,
        type: (a as any).type || 'default',
        title: (a as any).clientFriendlyTitle || a.title || meta.label,
        description: a.description || '',
        date: a.createdAt,
        icon: a.icon || meta.icon,
        color: meta.color,
      });
    }

    // Campaign creations
    for (const c of campaigns.filter((c: any) => c.clientId === clientId)) {
      events.push({
        id: `cmp-${c.id}`,
        type: 'campaign_created',
        title: `קמפיין "${c.name}" נוצר`,
        description: (c as any).objective ? `סוג: ${(c as any).objective}` : '',
        date: c.createdAt,
        icon: '🚀',
        color: '#3b82f6',
      });
    }

    // Approvals
    for (const a of approvals.filter(a => a.status === 'approved')) {
      events.push({
        id: `apr-${a.id}`,
        type: 'approval_completed',
        title: `"${a.title}" אושר`,
        description: '',
        date: a.updatedAt || a.createdAt,
        icon: '✅',
        color: '#22c55e',
      });
    }

    // Deduplicate by ID
    const seen = new Set<string>();
    return events
      .filter(e => { if (seen.has(e.id)) return false; seen.add(e.id); return true; })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [activities, campaigns, approvals, clientId]);

  // Filter by date range
  const filteredEvents = useMemo(() => {
    if (filter === 'all') return timelineEvents;
    const days = parseInt(filter);
    const cutoff = Date.now() - days * 86400000;
    return timelineEvents.filter(e => new Date(e.date).getTime() > cutoff);
  }, [timelineEvents, filter]);

  // Group by date
  const grouped = useMemo(() => {
    const groups: Record<string, typeof filteredEvents> = {};
    for (const event of filteredEvents) {
      const day = new Date(event.date).toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' });
      if (!groups[day]) groups[day] = [];
      groups[day].push(event);
    }
    return Object.entries(groups);
  }, [filteredEvents]);

  return (
    <div style={{ direction: 'rtl', maxWidth: '800px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <a href={`/client-portal/dashboard?clientId=${clientId}`} style={{
          fontSize: '0.8rem', color: 'var(--foreground-muted)', textDecoration: 'none',
          display: 'inline-flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.75rem',
        }}>
          ← חזרה לדשבורד
        </a>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 0.25rem 0' }}>פעילות שבוצעה עבורך</h1>
        <p style={{ fontSize: '0.85rem', color: 'var(--foreground-muted)', margin: 0 }}>
          כל העבודה שנעשתה על הקמפיינים, התוכן והמודעות שלך
        </p>
      </div>

      {/* Filter */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {FILTER_OPTIONS.map(opt => (
          <button key={opt.key} onClick={() => setFilter(opt.key)} style={{
            padding: '0.4rem 0.85rem', border: 'none', borderRadius: '0.5rem',
            background: filter === opt.key ? 'rgba(0,181,254,0.12)' : 'var(--surface)',
            color: filter === opt.key ? '#00B5FE' : 'var(--foreground-muted)',
            fontWeight: filter === opt.key ? 700 : 500, fontSize: '0.8rem',
            cursor: 'pointer', transition: 'all 200ms',
          }}>
            {opt.label}
          </button>
        ))}
      </div>

      {/* Timeline */}
      {grouped.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {grouped.map(([day, events]) => (
            <div key={day}>
              <div style={{
                fontSize: '0.8rem', fontWeight: 700, color: 'var(--foreground-muted)',
                marginBottom: '0.75rem', paddingBottom: '0.35rem',
                borderBottom: '1px solid var(--border)',
              }}>
                {day}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {events.map(event => (
                  <div key={event.id} style={{
                    display: 'flex', gap: '0.75rem', alignItems: 'flex-start',
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: '0.75rem', padding: '1rem 1.25rem',
                    borderRight: `3px solid ${event.color}`,
                  }}>
                    <div style={{
                      width: '2.25rem', height: '2.25rem', borderRadius: '0.5rem',
                      background: `${event.color}10`, display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontSize: '1rem', flexShrink: 0,
                    }}>{event.icon}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.1rem' }}>
                        {event.title}
                      </div>
                      {event.description && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--foreground-muted)' }}>
                          {event.description}
                        </div>
                      )}
                    </div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--foreground-subtle)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {formatRelative(event.date)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: '0.75rem', padding: '3rem', textAlign: 'center',
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🌱</div>
          <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--foreground-muted)', margin: '0 0 0.25rem 0' }}>
            אין פעילות בתקופה הזו
          </p>
          <p style={{ color: 'var(--foreground-subtle)', fontSize: '0.85rem', margin: 0 }}>
            אנחנו רק מתחילים — בקרוב תראה כאן פעילות
          </p>
        </div>
      )}
    </div>
  );
}

export default function TimelineContent() {
  return (
    <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center' }}>...טוען</div>}>
      <TimelineContentInner />
    </Suspense>
  );
}
