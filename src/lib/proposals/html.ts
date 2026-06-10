/**
 * Proposal → premium, printable RTL HTML (Studio Pixel brand). Self-contained,
 * print-to-PDF ready. Pure render; no side effects.
 */

import type { Proposal, ProposalInput } from './engine';

function esc(s: any): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function proposalToHtml(p: Proposal, input: ProposalInput, opts: { logoUrl?: string } = {}): string {
  const today = new Date().toLocaleDateString('he-IL', { day: '2-digit', month: 'long', year: 'numeric' });
  const C = { primary: '#00B5FE', primaryDark: '#0095D0', text: '#1A1A2E', sub: '#5A5A7A', bg: '#F7F9FC', border: '#E8EAF0' };

  const deliverables = (p.deliverables || []).map((d) => `
    <div style="background:#fff;border:1px solid ${C.border};border-radius:14px;padding:16px 18px;margin-bottom:12px">
      <div style="font-weight:800;font-size:16px;color:${C.primaryDark};margin-bottom:8px">${esc(d.service)}</div>
      <ul style="margin:0;padding-inline-start:18px;color:${C.text};line-height:1.9;font-size:14px">
        ${(d.items || []).map((i) => `<li>${esc(i)}</li>`).join('')}
      </ul>
    </div>`).join('');

  const process = (p.process || []).map((s, i) => `
    <div style="display:flex;gap:12px;align-items:flex-start;margin-bottom:10px">
      <div style="flex-shrink:0;width:28px;height:28px;border-radius:50%;background:${C.primary};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px">${i + 1}</div>
      <div style="font-size:14px;color:${C.text};padding-top:3px">${esc(s)}</div>
    </div>`).join('');

  const whyUs = (p.whyUs || []).map((w) => `<li style="margin-bottom:6px">${esc(w)}</li>`).join('');

  return `<!doctype html><html dir="rtl" lang="he"><head><meta charset="utf-8">
<title>${esc(p.headline)} — ${esc(input.clientName)}</title>
<style>
  @media print { .noprint { display:none } body { padding:0 } }
  * { box-sizing:border-box }
  body { font-family:'Segoe UI',Arial,Helvetica,sans-serif; color:${C.text}; background:${C.bg}; max-width:820px; margin:0 auto; padding:28px; line-height:1.7 }
  h1,h2,h3 { margin:0 }
  .section { margin:26px 0 }
  .h { font-size:13px; font-weight:800; color:${C.primary}; letter-spacing:1px; margin-bottom:8px }
</style></head><body>

<div class="noprint" style="text-align:left;margin-bottom:14px">
  <button onclick="window.print()" style="background:${C.primary};color:#fff;border:none;border-radius:9px;padding:9px 20px;font-weight:700;cursor:pointer">🖨 שמור כ-PDF</button>
</div>

<!-- Hero -->
<div style="background:linear-gradient(135deg,${C.primary},${C.primaryDark});border-radius:18px;padding:34px 30px;color:#fff;margin-bottom:8px">
  ${opts.logoUrl ? `<img src="${esc(opts.logoUrl)}" alt="logo" style="height:38px;margin-bottom:14px;filter:brightness(0) invert(1)">` : ''}
  <div style="font-size:13px;font-weight:700;opacity:.9;letter-spacing:1px">הצעת עבודה · Studio Pixel</div>
  <h1 style="font-size:30px;font-weight:900;margin:8px 0 6px">${esc(p.headline)}</h1>
  <div style="font-size:15px;opacity:.95">${esc(input.clientName)}${input.businessField ? ` · ${esc(input.businessField)}` : ''} · ${today}</div>
</div>

<div class="section">
  <p style="font-size:15.5px;color:${C.text}">${esc(p.intro)}</p>
</div>

<div class="section">
  <div class="h">הבנת הצורך</div>
  <p style="font-size:14.5px;color:${C.sub}">${esc(p.understanding)}</p>
</div>

<div class="section">
  <div class="h">מה כולל השירות</div>
  ${deliverables || '<p style="color:#999">—</p>'}
</div>

<div class="section">
  <div class="h">מבנה החבילה</div>
  <div style="background:#fff;border:2px solid ${C.primary}30;border-radius:14px;padding:16px 18px;font-size:14.5px">${esc(p.packageSummary)}</div>
</div>

<div class="section">
  <div class="h">איך עובדים</div>
  ${process || '<p style="color:#999">—</p>'}
</div>

<div class="section">
  <div class="h">למה Studio Pixel</div>
  <ul style="font-size:14.5px;color:${C.text};padding-inline-start:18px;line-height:1.9">${whyUs || ''}</ul>
</div>

<div class="section" style="background:#fff;border:1px solid ${C.border};border-radius:14px;padding:20px 22px;text-align:center">
  <p style="font-size:16px;font-weight:700;color:${C.text};margin:0 0 4px">${esc(p.closing)}</p>
  <p style="font-size:13px;color:${C.sub};margin:6px 0 0">Studio Pixel · סוכנות שיווק דיגיטלי</p>
</div>

<p style="font-size:11px;color:#aaa;text-align:center;margin-top:22px">הופק ע"י PixelManageAI · ${today}</p>
</body></html>`;
}
