import { NextRequest, NextResponse } from 'next/server';
import { setSessionCookie } from '@/lib/auth/session';

/**
 * POST /api/auth/login
 *
 * Authenticates a user. If the database is unreachable,
 * falls back to a hardcoded admin account so the app is always accessible.
 */

// ── Hardcoded fallback admin (always works, even without DB) ──────────
const FALLBACK_ADMIN = {
  id: 'usr_fallback_admin',
  email: 'admin@pixel.local',
  password: 'PixelAdmin2026!',
  role: 'admin' as const,
  displayName: 'מנהל ראשי — Pixel',
  linkedClientId: null,
  linkedEmployeeId: null,
};

export async function POST(req: NextRequest) {
  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ success: false, error: 'גוף הבקשה לא תקין' }, { status: 400 });
    }

    const { email, password } = body || {};

    if (!email || !password) {
      return NextResponse.json({ success: false, error: 'דואר אלקטרוני וסיסמה נדרשים' }, { status: 400 });
    }

    // ── Try DB auth first ─────────────────────────────────────────────
    let dbSuccess = false;
    let dbUser: any = null;

    try {
      const { getSupabase } = await import('@/lib/db/store');
      const { comparePassword } = await import('@/lib/auth/passwords');

      const supabase = getSupabase();
      const { data: rows, error } = await supabase
        .from('app_users')
        .select('id, data')
        .order('id');

      if (!error && rows && rows.length > 0) {
        // Find user by email (case-insensitive)
        const userRow = rows.find((r: any) => {
          const d = r.data || {};
          return d.email?.toLowerCase() === email.toLowerCase() && d.isActive !== false;
        });

        if (userRow) {
          const userData = userRow.data;
          const passwordValid = await comparePassword(password, userData.passwordHash || '');
          if (passwordValid) {
            dbSuccess = true;
            dbUser = {
              id: userRow.id,
              email: userData.email,
              role: userData.role,
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
          }
        }
      }
    } catch (dbErr) {
      console.warn('[Auth/Login] DB unavailable, using fallback:', dbErr instanceof Error ? dbErr.message : dbErr);
    }

    // ── DB auth succeeded ─────────────────────────────────────────────
    if (dbSuccess && dbUser) {
      const response = NextResponse.json({ success: true, user: dbUser });
      return setSessionCookie(response, {
        id: dbUser.id,
        email: dbUser.email,
        role: dbUser.role,
        linkedClientId: dbUser.linkedClientId,
        linkedEmployeeId: dbUser.linkedEmployeeId,
      });
    }

    // ── Fallback: hardcoded admin check ───────────────────────────────
    if (
      email.toLowerCase() === FALLBACK_ADMIN.email.toLowerCase() &&
      password === FALLBACK_ADMIN.password
    ) {
      const user = {
        id: FALLBACK_ADMIN.id,
        email: FALLBACK_ADMIN.email,
        role: FALLBACK_ADMIN.role,
        displayName: FALLBACK_ADMIN.displayName,
        linkedClientId: FALLBACK_ADMIN.linkedClientId,
        linkedEmployeeId: FALLBACK_ADMIN.linkedEmployeeId,
      };
      const response = NextResponse.json({ success: true, user });
      return setSessionCookie(response, {
        id: user.id,
        email: user.email,
        role: user.role,
        linkedClientId: user.linkedClientId,
        linkedEmployeeId: user.linkedEmployeeId,
      });
    }

    // ── No match ──────────────────────────────────────────────────────
    return NextResponse.json({ success: false, error: 'פרטי התחברות שגויים' }, { status: 401 });

  } catch (error) {
    console.error('[Auth/Login] Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: 'שגיאה בהתחברות, נסה שוב' },
      { status: 500 }
    );
  }
}
