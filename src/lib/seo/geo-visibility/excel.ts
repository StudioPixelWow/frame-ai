/**
 * AI Visibility → Excel workbook (SpreadsheetML 2003 / .xls).
 *
 * Dependency-free: emits the Excel 2003 XML format, which opens natively in
 * Microsoft Excel and Google Sheets with full Hebrew/RTL support and multiple
 * worksheets — Summary, Per-Engine breakdown, Share of Voice, and Queries.
 * Pure read; no side effects.
 */

import { seoPlans } from '@/lib/db';
import { getSupabase } from '@/lib/db/store';

function xesc(s: any): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function cell(v: any, type: 'String' | 'Number' = 'String'): string {
  if (type === 'Number') { const n = Number(v); return `<Cell><Data ss:Type="Number">${Number.isFinite(n) ? n : 0}</Data></Cell>`; }
  return `<Cell><Data ss:Type="String">${xesc(v)}</Data></Cell>`;
}
function row(cells: string[]): string { return `<Row>${cells.join('')}</Row>`; }
function headerRow(labels: string[]): string {
  return `<Row>${labels.map((l) => `<Cell ss:StyleID="hdr"><Data ss:Type="String">${xesc(l)}</Data></Cell>`).join('')}</Row>`;
}
function sheet(name: string, rows: string[], colCount: number): string {
  const cols = Array.from({ length: colCount }).map(() => '<Column ss:Width="150"/>').join('');
  return `<Worksheet ss:Name="${xesc(name).slice(0, 31)}"><Table>${cols}${rows.join('')}</Table></Worksheet>`;
}

export async function buildVisibilityWorkbook(planId: string): Promise<{ xml: string; filename: string; month: string }> {
  const sb = getSupabase();
  const plan: any = await seoPlans.getByIdAsync(planId);
  const clientName = plan?.clientName || plan?.businessProfile?.businessName || 'client';

  const [agg, mentions, citations, responses, comp, queries] = await Promise.all([
    sb.from('geo_visibility_monthly_aggregations').select('*').eq('plan_id', planId).order('month', { ascending: true }).limit(24).then((r) => r.data || []),
    sb.from('geo_visibility_mentions').select('ai_engine').eq('plan_id', planId).limit(2000).then((r) => r.data || []),
    sb.from('geo_visibility_citations').select('ai_engine,is_own_site,is_competitor_site,cited_domain').eq('plan_id', planId).limit(2000).then((r) => r.data || []),
    sb.from('geo_visibility_responses').select('ai_engine,found').eq('plan_id', planId).limit(4000).then((r) => r.data || []),
    sb.from('geo_visibility_competitor_mentions').select('competitor_name').eq('plan_id', planId).limit(2000).then((r) => r.data || []),
    sb.from('geo_visibility_queries').select('query_text,topic,intent,priority').eq('plan_id', planId).eq('status', 'active').limit(500).then((r) => r.data || []),
  ]);

  const month = (agg[agg.length - 1]?.month) || new Date().toISOString().slice(0, 7);

  // Sheet 1 — Monthly summary
  const s1 = [headerRow(['חודש', 'ציון נראות', 'אזכורים', 'ציטוטים', 'נתח קול %', 'חשיפה (אומדן)'])];
  for (const m of agg) s1.push(row([cell(m.month), cell(m.visibility_score || 0, 'Number'), cell(m.total_mentions || 0, 'Number'), cell(m.total_citations || 0, 'Number'), cell(Math.round((m.share_of_ai_voice || 0) * 100), 'Number'), cell(m.estimated_ai_reach || 0, 'Number')]));
  if (agg.length === 0) s1.push(row([cell('—')]));

  // Sheet 2 — Per-engine breakdown
  const engines = Array.from(new Set([...responses.map((r: any) => r.ai_engine), ...mentions.map((m: any) => m.ai_engine), ...citations.map((c: any) => c.ai_engine)].filter(Boolean)));
  const s2 = [headerRow(['מנוע AI', 'סריקות', 'הופעות', 'אזכורים', 'ציטוטים', 'ציטוטים שלנו'])];
  for (const e of engines) {
    const scans = responses.filter((r: any) => r.ai_engine === e).length;
    const appeared = responses.filter((r: any) => r.ai_engine === e && r.found).length;
    const men = mentions.filter((m: any) => m.ai_engine === e).length;
    const cit = citations.filter((c: any) => c.ai_engine === e).length;
    const ownCit = citations.filter((c: any) => c.ai_engine === e && c.is_own_site).length;
    s2.push(row([cell(e), cell(scans, 'Number'), cell(appeared, 'Number'), cell(men, 'Number'), cell(cit, 'Number'), cell(ownCit, 'Number')]));
  }
  if (engines.length === 0) s2.push(row([cell('—')]));

  // Sheet 3 — Share of Voice
  const compCounts: Record<string, number> = {};
  for (const c of comp) compCounts[c.competitor_name] = (compCounts[c.competitor_name] || 0) + 1;
  const us = mentions.length; const compTotal = comp.length; const total = us + compTotal;
  const s3 = [headerRow(['שחקן', 'אזכורים', 'נתח קול %'])];
  s3.push(row([cell('אנחנו'), cell(us, 'Number'), cell(total ? Math.round((us / total) * 100) : 0, 'Number')]));
  for (const [name, count] of Object.entries(compCounts).sort((a, b) => b[1] - a[1])) s3.push(row([cell(name), cell(count, 'Number'), cell(total ? Math.round((count / total) * 100) : 0, 'Number')]));

  // Sheet 4 — Queries
  const s4 = [headerRow(['שאילתה', 'תחום', 'Intent', 'עדיפות'])];
  for (const q of queries) s4.push(row([cell(q.query_text), cell(q.topic), cell(q.intent || ''), cell(q.priority || 5, 'Number')]));
  if (queries.length === 0) s4.push(row([cell('—')]));

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Styles><Style ss:ID="hdr"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#00B5FE" ss:Pattern="Solid"/></Style></Styles>
${sheet('סיכום חודשי', s1, 6)}
${sheet('פילוח לפי מנוע', s2, 6)}
${sheet('נתח קול', s3, 3)}
${sheet('שאילתות', s4, 4)}
</Workbook>`;

  const safeName = String(clientName).replace(/[^\w֐-׿-]+/g, '_').slice(0, 40);
  return { xml, filename: `ai-visibility-${safeName}-${month}.xls`, month };
}
