/**
 * GET /api/meta-business/diagnose?clientId=optional
 *
 * Pinpoints EXACTLY why Meta optimization (writes) may not be working — instead
 * of guessing "the business isn't verified". Runs, in order:
 *   1. Token present?                  (system token / per-client token)
 *   2. Token valid?                    GET /me
 *   3. Which permissions are granted?  GET /debug_token  → needs ads_management
 *   4. Ad account reachable?           GET /act_{id}
 *   5. REAL no-op write test           POST /{campaignId} { name: <same name> }
 *      (renames a campaign to its own name — exercises ads_management write with
 *       zero real effect; the resulting error tells us precisely what's blocked.)
 *
 * Returns a structured checklist + a Hebrew explanation + the concrete fix.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSystemMetaToken, resolveMetaToken } from '@/lib/meta-ads/token';
import { getClientAdAccounts } from '@/lib/meta-ads/client-accounts';
import { getSupabase } from '@/lib/db/store';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const V = 'v19.0';
const BASE = `https://graph.facebook.com/${V}`;

type Check = { id: string; label: string; ok: boolean; detail: string; fix?: string };

async function gget(path: string, token: string) {
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`${BASE}/${path}${sep}access_token=${encodeURIComponent(token)}`, { signal: AbortSignal.timeout(15000) });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json };
}
async function gpost(path: string, token: string, body: Record<string, unknown>) {
  const res = await fetch(`${BASE}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, access_token: token }),
    signal: AbortSignal.timeout(15000),
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json };
}

/** Turn a Graph API error into a plain-Hebrew cause + fix. */
function explainError(err: any): { cause: string; fix: string } {
  const code = err?.code;
  const sub = err?.error_subcode;
  const msg: string = err?.error_user_msg || err?.message || '';
  if (code === 190 || sub === 463) return { cause: 'הטוקן פג תוקף או בוטל.', fix: 'הפק טוקן חדש (עדיף System User לא-פג-תוקף) והדבק אותו בהגדרות Meta.' };
  if (code === 200 || code === 10 || /permission|ads_management|#200/i.test(msg)) {
    return { cause: 'לטוקן חסרה הרשאת ניהול מודעות (ads_management) על החשבון הזה.', fix: 'ודא שהטוקן כולל ads_management ושל-System User יש תפקיד אדמין/מפרסם על חשבון המודעות.' };
  }
  if (code === 272 || code === 294 || /not have permission|admin|role/i.test(msg)) {
    return { cause: 'אין הרשאת ניהול על חשבון המודעות (החשבון לא משויך ל-Business Manager שלך או חסר תפקיד).', fix: 'צרף את חשבון המודעות ל-Business Manager שלך ותן ל-System User תפקיד אדמין.' };
  }
  if (code === 17 || code === 4 || code === 80004 || sub === 2446079 || /rate|limit|throttle/i.test(msg)) {
    return { cause: 'נחסם זמנית בגלל תקרת קצב (Development tier — תקרה נמוכה).', fix: 'זה דווקא סימן טוב — הכתיבה מותרת. כדי להעלות תקרה: השלם App Review + אימות עסק ל-Standard tier.' };
  }
  return { cause: msg || `שגיאת Graph API (code ${code ?? '?'}).`, fix: 'בדוק את פרטי השגיאה הגולמית למטה.' };
}

