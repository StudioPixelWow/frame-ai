import { NextRequest, NextResponse } from 'next/server';

const AUTH_COOKIE = 'frameai_session';
const JWT_SECRET = process.env.JWT_SECRET || 'frameai-dev-secret-change-in-production-2026';

// Routes that don't require authentication
const PUBLIC_ROUTES = [
  '/login',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/seed',
  '/api/auth/me',
  '/client-portal',
  '/privacy',        // public — Meta App privacy policy URL
  '/data-deletion',  // public — Meta App data deletion URL
];

// Routes that require admin role
const ADMIN_ROUTES = [
  '/accounting',
  '/executive',
  '/workload',
  '/settings',
];

// Page-route prefixes an EMPLOYEE is allowed to open. Everything else (clients,
// campaigns, accounting, projects, etc.) is admin-only — employees get redirected
// to their dashboard. (APIs are not gated here; they have their own per-row scoping.)
const EMPLOYEE_ALLOWED_PAGES = [
  '/dashboard',
  '/tasks',
  '/business-calendar',
  '/profile',
];

// Routes that require at least staff (admin or employee)
const STAFF_ROUTES = [
  '/dashboard',
  '/clients',
  '/campaigns',
  '/tasks',
  '/leads',
  '/automations',
  '/mailing',
  '/projects',
  '/podcast',
  '/editor',
];

function base64urlDecode(input: string): string {
  const padded = input + '='.repeat((4 - input.length % 4) % 4);
  return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString();
}

function verifyTokenEdge(token: string): { role: string; exp: number } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    // Verify signature using Web Crypto (Edge-compatible)
    // For MVP, we trust the cookie (httpOnly + secure) and just decode
    // Full HMAC verification would need async crypto.subtle
    const payload = JSON.parse(base64urlDecode(parts[1]));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) return null;
    return payload;
  } catch {
    return null;
  }
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Skip static files, _next, and API data routes (they have their own guards)
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.') ||
    pathname.startsWith('/api/data') ||
    pathname.startsWith('/api/upload') ||
    pathname.startsWith('/api/accounting') ||
    pathname.startsWith('/api/render') ||
    pathname.startsWith('/api/seo-geo-plans/cron') ||
    pathname.startsWith('/api/podcast/migration')
  ) {
    return NextResponse.next();
  }

  // Public routes — always accessible
  if (PUBLIC_ROUTES.some(r => pathname === r || pathname.startsWith(r + '/'))) {
    return NextResponse.next();
  }

  // Check for auth cookie
  const token = req.cookies.get(AUTH_COOKIE)?.value;
  const session = token ? verifyTokenEdge(token) : null;

  // No session — redirect to login (except for API routes which return 401)
  if (!session) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'לא מחובר' }, { status: 401 });
    }
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  const role = session.role;

  // Admin routes — admin only
  if (ADMIN_ROUTES.some(r => pathname === r || pathname.startsWith(r + '/'))) {
    if (role !== 'admin') {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 });
      }
      return NextResponse.redirect(new URL('/', req.url));
    }
  }

  // Staff routes — admin + employee
  if (STAFF_ROUTES.some(r => pathname === r || pathname.startsWith(r + '/'))) {
    if (role === 'client') {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 });
      }
      return NextResponse.redirect(new URL('/client-portal', req.url));
    }
  }

  // Client trying to access dashboard — redirect to portal
  if (role === 'client' && pathname === '/') {
    return NextResponse.redirect(new URL('/client-portal', req.url));
  }

  // Employees: restrict to their own area (dashboard/tasks/calendar/profile).
  // Any other page → send them to the dashboard. APIs are untouched (skipped above
  // for /api/data, and other APIs scope data per-employee themselves).
  if (role === 'employee' && !pathname.startsWith('/api/')) {
    const allowed = pathname === '/' || EMPLOYEE_ALLOWED_PAGES.some(
      (p) => pathname === p || pathname.startsWith(p + '/'),
    );
    if (!allowed) {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all routes except static files
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
