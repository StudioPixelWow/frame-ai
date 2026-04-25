import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/store';
import { getSession } from '@/lib/auth/session';

export async function GET(req: NextRequest) {
  try {
    // Only admins can look up users
    const session = getSession(req);
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'נדרשת הרשאת מנהל' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const linkedClientId = searchParams.get('linkedClientId');
    const linkedEmployeeId = searchParams.get('linkedEmployeeId');

    if (!linkedClientId && !linkedEmployeeId) {
      return NextResponse.json({ error: 'נדרש linkedClientId או linkedEmployeeId' }, { status: 400 });
    }

    const supabase = getSupabase();
    const { data: users } = await supabase
      .from('app_users')
      .select('id, data')
      .order('id');

    if (!users || users.length === 0) {
      return NextResponse.json({ user: null });
    }

    const match = users.find((row: any) => {
      const d = row.data;
      if (!d || !d.isActive) return false;
      if (linkedClientId && d.linkedClientId === linkedClientId) return true;
      if (linkedEmployeeId && d.linkedEmployeeId === linkedEmployeeId) return true;
      return false;
    });

    if (!match) {
      return NextResponse.json({ user: null });
    }

    return NextResponse.json({
      user: {
        id: match.id,
        email: match.data.email,
        role: match.data.role,
        displayName: match.data.displayName,
        createdAt: match.data.createdAt,
      },
    });
  } catch (error) {
    console.error('[Auth/FindUser] Error:', error);
    return NextResponse.json({ error: 'שגיאה בחיפוש משתמש' }, { status: 500 });
  }
}
