'use client';

import { useMemo, useState } from 'react';
import { useClientGanttItems } from '@/lib/api/use-entity';

const MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
const WEEKDAYS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];

const STATUS_COLORS: Record<string, string> = {
  new_idea: '#a855f7', draft: '#9ca3af', planned: '#3b82f6', in_progress: '#f59e0b',
  submitted_for_approval: '#0092cc', returned_for_changes: '#f97316', approved: '#22c55e',
  scheduled: '#06b6d4', published: '#15803d',
};

/** Build a wa.me link from an Israeli/local phone number. */
function waLink(raw: string): string {
  let d = (raw || '').replace(/\D/g, '');
  if (d.startsWith('972')) { /* keep */ }
  else if (d.startsWith('0')) d = '972' + d.slice(1);
  else d = '972' + d;
  return `https://wa.me/${d}`;
}

export default function PortalHighlights({ client, clientId }: { client: any; clientId: string }) {
  const { data: ganttItems } = useClientGanttItems();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const items = useMemo(
    () => (ganttItems || []).filter((i: any) => i.clientId === clientId && i.month === month && i.year === year && i.status !== 'draft'),
    [ganttItems, clientId, month, year],
  );

  const itemsByDay = useMemo(() => {
    const map: Record<number, any[]> = {};
    for (const it of items) {
      const d = it.date ? new Date(it.date).getDate() : null;
      if (d) (map[d] = map[d] || []).push(it);
    }
    return map;
  }, [items]);

  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: (number | null)[] = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  const nav = (dir: number) => {
    let m = month + dir, y = year;
    if (m < 1) { m = 12; y--; } else if (m > 12) { m = 1; y++; }
    setMonth(m); setYear(y);
  };

  // Social links present on the client.
  const socials = [
    { url: client.websiteUrl, label: 'אתר', emoji: '🌐', color: '#0066FF' },
    { url: client.instagramProfileUrl, label: 'אינסטגרם', emoji: '📸', color: '#E1306C' },
    { url: client.facebookPageUrl, label: 'פייסבוק', emoji: '📘', color: '#1877F2' },
    { url: client.tiktokProfileUrl, label: 'טיקטוק', emoji: '🎵', color: '#000000' },
    { url: client.linkedinUrl, label: 'לינקדאין', emoji: '💼', color: '#0A66C2' },
    { url: client.youtubeUrl, label: 'יוטיוב', emoji: '▶️', color: '#FF0000' },
  ].filter((s) => s.url);

  const full = (u: string) => (u && !/^https?:\/\//.test(u) ? `https://${u}` : u);
  const igUser = (() => { const m = full(client.instagramProfileUrl || '').match(/instagram\.com\/([^/?#]+)/); return m ? m[1] : ''; })();
  const ttUser = (() => { const m = full(client.tiktokProfileUrl || '').match(/tiktok\.com\/@?([^/?#]+)/); return m ? m[1].replace(/^@/, '') : ''; })();
  // Live feeds present → split the preview into a section per network + site.
  const feeds = [
    client.websiteUrl ? { key: 'site', label: '🌐 אתר', color: '#0066FF', src: full(client.websiteUrl) } : null,
    igUser ? { key: 'ig', label: `📷 Instagram — @${igUser}`, color: '#E4405F', src: `https://www.instagram.com/${igUser}/embed` } : null,
    client.facebookPageUrl ? { key: 'fb', label: 'f Facebook', color: '#1877F2', src: `https://www.facebook.com/plugins/page.php?href=${encodeURIComponent(full(client.facebookPageUrl))}&tabs=timeline&width=340&height=480&small_header=true&adapt_container_width=true&hide_cover=false&show_facepile=false` } : null,
    ttUser ? { key: 'tt', label: `🎵 TikTok — @${ttUser}`, color: '#000', src: `https://www.tiktok.com/embed/@${ttUser}` } : null,
  ].filter(Boolean) as { key: string; label: string; color: string; src: string }[];

  const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid rgba(0,0,0,0.06)', borderRadius: '1rem', padding: '1.1rem 1.25rem', marginBottom: '1rem' };

  return (
    <div style={{ direction: 'rtl' }}>

      {/* ── Monthly content calendar ── */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--foreground)' }}>📅 לוח התוכן החודשי</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={() => nav(-1)} style={navBtn}>‹</button>
            <span style={{ fontWeight: 700, fontSize: 14, minWidth: 110, textAlign: 'center' }}>{MONTHS[month - 1]} {year}</span>
            <button onClick={() => nav(1)} style={navBtn}>›</button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
          {WEEKDAYS.map((w) => <div key={w} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--foreground-muted,#888)', padding: '4px 0' }}>{w}</div>)}
          {cells.map((day, idx) => (
            <div key={idx} style={{ minHeight: 64, borderRadius: 8, border: day ? '1px solid rgba(0,0,0,0.05)' : 'none', background: day ? 'var(--surface-raised,#fafafa)' : 'transparent', padding: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {day && <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--foreground-muted,#999)' }}>{day}</div>}
              {day && (itemsByDay[day] || []).slice(0, 3).map((it: any) => (
                <a key={it.id} href={`/client-portal/gantt?clientId=${clientId}`} title={it.title}
                  style={{ fontSize: 9.5, fontWeight: 600, lineHeight: 1.2, color: STATUS_COLORS[it.status] || '#666', background: `${STATUS_COLORS[it.status] || '#666'}18`, borderRadius: 4, padding: '2px 4px', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                  {it.title || 'תוכן'}
                </a>
              ))}
            </div>
          ))}
        </div>
        {items.length === 0 && <div style={{ textAlign: 'center', color: 'var(--foreground-muted,#999)', fontSize: 13, padding: '12px 0' }}>אין תוכן מתוזמן לחודש זה</div>}
        <div style={{ textAlign: 'center', marginTop: 10 }}>
          <a href={`/client-portal/gantt?clientId=${clientId}`} style={{ fontSize: 12.5, fontWeight: 700, color: '#0066FF', textDecoration: 'none' }}>לתצוגה המלאה של לוח התוכן ←</a>
        </div>
      </div>

      {/* ── Live website + social previews (split per network) ── */}
      {(feeds.length > 0 || socials.length > 0) && (
        <div style={card}>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--foreground)', marginBottom: 12 }}>🔎 האתר והרשתות שלך</div>
          {feeds.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${feeds.length === 1 ? 320 : 280}px, 1fr))`, gap: 14, marginBottom: socials.length ? 12 : 0 }}>
              {feeds.map((f) => (
                <div key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: f.color }}>{f.label}</div>
                  <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(0,0,0,0.08)', background: '#fafafa' }}>
                    <iframe src={f.src} width="100%" height={460} style={{ border: 'none', display: 'block' }} loading="lazy" title={f.label} sandbox="allow-scripts allow-same-origin allow-popups allow-forms" />
                  </div>
                </div>
              ))}
            </div>
          )}
          {socials.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {socials.map((s) => (
                <a key={s.label} href={/^https?:\/\//.test(s.url) ? s.url : `https://${s.url}`} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0.5rem 0.85rem', borderRadius: 10, border: `1px solid ${s.color}30`, background: `${s.color}10`, color: s.color, fontWeight: 700, fontSize: 12.5, textDecoration: 'none' }}>
                  {s.emoji} {s.label}
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const navBtn: React.CSSProperties = { width: 30, height: 30, borderRadius: 8, border: '1px solid rgba(0,0,0,0.08)', background: 'var(--surface-raised,#fafafa)', cursor: 'pointer', fontSize: 16, fontWeight: 700, lineHeight: 1 };
