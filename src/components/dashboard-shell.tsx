'use client';

import { useAuth } from '@/lib/auth/auth-context';
import AdminHeader from '@/components/admin-header';
import MobileHeader from '@/components/mobile-header';

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const { email, displayName, role, logout } = useAuth();

  return (
    <>
      {/* Admin header — desktop only (hidden on mobile via CSS) */}
      <div className="adm-desktop-only" style={{ display: 'block' }}>
        <AdminHeader
          onLogout={logout}
          userName={displayName || email?.split('@')[0] || ''}
          userEmail={email || ''}
          userRole={role}
        />
      </div>

      {/* Mobile header — mobile only (hidden on desktop via CSS) */}
      <div className="mh-mobile-only" style={{ display: 'none' }}>
        <MobileHeader
          onLogout={logout}
          userName={displayName || email?.split('@')[0] || ''}
          userEmail={email || ''}
          userRole={role}
        />
      </div>

      {/* Page content */}
      {children}

      <style>{`
        @media (max-width: 768px) {
          .adm-desktop-only { display: none !important; }
          .mh-mobile-only { display: block !important; }
        }
        @media (min-width: 769px) {
          .adm-desktop-only { display: block !important; }
          .mh-mobile-only { display: none !important; }
        }
      `}</style>
    </>
  );
}
