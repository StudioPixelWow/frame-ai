import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/store';
import { hashPassword } from '@/lib/auth/passwords';
import crypto from 'crypto';

/**
 * POST /api/auth/seed
 *
 * Ensures default admin + demo users exist.
 * Safe to call multiple times — only creates users that don't exist yet.
 */
export async function POST() {
  try {
    const supabase = getSupabase();

    // Create table if needed
    await supabase
      .rpc('exec_sql', {
        query: `CREATE TABLE IF NOT EXISTS app_users (
        id TEXT PRIMARY KEY,
        data JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );`,
      })
      .catch((e: any) => console.warn('[Auth/Seed] Table creation warning:', e.message));

    const now = new Date().toISOString();

    const usersToSeed = [
      {
        email: 'admin@pixel.local',
        password: 'PixelAdmin2026!',
        role: 'admin' as const,
        displayName: 'מנהל ראשי — Pixel',
        linkedClientId: null,
        linkedEmployeeId: null,
      },
      {
        email: 'admin@pixeld.co',
        password: 'admin123',
        role: 'admin' as const,
        displayName: 'טל — מנהל',
        linkedClientId: null,
        linkedEmployeeId: null,
      },
      {
        email: 'employee@pixeld.co',
        password: 'employee123',
        role: 'employee' as const,
        displayName: 'עובד דוגמה',
        linkedClientId: null,
        linkedEmployeeId: null,
      },
      {
        email: 'client@pixeld.co',
        password: 'client123',
        role: 'client' as const,
        displayName: 'לקוח דוגמה',
        linkedClientId: null,
        linkedEmployeeId: null,
      },
    ];

    // Fetch existing users to check by email
    const { data: existingRows } = await supabase.from('app_users').select('id, data');
    const existingEmails = new Set(
      (existingRows || []).map((r: any) => (r.data?.email || '').toLowerCase())
    );

    const results = [];
    let created = 0;
    let skipped = 0;

    for (const user of usersToSeed) {
      // Skip if this email already exists
      if (existingEmails.has(user.email.toLowerCase())) {
        results.push({ email: user.email, role: user.role, status: 'exists' });
        skipped++;
        continue;
      }

      const id = `usr_${crypto.randomBytes(8).toString('hex')}`;
      const passwordHash = await hashPassword(user.password);

      const { error } = await supabase.from('app_users').insert({
        id,
        data: {
          email: user.email,
          passwordHash,
          role: user.role,
          displayName: user.displayName,
          linkedClientId: user.linkedClientId,
          linkedEmployeeId: user.linkedEmployeeId,
          isActive: true,
          lastLoginAt: null,
          createdAt: now,
          updatedAt: now,
        },
      });

      results.push({
        email: user.email,
        role: user.role,
        status: error ? 'error' : 'created',
        error: error?.message,
      });
      if (!error) created++;
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
    console.error('[Auth/Seed] Error:', error);
    return NextResponse.json({ error: 'שגיאה ביצירת משתמשים' }, { status: 500 });
  }
}