export async function GET(req: NextRequest) {
  const clientId = req.nextUrl.searchParams.get('clientId') || '';
  const checks: Check[] = [];
  let writeCapable = false;
  let raw: any = null;

  // ── 1. Token present ──
  let token: string | null = null;
  try {
    if (clientId) {
      const sb = getSupabase();
      const { data: c } = await sb.from('clients').select('meta_access_token').eq('id', clientId).maybeSingle();
      token = await resolveMetaToken((c as any)?.meta_access_token || null);
    } else {
      token = await getSystemMetaToken();
    }
  } catch { /* ignore */ }

  if (!token) {
    checks.push({ id: 'token', label: 'טוקן Meta', ok: false, detail: 'לא נמצא טוקן מוגדר.', fix: 'חבר את Meta בהגדרות, או הדבק טוקן System User.' });
    return NextResponse.json({ ok: false, writeCapable: false, checks, summary: 'אין טוקן Meta מוגדר — חבר תחילה.' });
  }
  checks.push({ id: 'token', label: 'טוקן Meta', ok: true, detail: 'נמצא טוקן.' });

  // ── 2. Token valid (/me) ──
  const me = await gget('me?fields=id,name', token);
  if (!me.ok) {
    const e = explainError(me.json?.error);
    checks.push({ id: 'valid', label: 'תקפות הטוקן', ok: false, detail: e.cause, fix: e.fix });
    return NextResponse.json({ ok: false, writeCapable: false, checks, summary: e.cause, raw: me.json?.error });
  }
  checks.push({ id: 'valid', label: 'תקפות הטוקן', ok: true, detail: `מחובר כ-${me.json?.name || me.json?.id}` });

  // ── 3. Permissions (/debug_token) ──
  try {
    const dbg = await gget(`debug_token?input_token=${encodeURIComponent(token)}`, token);
    const scopes: string[] = dbg.json?.data?.scopes || [];
    const hasMgmt = scopes.includes('ads_management');
    const hasRead = scopes.includes('ads_read');
    checks.push({
      id: 'scopes', label: 'הרשאות', ok: hasMgmt,
      detail: scopes.length ? `הרשאות: ${scopes.join(', ')}` : 'לא ניתן לקרוא הרשאות.',
      fix: hasMgmt ? undefined : `חסרה הרשאת ads_management${hasRead ? '' : ' (וגם ads_read)'} — הפק טוקן עם ההרשאות האלה.`,
    });
  } catch {
    checks.push({ id: 'scopes', label: 'הרשאות', ok: false, detail: 'בדיקת ההרשאות נכשלה.' });
  }

  // ── 4 + 5. Ad account reachable + real no-op write test ──
  const accounts = clientId ? await getClientAdAccounts(clientId) : [];
  // If no client given, try to discover one account the token can see.
  let acct = accounts[0] || '';
  if (!acct) {
    const list = await gget('me/adaccounts?fields=id,name&limit=1', token);
    acct = list.json?.data?.[0]?.id || '';
  }
  if (!acct) {
    checks.push({ id: 'account', label: 'חשבון מודעות', ok: false, detail: 'לא נמצא חשבון מודעות לבדיקה.', fix: 'שייך חשבון מודעות ללקוח, או ודא של-System User יש גישה לחשבון.' });
    return NextResponse.json({ ok: false, writeCapable: false, checks, summary: 'אין חשבון מודעות לבדוק עליו כתיבה.' });
  }
  const acctId = acct.startsWith('act_') ? acct : `act_${acct}`;

  const acctRes = await gget(`${acctId}?fields=name,account_status,currency`, token);
  if (!acctRes.ok) {
    const e = explainError(acctRes.json?.error);
    checks.push({ id: 'account', label: 'חשבון מודעות', ok: false, detail: e.cause, fix: e.fix });
    return NextResponse.json({ ok: false, writeCapable: false, checks, summary: e.cause, raw: acctRes.json?.error });
  }
  checks.push({ id: 'account', label: 'חשבון מודעות', ok: true, detail: `${acctRes.json?.name || acctId} (${acctRes.json?.currency || ''})` });

  // Pick a campaign to no-op write on.
  const camp = await gget(`${acctId}/campaigns?fields=id,name&limit=1`, token);
  const campId = camp.json?.data?.[0]?.id;
  const campName = camp.json?.data?.[0]?.name;
  if (!campId) {
    checks.push({ id: 'write', label: 'בדיקת כתיבה', ok: false, detail: 'אין קמפיין לבצע עליו בדיקת כתיבה (החשבון ריק).', fix: 'צור קמפיין אחד (אפשר מושהה) ונסה שוב.' });
    return NextResponse.json({ ok: false, writeCapable: false, checks, summary: 'אין קמפיין לבדיקת כתיבה.' });
  }

  // The actual write test — rename the campaign to its own name (no real change).
  const writeRes = await gpost(`${campId}`, token, { name: campName || 'Campaign' });
  if (writeRes.ok) {
    writeCapable = true;
    checks.push({ id: 'write', label: 'בדיקת כתיבה אמיתית', ok: true, detail: '✓ כתיבה ל-Meta עובדת! האופטימיזציה יכולה לבצע שינויים בפועל.' });
  } else {
    raw = writeRes.json?.error;
    const e = explainError(writeRes.json?.error);
    checks.push({ id: 'write', label: 'בדיקת כתיבה אמיתית', ok: false, detail: e.cause, fix: e.fix });
  }

  const summary = writeCapable
    ? 'הכל תקין — כתיבה ל-Meta עובדת. אם האופטימיזציה לא רצה, הבעיה אינה ההרשאות אלא הגדרת המנוע/קרון.'
    : (checks.find((c) => !c.ok)?.detail || 'הכתיבה ל-Meta חסומה — ראה פירוט.');

  return NextResponse.json({ ok: writeCapable, writeCapable, account: acctId, checks, summary, raw });
}
