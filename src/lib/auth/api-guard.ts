import { NextRequest, NextResponse } from 'next/server';

export type AppRole = 'admin' | 'employee' | 'client';

/* ── Header readers ──────────────────────────────────────────────── */

/**
 * Returns the caller's role. Falls back to 'admin' for backwards compat
 * with admin dashboard (which may not set the header yet).
 * For portal-facing routes, prefer `getRequestRoleStrict()`.
 */
export function getRequestRole(req: NextRequest): AppRole {
  const role = req.headers.get('x-app-role') as AppRole;
  if (role && ['admin', 'employee', 'client'].includes(role)) return role;
  return 'admin';
}

/**
 * Strict version — returns null when no role header is present.
 * Use in routes that need to differentiate "no role set" from "admin".
 */
export function getRequestRoleStrict(req: NextRequest): AppRole | null {
  const role = req.headers.get('x-app-role') as AppRole;
  if (role && ['admin', 'employee', 'client'].includes(role)) return role;
  return null;
}

export function getRequestClientId(req: NextRequest): string | null {
  return req.headers.get('x-app-client-id') || null;
}

/* ── Client-scoping helper ───────────────────────────────────────── */

/**
 * For GET list endpoints: if the caller is a client, filter the array
 * to only items belonging to that client.
 * `getClientId` extracts the clientId from each item.
 * Returns the (possibly filtered) array.
 */
export function scopeForClient<T>(
  req: NextRequest,
  items: T[],
  getClientId: (item: T) => string | null | undefined
): T[] {
  const role = getRequestRole(req);
  if (role !== 'client') return items;
  const userClientId = getRequestClientId(req);
  if (!userClientId) return []; // no clientId → no data
  return items.filter(item => getClientId(item) === userClientId);
}

/** The employee ID of the currently logged-in user (set when role is employee). */
export function getRequestEmployeeId(req: NextRequest): string | null {
  return req.headers.get('x-app-employee-id') || null;
}

/* ── Guards ───────────────────────────────────────────────────────── */

/** Return 403 if the caller's role is not in the allowed list. */
export function requireRole(req: NextRequest, ...allowedRoles: AppRole[]): NextResponse | null {
  const role = getRequestRole(req);
  if (!allowedRoles.includes(role)) {
    return NextResponse.json(
      { error: 'אין הרשאה לפעולה זו', requiredRole: allowedRoles },
      { status: 403 }
    );
  }
  return null;
}

/** Return 403 if a client tries to access a resource that doesn't belong to them. */
export function requireClientAccess(
  req: NextRequest,
  resourceClientId: string | null
): NextResponse | null {
  const role = getRequestRole(req);
  if (role === 'admin') return null;
  if (role === 'client') {
    const userClientId = getRequestClientId(req);
    if (!userClientId || userClientId !== resourceClientId) {
      return NextResponse.json(
        { error: 'אין גישה לנתון זה' },
        { status: 403 }
      );
    }
  }
  return null;
}

/**
 * Return 403 if an employee tries to access a resource assigned to someone else.
 * Admins always pass. Clients are blocked entirely.
 * `resourceOwnerId` is the employee ID that owns the resource (e.g. assignee_id).
 * If resourceOwnerId is null (unassigned), employees ARE allowed (they can see unassigned items).
 */
export function requireEmployeeAccess(
  req: NextRequest,
  resourceOwnerId: string | null
): NextResponse | null {
  const role = getRequestRole(req);
  if (role === 'admin') return null;
  if (role === 'client') {
    return NextResponse.json({ error: 'אין הרשאה לפעולה זו' }, { status: 403 });
  }
  // role === 'employee'
  if (resourceOwnerId === null) return null; // unassigned → allow
  const empId = getRequestEmployeeId(req);
  if (!empId || empId !== resourceOwnerId) {
    return NextResponse.json(
      { error: 'אין גישה לנתון של עובד אחר' },
      { status: 403 }
    );
  }
  return null;
}
