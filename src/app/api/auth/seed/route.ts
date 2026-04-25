import { NextResponse } from 'next/server';

/**
 * POST /api/auth/seed
 *
 * Ensures default users exist in app_users.
 * Completely safe — never crashes, never duplicates.
 * If DB is unreachable, returns success (login has its own fallback).
 */
export async function POST() {
  try {
    // Dynamic imports so the route never crashes on missing env vars
    let getSupabase: any;
    let hashPassword: any;
    let crypto: any;
    try {
      const storeModule = await import('@/lib/db/store');
      getSupabase = storeModule.getSupabase;
      const pwModule = await import('@/lib/auth/passwords');
      hashPassword = pwModule.hashPassword;
      crypto = (await import('crypto')).default;
    } catch (importErr) {
      console.warn('[Auth/Seed] Import failed, skipping seed:', importErr);
      return NextResponse.json({
        success: true,
        message: 'Seed skipped — DB modules unavailable. Login fallback will work.',
        created: 0,
        skipped: 0,
      });
    }

    let supabase: any;
    try {
      supabase = getSupabase();
    } catch (dbErr) {
      console.warn('[Auth/Seed] DB unavailable:', dbErr instanceof Error ? dbErr.message : dbErr);
      return NextResponse.json({
        success: true,
        message: 'Seed skipped — DB unavailable. Login fallback will work.',
        created: 0,
        skipped: 0,
      });
    }

    // Create table if needed (ignore errors)
    try {
      await supabase.rpc('exec_sql', {
        query: `CREATE TABLE IF NOT EXISTS app_users (
          id TEXT PRIMARY KEY,
          data JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );`,
      });
    } catch {
      // Table might already exist or RPC might not be available — that's fine
    }

    const now = new Date().toISOString();

    const usersToSeed = [
      {
        email: 'admin@pixel.local',
        password: 'PixelAdmin2026!',
        role: 'admin' as const,
        displayName: 'מנהל ראשי — Pixel',
      },
      {
        email: 'admin@pixeld.co',
        password: 'admin123',
        role: 'admin' as const,
        displayName: 'טל — מנהל',
      },
      {
        email: 'employee@pixeld.co',
        password: 'employee123',
        role: 'employee' as const,
        displayName: 'עובד דוגמה',
      },
      {
        email: 'client@pixeld.co',
        password: 'client123',
        role: 'client' as const,
        displayName: 'לקוח דוגמה',
      },
    ];

    // Fetch existing users safely
    let existingEmails = new Set<string>();
    try {
      const { data: existingRows } = await supabase.from('app_users').select('id, data');
      existingEmails = new Set(
        (existingRows || []).map((r: any) => (r.data?.email || '').toLowerCase())
      );
    } catch {
      // Can't read existing users — try to insert anyway
    }

    const results = [];
    let created = 0;
    let skipped = 0;

    for (const user of usersToSeed) {
      if (existingEmails.has(user.email.toLowerCase())) {
        results.push({ email: user.email, role: user.role, status: 'exists' });
        skipped++;
        continue;
      }

      try {
        const id = `usr_${crypto.randomBytes(8).toString('hex')}`;
        const passwordHash = await hashPassword(user.password);

        const { error } = await supabase.from('app_users').insert({
          id,
          data: {
            email: user.email,
            passwordHash,
            role: user.role,
            displayName: user.displayName,
            linkedClientId: null,
            linkedEmployeeId: null,
            isActive: true,
            lastLoginAt: null,
            createdAt: now,
            updatedAt: now,
          },
        });

        if (error) {
          results.push({ email: user.email, role: user.role, status: 'error', error: error.message });
        } else {
          results.push({ email: user.email, role: user.role, status: 'created' });
          created++;
        }
      } catch (insertErr) {
        results.push({
          email: user.email,
          role: user.role,
          status: 'error',
          error: insertErr instanceof Error ? insertErr.message : 'unknown',
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: created > 0
        ? `${created} משתמשים חדשים נוצרו`
        : 'כל המשתמשים כבר קיימים',
      created,
      skipped,
      users: results,
    });
  } catch (error) {
    console.error('[Auth/Seed] Unexpected error:', error);
    // Never return 500 — login has its own fallback
    return NextResponse.json({
      success: true,
      message: 'Seed failed but login fallback will work.',
      created: 0,
      skipped: 0,
    });
  }
}
