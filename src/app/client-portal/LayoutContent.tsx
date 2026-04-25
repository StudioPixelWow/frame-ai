'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { ThemeProvider } from '@/lib/theme';
import { ToastProvider } from '@/components/ui/toast';
import { Suspense, useEffect, useState, useMemo } from 'react';

interface ClientInfo {
  id: string;
  name: string;
  company: string;
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
    // Check if on login page
    if (pathname === '/client-portal') {
      setIsAuthenticated(true);
      setIsChecking(false);
      return;
    }

    // Check for auth token in localStorage
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
            logoUrl: found.logoUrl || '',
            color: found.color || '#00B5FE',
            businessField: found.businessField || '',
            status: found.status || 'active',
          });
        }
      })
      .catch(() => {});
  }, [clientId, pathname]);

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

  if (!isAuthenticated) {
    return null;
  }

  // Derive display values
  const brandColor = clientInfo?.color || '#00B5FE';
  const displayName = clientInfo?.company || clientInfo?.name || '';
  const initials = (clientInfo?.name || '')
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <ThemeProvider>
      <ToastProvider>
        <div
          style={{
            minHeight: '100vh',
            backgroundColor: 'var(--background)',
            color: 'var(--foreground)',
            display: 'flex',
            flexDirection: 'column',
            transition: 'background-color 250ms ease, color 250ms ease',
          }}
        >
          {/* Portal Header — Personalized */}
          <header
            style={{
              borderBottom: `1px solid var(--border)`,
              backgroundColor: 'var(--surface)',
              padding: '1rem 2rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              direction: 'rtl',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
              {/* Client logo or first-letter avatar */}
              {clientInfo?.logoUrl ? (
                <img
                  src={clientInfo.logoUrl}
                  alt={displayName}
                  style={{
                    height: '2.75rem',
                    width: '2.75rem',
                    borderRadius: '0.6rem',
                    objectFit: 'cover',
                    border: `2px solid ${brandColor}30`,
                  }}
                  onError={(e) => {
                    // If logo fails to load, hide it — the fallback avatar will show
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                <div style={{
                  width: '2.75rem',
                  height: '2.75rem',
                  borderRadius: '0.6rem',
                  background: `${brandColor}18`,
                  border: `2px solid ${brandColor}30`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: brandColor,
                  fontWeight: 800,
                  fontSize: '1rem',
                  flexShrink: 0,
                }}>
                  {initials || '?'}
                </div>
              )}

              {/* Business name + subtitle */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                <span style={{
                  fontSize: '1rem',
                  fontWeight: 700,
                  color: 'var(--foreground)',
                  lineHeight: 1.2,
                }}>
                  {displayName || 'פורטל לקוח'}
                </span>
                <span style={{
                  fontSize: '0.72rem',
                  color: 'var(--foreground-muted)',
                  fontWeight: 500,
                }}>
                  {clientInfo?.businessField
                    ? `${clientInfo.businessField} · פורטל לקוח`
                    : 'פורטל לקוח'}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {/* Client name greeting */}
              {clientInfo?.name && (
                <span style={{
                  fontSize: '0.82rem',
                  color: 'var(--foreground-muted)',
                  fontWeight: 500,
                }}>
                  שלום, {clientInfo.name}
                </span>
              )}

              {/* Logout */}
              <button
                onClick={() => {
                  try {
                    localStorage.removeItem('portal_client_id');
                    localStorage.removeItem('portal_user_id');
                    localStorage.removeItem('portal_email');
                    localStorage.removeItem('frameai_client_id');
                    localStorage.removeItem('frameai_role');
                    localStorage.removeItem('frameai_email');
                  } catch {}
                  router.push('/client-portal');
                }}
                style={{
                  padding: '0.45rem 0.85rem',
                  backgroundColor: 'transparent',
                  color: 'var(--foreground-muted)',
                  border: '1px solid var(--border)',
                  borderRadius: '0.5rem',
                  fontSize: '0.8rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 200ms ease',
                  fontFamily: 'inherit',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--surface-raised)';
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)';
                  (e.currentTarget as HTMLElement).style.color = 'var(--accent)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
                  (e.currentTarget as HTMLElement).style.color = 'var(--foreground-muted)';
                }}
              >
                יציאה
              </button>
            </div>
          </header>

          {/* Navigation Bar */}
          <nav
            style={{
              borderBottom: '1px solid var(--border)',
              backgroundColor: 'var(--background)',
              padding: '0 2rem',
              display: 'flex',
              gap: '0.5rem',
              overflowX: 'auto',
              direction: 'rtl',
            }}
          >
            {[
              { label: 'דשבורד', href: '/client-portal/dashboard' },
              { label: 'לוח תוכן', href: '/client-portal/gantt' },
              { label: 'אישורים', href: '/client-portal/approvals' },
              { label: 'קבצים', href: '/client-portal/files' },
              { label: 'פרויקטים', href: '/client-portal/projects' },
              { label: 'לידים', href: '/client-portal/leads' },
              { label: 'פעילות', href: '/client-portal/activity' },
            ].map(item => (
              <a
                key={item.href}
                href={`${item.href}${clientId ? `?clientId=${clientId}` : ''}`}
                style={{
                  padding: '0.85rem 1.25rem',
                  borderBottom: pathname?.startsWith(item.href) ? `2px solid ${brandColor}` : '2px solid transparent',
                  color: pathname?.startsWith(item.href) ? 'var(--foreground)' : 'var(--foreground-muted)',
                  textDecoration: 'none',
                  fontSize: '0.88rem',
                  fontWeight: pathname?.startsWith(item.href) ? 600 : 500,
                  transition: 'color 200ms ease, border-color 200ms ease',
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                }}
                onMouseEnter={e => {
                  (e.target as HTMLElement).style.color = 'var(--foreground)';
                }}
                onMouseLeave={e => {
                  if (!pathname?.startsWith(item.href)) {
                    (e.target as HTMLElement).style.color = 'var(--foreground-muted)';
                  }
                }}
              >
                {item.label}
              </a>
            ))}
          </nav>

          {/* Main Content */}
          <main
            style={{
              flex: 1,
              padding: '2rem',
              direction: 'rtl',
              maxWidth: '1400px',
              marginInline: 'auto',
              width: '100%',
            }}
          >
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
