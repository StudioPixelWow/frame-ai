'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface MobileHeaderProps {
  onLogout: () => void;
  userName?: string;
  userEmail?: string;
  userRole?: 'admin' | 'employee' | 'client';
}

interface NavItem {
  href: string;
  label: string;
  allowedRoles: ('admin' | 'employee' | 'client')[];
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'דשבורד', allowedRoles: ['admin', 'employee'] },
  { href: '/clients', label: 'לקוחות', allowedRoles: ['admin', 'employee'] },
  { href: '/leads', label: 'לידים', allowedRoles: ['admin'] },
  { href: '/campaigns', label: 'קמפיינים', allowedRoles: ['admin', 'employee'] },
  { href: '/tasks', label: 'משימות', allowedRoles: ['admin', 'employee'] },
  { href: '/business-calendar', label: 'יומן', allowedRoles: ['admin', 'employee'] },
  { href: '/employees', label: 'צוות', allowedRoles: ['admin'] },
  { href: '/business-projects', label: 'פרויקטים', allowedRoles: ['admin', 'employee'] },
  { href: '/accounting', label: 'חשבונות', allowedRoles: ['admin'] },
  { href: '/approvals', label: 'אישורים', allowedRoles: ['admin', 'employee'] },
  { href: '/settings', label: 'הגדרות', allowedRoles: ['admin'] },
];

const ROLE_LABELS: Record<'admin' | 'employee' | 'client', string> = {
  admin: 'מנהל',
  employee: 'עובד',
  client: 'לקוח',
};

