import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/auth/login
 *
 * 1. Checks hardcoded admin FIRST (always works, no DB needed)
 * 2. Then tries DB auth for other users
 * 3. Never throws — every path returns a proper JSON response
 */

// ── Hardcoded admin — guaranteed to work ──────────────────────────────
const ADMIN_EMAIL = 'admin@pixel.local';
const ADMIN_PASSWORD = 'PixelAdmin2026!';
const ADMIN_USER = {
  id: 'usr_fallback_admin',
  email: ADMIN_EMAIL,
  role: 'admin' as const,
  displayName: 'מנהל ראשי — Pixel',
  linkedClientId: null as string | null,
  linkedEmployeeId: null as string | null,
};

/** Build session cookie safely — if JWT/cookie fails, return response without cookie */
function safeSetCookie(response: NextResponse, user: typeof ADMIN_USER): NextResponse {
  try {
    const { setSessionCookie } = require('@/lib/auth/session');
    return setSessionCookie(response, {
      id: user.id,
      email: user.email,
      role: user.role,
      linkedClientId: user.linkedClientId,
      linkedEmployeeId: user.linkedEmployeeId,
    });
  } catch (cookieErr) {
    console.warn('[Auth/Login] Cookie set failed:', cookieErr);
    // Return response anyway — localStorage auth will work as fallback
    return response;
  }
}

export async function POST(req: NextRequest) {
  // ── Parse body safely ───────────────────────────────────────────────
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

  // ── STEP 1: Check hardcoded admin FIRST (no DB needed) ──────────────
  if (email.toLowerCase() === ADMIN_EMAIL.toLowerCase() && password === ADMIN_PASSWORD) {
    console.log('[Auth/Login] Admin fallback login success');
    const response = NextResponse.json({ success: true, user: ADMIN_USER });
    return safeSetCookie(response, ADMIN_USER);
  }

  // ── STEP 2: Try DB auth for all other users ─────────────────────────
  try {
    const { getSupabase } = await import('@/lib/db/store');
    const { comparePassword } = await import('@/lib/auth/passwords');

    const supabase = getSupabase();
    const { data: rows, error } = await supabase
      .from('app_users')
      .select('id, data')
      .order('id');

    if (error) {
      console.warn('[Auth/Login] DB query error:', error.message);
      // DB failed but this isn't the admin account — wrong creds
      return NextResponse.json({ success: false, error: 'פרטי התחברות שגויים' }, { status: 401 });
    }

    if (!rows || rows.length === 0) {
      return NextResponse.json({ success: false, error: 'פרטי התחברות שגויים' }, { status: 401 });
    }

    // Find user by email (case-insensitive)
    const userRow = (rows as any[]).find((r) => {
      const d = r.data || {};
      return d.email?.toLowerCase() === email.toLowerCase() && d.isActive !== false;
    });

    if (!userRow) {
      return NextResponse.json({ success: false, error: 'פרטי התחברות שגויים' }, { status: 401 });
    }

    const userData = userRow.data;

    // Verify password
    let passwordValid = false;
    try {
      passwordValid = await comparePassword(password, userData.passwordHash || '');
    } catch (pwErr) {
      console.warn('[Auth/Login] Password compare error:', pwErr);
    }

    if (!passwordValid) {
      return NextResponse.json({ success: false, error: 'פרטי התחברות שגויים' }, { status: 401 });
    }

    // Success — build user response
    const dbUser = {
      id: userRow.id,
      email: userData.email,
      role: userData.role || 'employee',
      displayName: userData.displayName || userData.email,
      linkedClientId: userData.linkedClientId || null,
      linkedEmployeeId: userData.linkedEmployeeId || null,
    };

    // Update last login (fire-and-forget)
    try {
      await supabase
        .from('app_users')
        .update({ data: { ...userData, lastLoginAt: new Date().toISOString() } })
        .eq('id', userRow.id);
    } catch {}

    const response = NextResponse.json({ success: true, user: dbUser });
    return safeSetCookie(response, dbUser);

  } catch (dbErr) {
    console.warn('[Auth/Login] DB unavailable:', dbErr instanceof Error ? dbErr.message : dbErr);
    // DB completely failed — since we already checked admin above, this is wrong creds
    return NextResponse.json({ success: false, error: 'פרטי התחברות שגויים' }, { status: 401 });
  }
}
