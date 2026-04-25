'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { ThemeProvider } from '@/lib/theme';
import { ToastProvider } from '@/components/ui/toast';
import { Suspense, useEffect, useState, useMemo, useCallback } from 'react';
import ClientPortalHeader from '@/components/client-portal-header';

interface ClientInfo {
  id: string;
  name: string;
  company: string;
  contactPerson: string;
  logoUrl: string;
  color: string;
  businessField: string;
  status: string;
}

function LayoutContentInner({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [clientInfo, setClientInfo] = useState<ClientInfo | null>(null);

  // Resolve clientId from query params OR localStorage
  const clientId = useMemo(() => {
    const fromUrl = searchParams.get('clientId');
    if (fromUrl) return fromUrl;
    try {
      return localStorage.getItem('portal_client_id') || localStorage.getItem('frameai_client_id') || null;
    } catch {
      return null;
    }
  }, [searchParams]);

  useEffect(() => {
    if (pathname === '/client-portal') {
      setIsAuthenticated(true);
      setIsChecking(false);
      return;
    }
    try {
      const portalClientId = localStorage.getItem('portal_client_id') || localStorage.getItem('frameai_client_id');
      if (portalClientId) {
        setIsAuthenticated(true);
      } else {
        router.push('/client-portal');
      }
    } catch {
      router.push('/client-portal');
    }
    setIsChecking(false);
  }, [pathname, router]);

  // Fetch client data for personalized header
  useEffect(() => {
    if (!clientId || pathname === '/client-portal') return;

    fetch('/api/data/clients', { cache: 'no-store' })
      .then(res => res.json())
      .then((clients: any[]) => {
        if (!Array.isArray(clients)) return;
        const found = clients.find((c: any) => c.id === clientId);
        if (found) {
          setClientInfo({
            id: found.id,
            name: found.name || '',
            company: found.company || '',
            contactPerson: found.contactPerson || '',
            logoUrl: found.logoUrl || '',
            color: found.color || '',
            businessField: found.businessField || '',
            status: found.status || 'active',
          });
        }
      })
      .catch(() => {});
  }, [clientId, pathname]);

  const handleLogout = useCallback(() => {
    try {
      localStorage.removeItem('portal_client_id');
      localStorage.removeItem('portal_user_id');
      localStorage.removeItem('portal_email');
      localStorage.removeItem('frameai_client_id');
      localStorage.removeItem('frameai_role');
      localStorage.removeItem('frameai_email');
    } catch {}
    router.push('/client-portal');
  }, [router]);

  if (isChecking) {
    return (
      <ThemeProvider>
        <ToastProvider>
          <div style={{ padding: '2rem', textAlign: 'center', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            ...טוען
          </div>
        </ToastProvider>
      </ThemeProvider>
    );
  }

  if (!isAuthenticated) return null;

  const isLoginPage = pathname === '/client-portal';

  return (
    <ThemeProvider>
      <ToastProvider>
        <div style={{
          minHeight: '100vh',
          backgroundColor: 'var(--background)',
          color: 'var(--foreground)',
          display: 'flex',
          flexDirection: 'column',
        }}>

          {/* ── Premium Header ── */}
          {!isLoginPage && (
            <ClientPortalHeader
              clientName={clientInfo?.name || ''}
              businessName={clientInfo?.company || ''}
              logoUrl={clientInfo?.logoUrl || ''}
              contactPerson={clientInfo?.contactPerson || ''}
              onLogout={handleLogout}
            />
          )}

          {/* ── Navigation ── */}
          {!isLoginPage && (
            <nav style={{
              borderBottom: '1px solid rgba(0, 0, 0, 0.05)',
              padding: '0 2.5rem',
              display: 'flex',
              gap: '0.15rem',
              overflowX: 'auto',
              direction: 'rtl',
            }}>
              {[
                { label: 'דשבורד', href: '/client-portal/dashboard' },
                { label: 'לוח תוכן', href: '/client-portal/gantt' },
                { label: 'אישורים', href: '/client-portal/approvals' },
                { label: 'קבצים', href: '/client-portal/files' },
                { label: 'פרויקטים', href: '/client-portal/projects' },
                { label: 'לידים', href: '/client-portal/leads' },
                { label: 'פעילות', href: '/client-portal/activity' },
              ].map(item => {
                const isActive = pathname?.startsWith(item.href);
                return (
                  <a
                    key={item.href}
                    href={`${item.href}${clientId ? `?clientId=${clientId}` : ''}`}
                    style={{
                      padding: '0.75rem 1.1rem',
                      borderBottom: isActive ? '2px solid #1a1a1a' : '2px solid transparent',
                      color: isActive ? '#1a1a1a' : 'rgba(0, 0, 0, 0.4)',
                      textDecoration: 'none',
                      fontSize: '0.82rem',
                      fontWeight: isActive ? 600 : 450,
                      transition: 'color 200ms ease, border-color 200ms ease',
                      whiteSpace: 'nowrap',
                      cursor: 'pointer',
                      letterSpacing: '-0.005em',
                    }}
                    onMouseEnter={e => {
                      if (!isActive) (e.target as HTMLElement).style.color = 'rgba(0, 0, 0, 0.65)';
                    }}
                    onMouseLeave={e => {
                      if (!isActive) (e.target as HTMLElement).style.color = 'rgba(0, 0, 0, 0.4)';
                    }}
                  >
                    {item.label}
                  </a>
                );
              })}
            </nav>
          )}

          {/* ── Main Content ── */}
          <main style={{
            flex: 1,
            padding: '2rem 2.5rem',
            direction: 'rtl',
            maxWidth: '1400px',
            marginInline: 'auto',
            width: '100%',
          }}>
            {children}
          </main>
        </div>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default function LayoutContent({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center' }}>...טוען</div>}>
      <LayoutContentInner>{children}</LayoutContentInner>
    </Suspense>
  );
}
