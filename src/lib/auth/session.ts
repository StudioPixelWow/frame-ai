import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, signToken } from './jwt';

export const AUTH_COOKIE = 'frameai_session';

export type AppRole = 'admin' | 'employee' | 'client';

export interface SessionUser {
  userId: string;
  email: string;
  role: AppRole;
  clientId?: string | null;
  employeeId?: string | null;
}

/** Read session from request cookies. Returns null if not authenticated. */
export function getSession(req: NextRequest): SessionUser | null {
  const token = req.cookies.get(AUTH_COOKIE)?.value;
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload) return null;
  return {
    userId: payload.userId,
    email: payload.email,
    role: payload.role as AppRole,
    clientId: payload.clientId || null,
    employeeId: payload.employeeId || null,
  };
}

/** Create a response that sets the session cookie. */
export function setSessionCookie(
  response: NextResponse,
  user: { id: string; email: string; role: AppRole; linkedClientId?: string | null; linkedEmployeeId?: string | null }
): NextResponse {
  const token = signToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    clientId: user.linkedClientId || null,
    employeeId: user.linkedEmployeeId || null,
  });

  response.cookies.set(AUTH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 24 * 60 * 60, // 24 hours
  });

  return response;
}

/** Create a response that clears the session cookie. */
export function clearSessionCookie(response: NextResponse): NextResponse {
  response.cookies.set(AUTH_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return response;
}
