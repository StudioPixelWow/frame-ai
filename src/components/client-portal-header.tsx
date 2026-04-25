'use client';

import { useState, useCallback } from 'react';

interface ClientPortalHeaderProps {
  clientName: string;
  businessName: string;
  logoUrl: string;
  contactPerson: string;
  onLogout: () => void;
}

export default function ClientPortalHeader({
  clientName,
  businessName,
  logoUrl,
  contactPerson,
  onLogout,
}: ClientPortalHeaderProps) {
  const [logoError, setLogoError] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const displayBusiness = businessName || clientName || '';
  const greetName = contactPerson || clientName || '';
  const initials = (displayBusiness || '?')
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const hasLogo = logoUrl && !logoError;

  const handleLogout = useCallback(() => {
    setShowUserMenu(false);
    onLogout();
  }, [onLogout]);

  return (
    <>
      <style>{`
        .cph-header {
          position: sticky;
          top: 0;
          z-index: 100;
          background: rgba(255, 255, 255, 0.92);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-bottom: 1px solid rgba(0, 0, 0, 0.06);
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
        }
        @media (prefers-color-scheme: dark) {
          .cph-header {
            background: rgba(22, 22, 26, 0.92);
            border-bottom-color: rgba(255, 255, 255, 0.06);
          }
          .cph-logo-fallback {
            background: rgba(255, 255, 255, 0.06) !important;
            color: rgba(255, 255, 255, 0.5) !important;
            border-color: rgba(255, 255, 255, 0.08) !important;
          }
          .cph-logo-img {
            border-color: rgba(255, 255, 255, 0.08) !important;
          }
          .cph-biz-name {
            color: rgba(255, 255, 255, 0.92) !important;
          }
          .cph-greeting {
            color: rgba(255, 255, 255, 0.45) !important;
          }
          .cph-icon-btn {
            color: rgba(255, 255, 255, 0.4) !important;
          }
          .cph-icon-btn:hover {
            background: rgba(255, 255, 255, 0.06) !important;
            color: rgba(255, 255, 255, 0.7) !important;
          }
          .cph-action-btn {
            background: rgba(255, 255, 255, 0.08) !important;
            color: rgba(255, 255, 255, 0.85) !important;
            border-color: rgba(255, 255, 255, 0.1) !important;
          }
          .cph-action-btn:hover {
            background: rgba(255, 255, 255, 0.12) !important;
            border-color: rgba(255, 255, 255, 0.15) !important;
          }
          .cph-avatar {
            background: rgba(255, 255, 255, 0.08) !important;
            color: rgba(255, 255, 255, 0.6) !important;
            border-color: rgba(255, 255, 255, 0.1) !important;
          }
          .cph-avatar:hover {
            border-color: rgba(255, 255, 255, 0.2) !important;
          }
          .cph-dropdown {
            background: #1e1e22 !important;
            border-color: rgba(255, 255, 255, 0.08) !important;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4) !important;
          }
          .cph-dropdown-item {
            color: rgba(255, 255, 255, 0.7) !important;
          }
          .cph-dropdown-item:hover {
            background: rgba(255, 255, 255, 0.06) !important;
          }
          .cph-dropdown-sep {
            border-color: rgba(255, 255, 255, 0.06) !important;
          }
          .cph-dropdown-logout {
            color: #f87171 !important;
          }
          .cph-dropdown-logout:hover {
            background: rgba(248, 113, 113, 0.08) !important;
          }
          .cph-notif-dot {
            border-color: #1e1e22 !important;
          }
        }
      `}</style>

      <header className="cph-header" style={{
        padding: '0 2.5rem',
        height: '64px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        direction: 'rtl',
      }}>

        {/* ── LEFT SIDE: Logo + Business + Greeting ── */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.9rem',
        }}>
          {/* Circular logo / avatar */}
          {hasLogo ? (
            <img
              className="cph-logo-img"
              src={logoUrl}
              alt={displayBusiness}
              onError={() => setLogoError(true)}
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                objectFit: 'cover',
                border: '1.5px solid rgba(0, 0, 0, 0.06)',
                flexShrink: 0,
              }}
            />
          ) : (
            <div
              className="cph-logo-fallback"
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                background: 'rgba(0, 0, 0, 0.04)',
                border: '1.5px solid rgba(0, 0, 0, 0.06)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'rgba(0, 0, 0, 0.35)',
                fontWeight: 700,
                fontSize: '0.82rem',
                flexShrink: 0,
                letterSpacing: '0.02em',
              }}
            >
              {initials}
            </div>
          )}

          {/* Text block */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
            <span
              className="cph-biz-name"
              style={{
                fontSize: '0.95rem',
                fontWeight: 700,
                color: '#1a1a1a',
                lineHeight: 1.25,
                letterSpacing: '-0.01em',
              }}
            >
              {displayBusiness}
            </span>
            {greetName && (
              <span
                className="cph-greeting"
                style={{
                  fontSize: '0.78rem',
                  color: 'rgba(0, 0, 0, 0.4)',
                  fontWeight: 450,
                  lineHeight: 1.3,
                }}
              >
                שלום, {greetName}
              </span>
            )}
          </div>
        </div>

        {/* ── RIGHT SIDE: Notifications + Action + Avatar ── */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}>

          {/* Notifications bell */}
          <button
            className="cph-icon-btn"
            title="התראות"
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'rgba(0, 0, 0, 0.35)',
              transition: 'all 200ms ease',
              position: 'relative',
              fontFamily: 'inherit',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(0, 0, 0, 0.04)';
              e.currentTarget.style.color = 'rgba(0, 0, 0, 0.6)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'rgba(0, 0, 0, 0.35)';
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {/* Notification dot */}
            <span
              className="cph-notif-dot"
              style={{
                position: 'absolute',
                top: '7px',
                left: '8px',
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background: '#ef4444',
                border: '1.5px solid #fff',
              }}
            />
          </button>

          {/* Primary action — approvals shortcut */}
          <button
            className="cph-action-btn"
            style={{
              padding: '0.4rem 0.9rem',
              borderRadius: '8px',
              border: '1px solid rgba(0, 0, 0, 0.08)',
              background: 'rgba(0, 0, 0, 0.03)',
              color: '#1a1a1a',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 200ms ease',
              fontFamily: 'inherit',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(0, 0, 0, 0.06)';
              e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.12)';
              e.currentTarget.style.boxShadow = '0 1px 4px rgba(0, 0, 0, 0.04)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(0, 0, 0, 0.03)';
              e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.08)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            אישורים
          </button>

          {/* Separator */}
          <div style={{
            width: '1px',
            height: '24px',
            background: 'rgba(0, 0, 0, 0.06)',
            margin: '0 0.25rem',
          }} />

          {/* User avatar / menu */}
          <div style={{ position: 'relative' }}>
            <button
              className="cph-avatar"
              onClick={() => setShowUserMenu(prev => !prev)}
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                border: '1.5px solid rgba(0, 0, 0, 0.08)',
                background: 'rgba(0, 0, 0, 0.03)',
                color: 'rgba(0, 0, 0, 0.45)',
                fontWeight: 700,
                fontSize: '0.72rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 200ms ease',
                fontFamily: 'inherit',
                letterSpacing: '0.02em',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.15)';
              }}
              onMouseLeave={(e) => {
                if (!showUserMenu) {
                  e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.08)';
                }
              }}
            >
              {(greetName || displayBusiness || '?')[0]?.toUpperCase()}
            </button>

            {/* Dropdown menu */}
            {showUserMenu && (
              <>
                {/* Backdrop to close on outside click */}
                <div
                  style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 99,
                  }}
                  onClick={() => setShowUserMenu(false)}
                />
                <div
                  className="cph-dropdown"
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    left: 0,
                    minWidth: '180px',
                    background: '#fff',
                    border: '1px solid rgba(0, 0, 0, 0.06)',
                    borderRadius: '10px',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04)',
                    padding: '0.35rem',
                    zIndex: 100,
                    direction: 'rtl',
                  }}
                >
                  {/* User info */}
                  <div style={{
                    padding: '0.6rem 0.75rem',
                    borderBottom: 'none',
                  }}>
                    <div style={{
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      color: '#1a1a1a',
                      marginBottom: '0.1rem',
                    }}>
                      {greetName || displayBusiness}
                    </div>
                    <div style={{
                      fontSize: '0.7rem',
                      color: 'rgba(0, 0, 0, 0.35)',
                    }}>
                      {displayBusiness !== greetName ? displayBusiness : ''}
                    </div>
                  </div>

                  <div className="cph-dropdown-sep" style={{
                    borderTop: '1px solid rgba(0, 0, 0, 0.05)',
                    margin: '0.2rem 0.5rem',
                  }} />

                  {/* Menu items */}
                  <button
                    className="cph-dropdown-item"
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      border: 'none',
                      background: 'transparent',
                      fontSize: '0.8rem',
                      color: '#444',
                      cursor: 'pointer',
                      borderRadius: '6px',
                      textAlign: 'right',
                      transition: 'background 150ms ease',
                      fontFamily: 'inherit',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0, 0, 0, 0.03)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    onClick={() => setShowUserMenu(false)}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
                      <circle cx="12" cy="12" r="3" />
                      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                    </svg>
                    הגדרות
                  </button>

                  <div className="cph-dropdown-sep" style={{
                    borderTop: '1px solid rgba(0, 0, 0, 0.05)',
                    margin: '0.2rem 0.5rem',
                  }} />

                  <button
                    className="cph-dropdown-item cph-dropdown-logout"
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      border: 'none',
                      background: 'transparent',
                      fontSize: '0.8rem',
                      color: '#dc2626',
                      cursor: 'pointer',
                      borderRadius: '6px',
                      textAlign: 'right',
                      transition: 'background 150ms ease',
                      fontFamily: 'inherit',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(220, 38, 38, 0.05)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    onClick={handleLogout}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6 }}>
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                    יציאה
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>
    </>
  );
}
