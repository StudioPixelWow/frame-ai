import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

/**
 * POST /api/auth/login
 *
 * Completely self-contained — no external auth imports.
 * 1. Checks hardcoded admin FIRST (zero DB, zero modules)
 * 2. Then tries DB auth for other users
 * 3. NEVER returns 500
 */

const JWT_SECRET = process.env.JWT_SECRET || 'frameai-dev-secret-change-in-production-2026';
const AUTH_COOKIE = 'frameai_session';

// ── Hardcoded admin ───────────────────────────────────────────────────
const ADMIN_EMAIL = 'admin@pixel.local';
const ADMIN_PASSWORD = 'PixelAdmin2026!';

// ── Inline JWT (no external imports) ──────────────────────────────────

function b64url(input: string | Buffer): string {
  const b = typeof input === 'string' ? Buffer.from(input) : input;
  return b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function makeToken(payload: Record<string, any>): string {
  const now = Math.floor(Date.now() / 1000);
  const full = { ...payload, iat: now, exp: now + 86400 };
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(full));
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest();
  return `${header}.${body}.${b64url(sig)}`;
}

function buildSuccessResponse(user: {
  id: string; email: string; role: string; displayName: string;
  linkedClientId: string | null; linkedEmployeeId: string | null;
}): NextResponse {
  const response = NextResponse.json({ success: true, user });

  const token = makeToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    clientId: user.linkedClientId,
    employeeId: user.linkedEmployeeId,
  });

  response.cookies.set(AUTH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 86400,
  });

  return response;
}

// ── Route handler ─────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let email = '';
  let password = '';

  try {
    const body = await req.json();
    email = (body?.email || '').trim();
    password = body?.password || '';
  } catch {
    return NextResponse.json({ success: false, error: 'גוף הבקשה לא תקין' }, { status: 400 });
  }

  if (!email || !password) {
    return NextResponse.json({ success: false, error: 'דואר אלקטרוני וסיסמה נדרשים' }, { status: 400 });
  }

  // ── STEP 1: Hardcoded admin — ALWAYS works ──────────────────────────
  if (email.toLowerCase() === ADMIN_EMAIL.toLowerCase() && password === ADMIN_PASSWORD) {
    console.log('[Auth/Login] Admin login success (hardcoded)');
    return buildSuccessResponse({
      id: 'usr_fallback_admin',
      email: ADMIN_EMAIL,
      role: 'admin',
      displayName: 'מנהל ראשי — Pixel',
      linkedClientId: null,
      linkedEmployeeId: null,
    });
  }

  // ── STEP 2: DB auth for other users ─────────────────────────────────
  try {
    const { getSupabase } = await import('@/lib/db/store');
    const { comparePassword } = await import('@/lib/auth/passwords');

    const supabase = getSupabase();
    const { data: rows, error } = await supabase
      .from('app_users')
      .select('id, data')
      .order('id');

    if (!error && rows && rows.length > 0) {
      const userRow = (rows as any[]).find((r) => {
        const d = r.data || {};
        return d.email?.toLowerCase() === email.toLowerCase() && d.isActive !== false;
      });

      if (userRow) {
        const userData = userRow.data;
        let valid = false;
        try { valid = await comparePassword(password, userData.passwordHash || ''); } catch {}

        if (valid) {
          // Update last login (fire-and-forget)
          try {
            await supabase
              .from('app_users')
              .update({ data: { ...userData, lastLoginAt: new Date().toISOString() } })
              .eq('id', userRow.id);
          } catch {}

          return buildSuccessResponse({
            id: userRow.id,
            email: userData.email,
            role: userData.role || 'employee',
            displayName: userData.displayName || userData.email,
            linkedClientId: userData.linkedClientId || null,
            linkedEmployeeId: userData.linkedEmployeeId || null,
          });
        }
      }
    }
  } catch (dbErr) {
    console.warn('[Auth/Login] DB unavailable:', dbErr instanceof Error ? dbErr.message : String(dbErr));
  }

  // ── Wrong credentials ───────────────────────────────────────────────
  return NextResponse.json({ success: false, error: 'פרטי התחברות שגויים' }, { status: 401 });
}
