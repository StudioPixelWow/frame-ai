import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/store';
import { hashPassword } from '@/lib/auth/passwords';
import { getSession } from '@/lib/auth/session';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    // Only admins can create users
    const session = getSession(req);
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'נדרשת הרשאת מנהל' }, { status: 403 });
    }

    const body = await req.json();
    const { email, password, role, displayName, linkedClientId, linkedEmployeeId } = body;

    if (!email || !role) {
      return NextResponse.json({ error: 'דואר אלקטרוני ותפקיד נדרשים' }, { status: 400 });
    }

    if (!['admin', 'employee', 'client'].includes(role)) {
      return NextResponse.json({ error: 'תפקיד לא חוקי' }, { status: 400 });
    }

    const supabase = getSupabase();

    // Check if email already exists
    const { data: existing } = await supabase
      .from('app_users')
      .select('id, data')
      .order('id');

    const emailExists = (existing || []).some(
      (r: any) => r.data?.email?.toLowerCase() === email.toLowerCase()
    );
    if (emailExists) {
      return NextResponse.json({ error: 'כתובת דואר אלקטרוני כבר קיימת' }, { status: 409 });
    }

    // Generate password if not provided
    const finalPassword = password || crypto.randomBytes(6).toString('base64').slice(0, 10);
    const passwordHash = await hashPassword(finalPassword);

    const now = new Date().toISOString();
    const userId = `usr_${crypto.randomBytes(8).toString('hex')}`;

    const userData = {
      email: email.toLowerCase(),
      passwordHash,
      role,
      displayName: displayName || email.split('@')[0],
      linkedClientId: linkedClientId || null,
      linkedEmployeeId: linkedEmployeeId || null,
      isActive: true,
      lastLoginAt: null,
      createdAt: now,
      updatedAt: now,
    };

    const { error } = await supabase
      .from('app_users')
      .insert({ id: userId, data: userData });

    if (error) {
      console.error('[Auth/CreateUser] DB error:', error.message);
      // Try creating table if it doesn't exist
      if (error.message.includes('does not exist') || error.code === '42P01') {
        await supabase.rpc('exec_sql', {
          query: `CREATE TABLE IF NOT EXISTS app_users (
            id TEXT PRIMARY KEY,
            data JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ DEFAULT NOW()
          );`
        }).catch(() => {});

        // Retry insert
        const { error: retryError } = await supabase
          .from('app_users')
          .insert({ id: userId, data: userData });

        if (retryError) {
          return NextResponse.json({ error: 'שגיאה ביצירת המשתמש' }, { status: 500 });
        }
      } else {
        return NextResponse.json({ error: 'שגיאה ביצירת המשתמש' }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      user: {
        id: userId,
        email: userData.email,
        role: userData.role,
        displayName: userData.displayName,
      },
      // Return the generated password so admin can share it (only on creation)
      generatedPassword: !password ? finalPassword : undefined,
    }, { status: 201 });
  } catch (error) {
    console.error('[Auth/CreateUser] Error:', error);
    return NextResponse.json({ error: 'שגיאה ביצירת המשתמש' }, { status: 500 });
  }
}
