import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/store';
import { comparePassword } from '@/lib/auth/passwords';
import { setSessionCookie } from '@/lib/auth/session';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'דואר אלקטרוני וסיסמה נדרשים' }, { status: 400 });
    }

    const supabase = getSupabase();
    const { data: rows, error } = await supabase
      .from('app_users')
      .select('id, data')
      .order('id');

    if (error) {
      console.error('[Auth/Login] DB error:', error.message);
      return NextResponse.json({ error: 'שגיאת מערכת' }, { status: 500 });
    }

    // Find user by email (case-insensitive)
    const userRow = (rows || []).find((r: any) => {
      const d = r.data || {};
      return d.email?.toLowerCase() === email.toLowerCase() && d.isActive !== false;
    });

    if (!userRow) {
      return NextResponse.json({ error: 'פרטי התחברות שגויים' }, { status: 401 });
    }

    const userData = userRow.data;

    // Verify password
    const passwordValid = await comparePassword(password, userData.passwordHash || '');
    if (!passwordValid) {
      return NextResponse.json({ error: 'פרטי התחברות שגויים' }, { status: 401 });
    }

    // Update last login
    try {
      await supabase
        .from('app_users')
        .update({ data: { ...userData, lastLoginAt: new Date().toISOString() } })
        .eq('id', userRow.id);
    } catch {}

    // Set session cookie
    const response = NextResponse.json({
      success: true,
      user: {
        id: userRow.id,
        email: userData.email,
        role: userData.role,
        displayName: userData.displayName || userData.email,
        linkedClientId: userData.linkedClientId || null,
        linkedEmployeeId: userData.linkedEmployeeId || null,
      },
    });

    return setSessionCookie(response, {
      id: userRow.id,
      email: userData.email,
      role: userData.role,
      linkedClientId: userData.linkedClientId,
      linkedEmployeeId: userData.linkedEmployeeId,
    });
  } catch (error) {
    console.error('[Auth/Login] Error:', error);
    return NextResponse.json({ error: 'שגיאה בכניסה למערכת' }, { status: 500 });
  }
}
