/**
 * Weekly progress digest builder — turns a client's gantt items into a short,
 * friendly Hebrew WhatsApp update: what was published/approved in the last week,
 * and what's coming up next week. Optionally attaches the latest approved graphic.
 */
import type { ClientGanttItem } from '@/lib/db/schema';

const DONE_STATUSES = new Set(['approved', 'scheduled', 'published']);

function parseImg(s: string): string {
  const i = s.indexOf('|');
  return i >= 0 ? s.slice(i + 1) : s;
}
const isImg = (u: string) => /\.(png|jpe?g|webp|gif|avif)(\?|$)/i.test(u) || /\/storage\/|supabase|cloudfront/i.test(u);

export interface Digest { message: string; mediaUrl?: string; hasActivity: boolean }

export function buildWeeklyDigest(
  clientName: string,
  items: ClientGanttItem[],
  opts: { agencyName?: string; now?: Date } = {},
): Digest {
  const agency = opts.agencyName || 'PIXEL';
  const now = opts.now || new Date();
  const weekAgo = new Date(now.getTime() - 7 * 864e5);
  const weekAhead = new Date(now.getTime() + 7 * 864e5);

  const inRange = (d: string, a: Date, b: Date) => { const t = Date.parse(d); return !isNaN(t) && t >= a.getTime() && t <= b.getTime(); };

  const doneThisWeek = items.filter((it) => DONE_STATUSES.has(it.status) && it.date && inRange(it.date, weekAgo, now));
  const upcoming = items.filter((it) => !DONE_STATUSES.has(it.status) && it.status !== 'cancelled' && it.date && inRange(it.date, now, weekAhead));

  // Latest approved graphic across the client's items.
  let mediaUrl: string | undefined;
  const withImgs = items
    .filter((it) => DONE_STATUSES.has(it.status) && (it.imageUrls || []).length)
    .sort((a, b) => Date.parse(b.date || '') - Date.parse(a.date || ''));
  for (const it of withImgs) {
    const url = (it.imageUrls || []).map(parseImg).find(isImg);
    if (url) { mediaUrl = url; break; }
  }

  const lines: string[] = [];
  lines.push(`היי {{name}} 👋`);
  lines.push(`עדכון התקדמות שבועי מ-${agency} 📊`);
  lines.push('');

  if (doneThisWeek.length) {
    lines.push('✅ מה שהושלם השבוע:');
    for (const it of doneThisWeek.slice(0, 6)) lines.push(`• ${it.title || it.ideaSummary || 'תוכן'}`);
    lines.push('');
  }
  if (upcoming.length) {
    lines.push('🔜 מה שמתוכנן לשבוע הקרוב:');
    for (const it of upcoming.slice(0, 6)) lines.push(`• ${it.title || it.ideaSummary || 'תוכן'}`);
    lines.push('');
  }
  if (!doneThisWeek.length && !upcoming.length) {
    lines.push('אנחנו ממשיכים לעבוד מאחורי הקלעים עבורכם — בקרוב עדכונים חדשים. 💪');
    lines.push('');
  }
  lines.push('מוזמנים לכל שאלה, אנחנו כאן 🙌');

  return { message: lines.join('\n'), mediaUrl, hasActivity: doneThisWeek.length + upcoming.length > 0 };
}
