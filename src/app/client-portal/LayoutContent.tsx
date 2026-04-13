'use client';

import { useSearchParams } from 'next/navigation';
import { ThemeProvider } from '@/lib/theme';
import { ToastProvider } from '@/components/ui/toast';
import { Suspense } from 'react';

function LayoutContentInner({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const clientId = searchParams.get('clientId');

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
          {/* Portal Header */}
          <header
            style={{
              borderBottom: `1px solid var(--border)`,
              backgroundColor: 'var(--surface)',
              padding: '1.5rem 2rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              {/* Studio Pixel Logo */}
              <img
                src="https://s-pixel.co.il/wp-content/uploads/2026/04/Asset-1.png"
                alt="Studio Pixel"
                style={{
                  height: '2.5rem',
                  filter: 'brightness(0) invert(1)',
                }}
              />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span
                  style={{
                    fontSize: '0.875rem',
                    color: 'var(--foreground-muted)',
                    fontWeight: 500,
                  }}
                >
                  Client Portal
                </span>
              </div>
            </div>
          </header>

          {/* Navigation Bar */}
          <nav
            style={{
              borderBottom: `1px solid var(--border)`,
              backgroundColor: 'var(--background)',
              padding: '0 2rem',
              display: 'flex',
              gap: '0.5rem',
              overflowX: 'auto',
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
                  padding: '1rem 1.5rem',
                  borderBottom: '2px solid transparent',
                  color: 'var(--foreground-muted)',
                  textDecoration: 'none',
                  fontSize: '0.95rem',
                  fontWeight: 500,
                  transition: 'color 250ms ease, border-color 250ms ease',
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                }}
                onMouseEnter={e => {
                  (e.target as HTMLElement).style.color = 'var(--accent)';
                }}
                onMouseLeave={e => {
                  (e.target as HTMLElement).style.color = 'var(--foreground-muted)';
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
