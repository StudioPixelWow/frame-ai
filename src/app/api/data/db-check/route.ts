/**
 * GET /api/data/db-check — one-shot DB connectivity diagnostic.
 *
 * Safe to expose: returns ONLY booleans / timings / error messages, never the
 * actual key values. Use this to tell apart the three failure modes behind the
 * 500/504 errors on /api/data/* :
 *   1) env missing      → hasServiceRole=false  → set SUPABASE_SERVICE_ROLE_KEY in Vercel
 *   2) key rejected     → query error mentions JWT / apikey / permission
 *   3) slow / hung query → query timing high or "timeout"
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

async function timedCount(sb: any, table: string, ms = 8000) {
  const t0 = Date.now();
  try {
    const q = sb.from(table).select('id', { count: 'exact', head: true });
    const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error(`timeout after ${ms}ms`)), ms));
    const { count, error } = (await Promise.race([q, timeout])) as any;
    return { table, ok: !error, count: count ?? null, ms: Date.now() - t0, error: error?.message || null };
  } catch (e) {
    return { table, ok: false, count: null, ms: Date.now() - t0, error: e instanceof Error ? e.message : 'error' };
  }
}

export async function GET() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    'https://uaruggdabeyiuppcvbbi.supabase.co';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  // Decode the JWT "role" claim (NOT secret — it's public in every anon key).
  // This tells us if the value in SUPABASE_SERVICE_ROLE_KEY is actually the
  // service_role key, or the anon key pasted by mistake (which is subject to RLS).
  let keyRole: string | null = null;
  let keyRef: string | null = null;
  try {
    const payload = JSON.parse(Buffer.from(key.split('.')[1] || '', 'base64').toString('utf8'));
    keyRole = payload?.role ?? null;
    keyRef = payload?.ref ?? null;
  } catch { /* not a JWT */ }

  const env = {
    hasNextPublicUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasSupabaseUrl: !!process.env.SUPABASE_URL,
    hasServiceRoleKey: !!key,
    serviceRoleKeyLength: key.length,                 // length only, never the value
    keyRole,                                          // 'service_role' expected — 'anon' = WRONG KEY
    keyRef,                                           // project ref embedded in the key
    urlHost: (() => { try { return new URL(url).host; } catch { return null; } })(),
    runtime: process.env.VERCEL ? 'vercel' : 'local',
  };

  // Raw REST probe — bypasses supabase-js so we see the real HTTP status.
  let rawProbe: any = null;
  try {
    const t0 = Date.now();
    const res = await fetch(`${url}/rest/v1/clients?select=id&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(8000),
    });
    const body = (await res.text().catch(() => '')).slice(0, 200);
    rawProbe = { status: res.status, ms: Date.now() - t0, body };
  } catch (e) {
    rawProbe = { status: null, error: e instanceof Error ? e.message : 'error' };
  }

  if (!key) {
    return NextResponse.json({
      ok: false,
      diagnosis: 'SUPABASE_SERVICE_ROLE_KEY חסר ב-Vercel — זו הסיבה ל-500 על כל ה-endpoints. הוסף אותו ב-Settings → Environment Variables ועשה Redeploy.',
      env,
    }, { status: 200 });
  }

  if (keyRole && keyRole !== 'service_role') {
    return NextResponse.json({
      ok: false,
      diagnosis: `המפתח ב-SUPABASE_SERVICE_ROLE_KEY הוא מסוג "${keyRole}", לא service_role! זו הסיבה — הוא כפוף ל-RLS והבקשות נתקעות. החלף ל-service_role (Supabase → Settings → API → service_role secret) ב-Vercel ועשה Redeploy.`,
      env, rawProbe,
    }, { status: 200 });
  }

  let sb: any;
  try {
    sb = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  } catch (e) {
    return NextResponse.json({ ok: false, diagnosis: 'יצירת לקוח Supabase נכשלה', env, error: e instanceof Error ? e.message : 'error' }, { status: 200 });
  }

  const checks = [];
  for (const t of ['clients', 'tasks']) {
    checks.push(await timedCount(sb, t));
  }

  const anyAuthErr = checks.find((c) => c.error && /jwt|apikey|api key|permission|not authorized|invalid|expired/i.test(c.error));
  const anyTimeout = checks.find((c) => c.error && /timeout/i.test(c.error));

  let diagnosis = 'החיבור תקין — אם עדיין יש 500, בדוק את הלוגים של הפונקציה הספציפית.';
  if (anyAuthErr) diagnosis = `המפתח קיים אך נדחה ע"י Supabase (${anyAuthErr.error}). ייתכן שמפתח ה-service_role הוחלף/הושבת — צור מפתח חדש ב-Supabase → Settings → API ועדכן ב-Vercel.`;
  else if (anyTimeout) diagnosis = 'השאילתות נתקעות (timeout) — בעיית עומס/connection pool ב-Supabase. בדוק Database → Pooler, או הפעל מחדש את הפרויקט.';

  return NextResponse.json({
    ok: checks.every((c) => c.ok),
    diagnosis,
    env,
    rawProbe,
    checks,
  }, { status: 200 });
}
