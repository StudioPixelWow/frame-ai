import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/store';
import { hashPassword } from '@/lib/auth/passwords';
import { getSession } from '@/lib/auth/session';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const session = getSession(req);
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'נדרשת הרשאת מנהל' }, { status: 403 });
    }

    const { userId, newPassword } = await req.json();
    if (!userId) {
      return NextResponse.json({ error: 'מזהה משתמש נדרש' }, { status: 400 });
    }

    const supabase = getSupabase();
    const { data: row, error } = await supabase
      .from('app_users')
      .select('id, data')
      .eq('id', userId)
      .single();

    if (error || !row) {
      return NextResponse.json({ error: 'משתמש לא נמצא' }, { status: 404 });
    }

    const finalPassword = newPassword || crypto.randomBytes(6).toString('base64').slice(0, 10);
    const passwordHash = await hashPassword(finalPassword);

    const updatedData = {
      ...row.data,
      passwordHash,
      updatedAt: new Date().toISOString(),
    };

    await supabase.from('app_users').update({ data: updatedData }).eq('id', userId);

    return NextResponse.json({
      success: true,
      generatedPassword: !newPassword ? finalPassword : undefined,
    });
  } catch (error) {
    console.error('[Auth/ResetPassword] Error:', error);
    return NextResponse.json({ error: 'שגיאה באיפוס סיסמה' }, { status: 500 });
  }
}