export function MobileDrawer({
  open,
  onClose,
  onLogout,
  userName = 'משתמש',
  userEmail = '',
  userRole = 'employee',
}: {
  open: boolean;
  onClose: () => void;
  onLogout: () => void;
  userName?: string;
  userEmail?: string;
  userRole?: 'admin' | 'employee' | 'client';
}) {
  const pathname = usePathname();

  // Close drawer on navigation
  useEffect(() => {
    onClose();
  }, [pathname, onClose]);

  // Close drawer on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onClose();
      }
    };

    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [open, onClose]);

  // Filter nav items by user role
  const filteredNavItems = NAV_ITEMS.filter((item) =>
    item.allowedRoles.includes(userRole)
  );

  const userInitial = userName.charAt(0).toUpperCase();
  const roleLabel = ROLE_LABELS[userRole];

  return (
    <>
      {/* Backdrop overlay */}
      {open && (
        <div
          className="mh-drawer-backdrop"
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            zIndex: 55,
            animation: 'fadeIn 250ms ease',
          }}
        />
      )}

      {/* Drawer */}
      <div
        className="mh-drawer"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          width: '280px',
          height: '100vh',
          backgroundColor: 'rgba(255, 255, 255, 0.98)',
          zIndex: 60,
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 250ms ease',
          boxShadow: 'rgba(0, 0, 0, 0.1) -2px 4px 12px',
          display: 'flex',
          flexDirection: 'column',
          direction: 'rtl',
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="mh-drawer-close"
          style={{
            position: 'absolute',
            top: '12px',
            left: '12px',
            width: '36px',
            height: '36px',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px',
            color: 'rgba(0, 0, 0, 0.7)',
            transition: 'color 200ms ease',
          }}
          aria-label="Close drawer"
        >
          ✕
        </button>

        {/* User info section */}
        <div
          className="mh-drawer-user-section"
          style={{
            padding: '16px 16px 0',
            borderBottom: '1px solid rgba(0, 0, 0, 0.08)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '12px',
              marginTop: '12px',
            }}
          >
            {/* Avatar */}
            <div
              className="mh-avatar"
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                backgroundColor: 'rgba(0, 0, 0, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                fontWeight: '600',
                color: 'rgba(0, 0, 0, 0.7)',
                flexShrink: 0,
              }}
            >
              {userInitial}
            </div>

            {/* User info text */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
              }}
            >
              <div
                className="mh-user-name"
                style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: 'rgba(0, 0, 0, 0.85)',
                }}
              >
                {userName}
              </div>
              <div
                className="mh-role-badge"
                style={{
                  fontSize: '11px',
                  padding: '2px 6px',
                  backgroundColor: 'rgba(0, 0, 0, 0.05)',
                  borderRadius: '4px',
                  color: 'rgba(0, 0, 0, 0.6)',
                  display: 'inline-block',
                  width: 'fit-content',
                }}
              >
                {roleLabel}
              </div>
            </div>
          </div>

          {userEmail && (
            <div
              className="mh-user-email"
              style={{
                fontSize: '12px',
                color: 'rgba(0, 0, 0, 0.5)',
                marginBottom: '12px',
              }}
            >
              {userEmail}
            </div>
          )}
        </div>

        {/* Navigation items */}
        <nav
          className="mh-drawer-nav"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '8px 0',
          }}
        >
          {filteredNavItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="mh-nav-link"
                style={{
                  display: 'block',
                  padding: '12px 16px',
                  fontSize: '14px',
                  color: isActive ? 'rgba(0, 0, 0, 0.85)' : 'rgba(0, 0, 0, 0.6)',
                  textDecoration: 'none',
                  backgroundColor: isActive ? 'rgba(0, 0, 0, 0.05)' : 'transparent',
                  borderRight: isActive ? '3px solid rgba(0, 0, 0, 0.3)' : 'none',
                  fontWeight: isActive ? '600' : '400',
                  transition: 'all 200ms ease',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(0, 0, 0, 0.02)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                  }
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Separator */}
        <div
          className="mh-drawer-separator"
          style={{
            borderTop: '1px solid rgba(0, 0, 0, 0.08)',
          }}
        />

        {/* Logout button */}
        <button
          onClick={onLogout}
          className="mh-logout-btn"
          style={{
            padding: '12px 16px',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            fontSize: '14px',
            color: 'rgba(200, 50, 50, 0.8)',
            fontWeight: '500',
            textAlign: 'right',
            transition: 'color 200ms ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            gap: '8px',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.color = 'rgba(200, 50, 50, 1)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.color = 'rgba(200, 50, 50, 0.8)';
          }}
        >
          <span>🚪</span>
          <span>התנתקות</span>
        </button>
      </div>

      {/* Animations */}
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @media (prefers-color-scheme: dark) {
          .mh-drawer {
            background-color: rgba(20, 20, 20, 0.98) !important;
          }

          .mh-drawer-user-section {
            border-bottom-color: rgba(255, 255, 255, 0.1) !important;
          }

          .mh-user-name {
            color: rgba(255, 255, 255, 0.85) !important;
          }

          .mh-role-badge {
            background-color: rgba(255, 255, 255, 0.1) !important;
            color: rgba(255, 255, 255, 0.6) !important;
          }

          .mh-user-email {
            color: rgba(255, 255, 255, 0.5) !important;
          }

          .mh-drawer-close {
            color: rgba(255, 255, 255, 0.7) !important;
          }

          .mh-drawer-close:hover {
            color: rgba(255, 255, 255, 0.85) !important;
          }

          .mh-avatar {
            background-color: rgba(255, 255, 255, 0.1) !important;
            color: rgba(255, 255, 255, 0.7) !important;
          }

          .mh-nav-link {
            color: rgba(255, 255, 255, 0.6) !important;
          }

          .mh-nav-link[style*="isActive"] {
            color: rgba(255, 255, 255, 0.85) !important;
            background-color: rgba(255, 255, 255, 0.05) !important;
          }

          .mh-drawer-separator {
            border-top-color: rgba(255, 255, 255, 0.1) !important;
          }

          .mh-logout-btn {
            color: rgba(255, 100, 100, 0.8) !important;
          }

          .mh-logout-btn:hover {
            color: rgba(255, 100, 100, 1) !important;
          }
        }
      `}</style>
    </>
  );
}

export function MobileHeader({
  onLogout,
  userName = 'משתמש',
  userEmail = '',
  userRole = 'employee',
}: MobileHeaderProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [hasNotifications, setHasNotifications] = useState(true);

  const userInitial = userName.charAt(0).toUpperCase();

  return (
    <>
      {/* Header */}
      <header
        className="mh-header"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: '52px',
          zIndex: 50,
          backgroundColor: 'rgba(255, 255, 255, 0.85)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingLeft: '16px',
          paddingRight: '16px',
          direction: 'rtl',
        }}
      >
        {/* Logo / Product name (right side in RTL) */}
        <div
          className="mh-logo"
          style={{
            fontSize: '16px',
            fontWeight: '700',
            color: 'rgba(0, 0, 0, 0.85)',
            letterSpacing: '-0.5px',
          }}
        >
          PM
        </div>

        {/* Right side actions (left side in RTL) */}
        <div
          className="mh-actions"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          {/* Notifications bell */}
          <button
            className="mh-notification-btn"
            style={{
              position: 'relative',
              width: '40px',
              height: '40px',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
              transition: 'opacity 200ms ease',
            }}
            aria-label="Notifications"
          >
            🔔
            {hasNotifications && (
              <span
                className="mh-notification-dot"
                style={{
                  position: 'absolute',
                  top: '8px',
                  left: '8px',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(200, 50, 50, 0.9)',
                }}
              />
            )}
          </button>

          {/* User avatar */}
          <button
            className="mh-avatar-btn"
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              backgroundColor: 'rgba(0, 0, 0, 0.08)',
              border: '1px solid rgba(0, 0, 0, 0.12)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
              fontWeight: '600',
              color: 'rgba(0, 0, 0, 0.7)',
              transition: 'all 200ms ease',
            }}
            onClick={() => setDrawerOpen(!drawerOpen)}
            aria-label="User menu"
          >
            {userInitial}
          </button>

          {/* Hamburger menu */}
          <button
            className="mh-hamburger-btn"
            style={{
              width: '40px',
              height: '40px',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              transition: 'opacity 200ms ease',
            }}
            onClick={() => setDrawerOpen(!drawerOpen)}
            aria-label="Toggle navigation menu"
          >
            <span
              style={{
                width: '24px',
                height: '2px',
                backgroundColor: 'rgba(0, 0, 0, 0.6)',
                borderRadius: '1px',
                transition: 'all 200ms ease',
              }}
            />
            <span
              style={{
                width: '24px',
                height: '2px',
                backgroundColor: 'rgba(0, 0, 0, 0.6)',
                borderRadius: '1px',
                transition: 'all 200ms ease',
              }}
            />
            <span
              style={{
                width: '24px',
                height: '2px',
                backgroundColor: 'rgba(0, 0, 0, 0.6)',
                borderRadius: '1px',
                transition: 'all 200ms ease',
              }}
            />
          </button>
        </div>
      </header>

      {/* Mobile Drawer */}
      <MobileDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onLogout={onLogout}
        userName={userName}
        userEmail={userEmail}
        userRole={userRole}
      />

      {/* Dark mode styles */}
      <style>{`
        @media (prefers-color-scheme: dark) {
          .mh-header {
            background-color: rgba(20, 20, 20, 0.85) !important;
            border-bottom-color: rgba(255, 255, 255, 0.1) !important;
          }

          .mh-logo {
            color: rgba(255, 255, 255, 0.85) !important;
          }

          .mh-hamburger-btn span {
            background-color: rgba(255, 255, 255, 0.6) !important;
          }

          .mh-avatar-btn {
            background-color: rgba(255, 255, 255, 0.1) !important;
            border-color: rgba(255, 255, 255, 0.15) !important;
            color: rgba(255, 255, 255, 0.7) !important;
          }

          .mh-avatar-btn:hover {
            background-color: rgba(255, 255, 255, 0.15) !important;
          }
        }
      `}</style>
    </>
  );
}

export default MobileHeader;
