import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/store';
import { hashPassword } from '@/lib/auth/passwords';
import crypto from 'crypto';

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

    // Check if users already exist
    const { data: existing } = await supabase.from('app_users').select('id').limit(1);
    if (existing && existing.length > 0) {
      return NextResponse.json({
        message: 'משתמשים כבר קיימים. מחק ידנית לפני seed חדש.',
        skipped: true,
      });
    }

    const now = new Date().toISOString();

    const users = [
      {
        id: `usr_${crypto.randomBytes(8).toString('hex')}`,
        email: 'admin@pixeld.co',
        password: 'admin123',
        role: 'admin' as const,
        displayName: 'טל — מנהל',
        linkedClientId: null,
        linkedEmployeeId: null,
      },
      {
        id: `usr_${crypto.randomBytes(8).toString('hex')}`,
        email: 'employee@pixeld.co',
        password: 'employee123',
        role: 'employee' as const,
        displayName: 'עובד דוגמה',
        linkedClientId: null,
        linkedEmployeeId: null,
      },
      {
        id: `usr_${crypto.randomBytes(8).toString('hex')}`,
        email: 'client@pixeld.co',
        password: 'client123',
        role: 'client' as const,
        displayName: 'לקוח דוגמה',
        linkedClientId: null,
        linkedEmployeeId: null,
      },
    ];

    const results = [];
    for (const user of users) {
      const passwordHash = await hashPassword(user.password);
      const { error } = await supabase.from('app_users').insert({
        id: user.id,
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
        password: user.password,
        success: !error,
        error: error?.message,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'משתמשי ברירת מחדל נוצרו בהצלחה',
      users: results,
    });
  } catch (error) {
    console.error('[Auth/Seed] Error:', error);
    return NextResponse.json({ error: 'שגיאה ביצירת משתמשים' }, { status: 500 });
  }
}
