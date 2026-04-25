'use client';

import React, { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';

interface AdminHeaderProps {
  onLogout: () => void;
  userName?: string;
  userEmail?: string;
  userRole?: 'admin' | 'employee' | 'client';
}

const ROUTE_TITLES: Record<string, { title: string; subtitle: string }> = {
  '/dashboard': { title: 'דשבורד', subtitle: 'סקירה כללית' },
  '/clients': { title: 'לקוחות', subtitle: 'ניהול לקוחות' },
  '/leads': { title: 'לידים', subtitle: 'מעקב לידים' },
  '/campaigns': { title: 'קמפיינים', subtitle: 'ניהול קמפיינים' },
  '/tasks': { title: 'משימות', subtitle: 'ניהול משימות' },
  '/employees': { title: 'צוות', subtitle: 'ניהול צוות' },
  '/projects': { title: 'PixelManageAI', subtitle: 'מערכת ניהול' },
  '/business-projects': { title: 'פרויקטים', subtitle: 'ניהול פרויקטים' },
  '/business-calendar': { title: 'יומן', subtitle: 'תכנון ולוח זמנים' },
  '/accounting': { title: 'חשבונות', subtitle: 'ניהול כספים' },
  '/approvals': { title: 'אישורים', subtitle: 'אישורי תוכן' },
  '/mailing': { title: 'דיוור', subtitle: 'ניהול דיוור' },
  '/stats': { title: 'סטטיסטיקות', subtitle: 'נתונים ודוחות' },
  '/executive': { title: 'סיכום מנהלים', subtitle: 'תמונת מצב' },
  '/workload': { title: 'עומס ורווחיות', subtitle: 'ניתוח ביצועים' },
  '/settings': { title: 'הגדרות', subtitle: 'הגדרות מערכת' },
};

const ROLE_LABELS: Record<string, string> = {
  admin: 'מנהל',
  employee: 'עובד',
  client: 'לקוח',
};

const SearchIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
  >
    <circle cx="6" cy="6" r="4.5" />
    <path d="M10 10l4 4" strokeLinecap="round" />
  </svg>
);

const BellIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 18 18"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
  >
    <path d="M14 7c0-2.76-2.24-5-5-5s-5 2.24-5 5c0 4-3 6-3 6h16s-3-2-3-6z" />
    <circle cx="9" cy="15" r="0.5" fill="currentColor" />
  </svg>
);

const SparkleIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
  >
    <path d="M8 1v3M8 12v3M1 8h3M12 8h3M3.5 3.5l2.1 2.1M10.4 10.4l2.1 2.1M12.5 3.5l-2.1 2.1M5.6 10.4l-2.1 2.1" />
  </svg>
);

const PlusIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 18 18"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
  >
    <path d="M9 3v12M3 9h12" strokeLinecap="round" />
  </svg>
);

const SettingsIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
  >
    <circle cx="8" cy="8" r="2.5" />
    <path d="M8 1.5a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 1 0V2a.5.5 0 0 0-.5-.5z" />
    <path d="M8 13a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 1 0v-1a.5.5 0 0 0-.5-.5z" />
    <path d="M14.5 8a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0 0 1h1a.5.5 0 0 0 .5-.5z" />
    <path d="M2.5 8a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0 0 1h1a.5.5 0 0 0 .5-.5z" />
  </svg>
);

const LogoutIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
  >
    <path d="M10 2H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h6M13 11l2-2-2-2M15 9h-5" />
  </svg>
);

export default function AdminHeader({
  onLogout,
  userName = 'משתמש',
  userEmail = 'user@example.com',
  userRole = 'employee',
}: AdminHeaderProps) {
  const pathname = usePathname();
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [searchValue, setSearchValue] = useState('');

  const quickCreateRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const routeData = ROUTE_TITLES[pathname] || {
    title: 'PixelManageAI',
    subtitle: 'מערכת ניהול',
  };

  const userInitial = (userName || userEmail || 'U').charAt(0).toUpperCase();

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        quickCreateRef.current &&
        !quickCreateRef.current.contains(e.target as Node)
      ) {
        setShowQuickCreate(false);
      }
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(e.target as Node)
      ) {
        setShowUserMenu(false);
      }
    };

    if (showQuickCreate || showUserMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showQuickCreate, showUserMenu]);

  const handleQuickCreate = (action: string) => {
    setShowQuickCreate(false);
    switch (action) {
      case 'client':
        window.location.href = '/clients?action=create';
        break;
      case 'task':
        window.location.href = '/tasks?action=create';
        break;
      case 'project':
        window.location.href = '/projects?action=create';
        break;
      default:
        break;
    }
  };

  const handleLogout = () => {
    setShowUserMenu(false);
    onLogout();
  };

  const headerStyles = `
    .adm-header {
      position: sticky;
      top: 0;
      right: 0;
      left: 0;
      height: 56px;
      z-index: 40;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 24px;
      background: rgba(255, 255, 255, 0.8);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid rgba(0, 0, 0, 0.06);
      direction: rtl;
      font-family: inherit;
    }

    @media (prefers-color-scheme: dark) {
      .adm-header {
        background: rgba(20, 20, 20, 0.8);
        border-bottom-color: rgba(255, 255, 255, 0.08);
      }
    }

    .adm-header-left {
      display: flex;
      flex-direction: column;
      justify-content: center;
      min-width: 240px;
    }

    .adm-header-title {
      font-size: 0.95rem;
      font-weight: 600;
      color: rgba(0, 0, 0, 0.92);
      margin: 0;
      line-height: 1.2;
    }

    @media (prefers-color-scheme: dark) {
      .adm-header-title {
        color: rgba(255, 255, 255, 0.95);
      }
    }

    .adm-header-subtitle {
      font-size: 0.72rem;
      color: rgba(0, 0, 0, 0.56);
      margin: 2px 0 0 0;
      line-height: 1.2;
    }

    @media (prefers-color-scheme: dark) {
      .adm-header-subtitle {
        color: rgba(255, 255, 255, 0.54);
      }
    }

    .adm-header-center {
      flex: 1;
      display: flex;
      justify-content: center;
      padding: 0 40px;
    }

    .adm-search {
      position: relative;
      width: 100%;
      max-width: 360px;
      transition: max-width 200ms ease;
    }

    .adm-search:focus-within {
      max-width: 420px;
    }

    .adm-search-input {
      width: 100%;
      height: 32px;
      padding: 0 12px 0 32px;
      border: 1px solid rgba(0, 0, 0, 0.12);
      border-radius: 6px;
      background: rgba(0, 0, 0, 0.02);
      font-size: 0.875rem;
      color: rgba(0, 0, 0, 0.88);
      direction: rtl;
      outline: none;
      transition: all 200ms ease;
    }

    .adm-search-input::placeholder {
      color: rgba(0, 0, 0, 0.48);
    }

    .adm-search-input:focus {
      background: rgba(0, 0, 0, 0.03);
      border-color: rgba(0, 0, 0, 0.16);
    }

    @media (prefers-color-scheme: dark) {
      .adm-search-input {
        background: rgba(255, 255, 255, 0.04);
        border-color: rgba(255, 255, 255, 0.12);
        color: rgba(255, 255, 255, 0.88);
      }

      .adm-search-input::placeholder {
        color: rgba(255, 255, 255, 0.48);
      }

      .adm-search-input:focus {
        background: rgba(255, 255, 255, 0.06);
        border-color: rgba(255, 255, 255, 0.16);
      }
    }

    .adm-search-icon {
      position: absolute;
      right: 10px;
      top: 50%;
      transform: translateY(-50%);
      color: rgba(0, 0, 0, 0.48);
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
    }

    @media (prefers-color-scheme: dark) {
      .adm-search-icon {
        color: rgba(255, 255, 255, 0.48);
      }
    }

    .adm-header-right {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: fit-content;
    }

    .adm-icon-btn {
      width: 32px;
      height: 32px;
      padding: 0;
      border: 1px solid rgba(0, 0, 0, 0.12);
      background: transparent;
      border-radius: 6px;
      color: rgba(0, 0, 0, 0.72);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 200ms ease;
      position: relative;
      font-family: inherit;
    }

    .adm-icon-btn:hover {
      background: rgba(0, 0, 0, 0.04);
      border-color: rgba(0, 0, 0, 0.16);
    }

    .adm-icon-btn:active {
      background: rgba(0, 0, 0, 0.08);
    }

    @media (prefers-color-scheme: dark) {
      .adm-icon-btn {
        border-color: rgba(255, 255, 255, 0.12);
        color: rgba(255, 255, 255, 0.72);
      }

      .adm-icon-btn:hover {
        background: rgba(255, 255, 255, 0.04);
        border-color: rgba(255, 255, 255, 0.16);
      }

      .adm-icon-btn:active {
        background: rgba(255, 255, 255, 0.08);
      }
    }

    .adm-notification-badge {
      position: absolute;
      top: 6px;
      left: 6px;
      width: 6px;
      height: 6px;
      background: #ef4444;
      border-radius: 50%;
    }

    .adm-copilot-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      height: 32px;
      padding: 0 10px;
      border: 1px solid rgba(0, 0, 0, 0.12);
      background: transparent;
      border-radius: 6px;
      color: rgba(0, 0, 0, 0.72);
      font-size: 0.8rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 200ms ease;
      font-family: inherit;
    }

    .adm-copilot-btn:hover {
      background: rgba(0, 0, 0, 0.04);
      border-color: rgba(0, 0, 0, 0.16);
    }

    @media (prefers-color-scheme: dark) {
      .adm-copilot-btn {
        border-color: rgba(255, 255, 255, 0.12);
        color: rgba(255, 255, 255, 0.72);
      }

      .adm-copilot-btn:hover {
        background: rgba(255, 255, 255, 0.04);
        border-color: rgba(255, 255, 255, 0.16);
      }
    }

    .adm-divider {
      width: 1px;
      height: 24px;
      background: rgba(0, 0, 0, 0.12);
    }

    @media (prefers-color-scheme: dark) {
      .adm-divider {
        background: rgba(255, 255, 255, 0.12);
      }
    }

    .adm-avatar {
      width: 32px;
      height: 32px;
      border-radius: 6px;
      background: rgba(0, 0, 0, 0.08);
      border: 1px solid rgba(0, 0, 0, 0.12);
      color: rgba(0, 0, 0, 0.72);
      font-size: 0.875rem;
      font-weight: 600;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 200ms ease;
      position: relative;
    }

    .adm-avatar:hover {
      background: rgba(0, 0, 0, 0.12);
      border-color: rgba(0, 0, 0, 0.16);
    }

    @media (prefers-color-scheme: dark) {
      .adm-avatar {
        background: rgba(255, 255, 255, 0.08);
        border-color: rgba(255, 255, 255, 0.12);
        color: rgba(255, 255, 255, 0.72);
      }

      .adm-avatar:hover {
        background: rgba(255, 255, 255, 0.12);
        border-color: rgba(255, 255, 255, 0.16);
      }
    }

    .adm-dropdown {
      position: absolute;
      top: 100%;
      right: 0;
      margin-top: 8px;
      background: rgba(255, 255, 255, 0.95);
      border: 1px solid rgba(0, 0, 0, 0.08);
      border-radius: 8px;
      padding: 8px 0;
      min-width: 180px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
      z-index: 50;
    }

    @media (prefers-color-scheme: dark) {
      .adm-dropdown {
        background: rgba(30, 30, 30, 0.95);
        border-color: rgba(255, 255, 255, 0.08);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.32);
      }
    }

    .adm-dropdown-item {
      padding: 8px 16px;
      font-size: 0.875rem;
      color: rgba(0, 0, 0, 0.88);
      cursor: pointer;
      transition: background 200ms ease;
      border: none;
      background: transparent;
      width: 100%;
      text-align: right;
      font-family: inherit;
    }

    .adm-dropdown-item:hover {
      background: rgba(0, 0, 0, 0.04);
    }

    .adm-dropdown-item:active {
      background: rgba(0, 0, 0, 0.08);
    }

    @media (prefers-color-scheme: dark) {
      .adm-dropdown-item {
        color: rgba(255, 255, 255, 0.88);
      }

      .adm-dropdown-item:hover {
        background: rgba(255, 255, 255, 0.04);
      }

      .adm-dropdown-item:active {
        background: rgba(255, 255, 255, 0.08);
      }
    }

    .adm-dropdown-separator {
      height: 1px;
      background: rgba(0, 0, 0, 0.08);
      margin: 8px 0;
    }

    @media (prefers-color-scheme: dark) {
      .adm-dropdown-separator {
        background: rgba(255, 255, 255, 0.08);
      }
    }

    .adm-role-badge {
      display: inline-block;
      font-size: 0.7rem;
      padding: 2px 6px;
      background: rgba(0, 0, 0, 0.06);
      border-radius: 3px;
      color: rgba(0, 0, 0, 0.64);
      margin-top: 4px;
    }

    @media (prefers-color-scheme: dark) {
      .adm-role-badge {
        background: rgba(255, 255, 255, 0.06);
        color: rgba(255, 255, 255, 0.64);
      }
    }

    .adm-dropdown-item-with-icon {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .adm-dropdown-item-icon {
      width: 16px;
      height: 16px;
      flex-shrink: 0;
    }
  `;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: headerStyles }} />
      <header className="adm-header">
        {/* Left: Title & Subtitle */}
        <div className="adm-header-left">
          <h1 className="adm-header-title">{routeData.title}</h1>
          <p className="adm-header-subtitle">{routeData.subtitle}</p>
        </div>

        {/* Center: Search */}
        <div className="adm-header-center">
          <div className="adm-search">
            <div className="adm-search-icon">
              <SearchIcon />
            </div>
            <input
              type="text"
              className="adm-search-input"
              placeholder="חיפוש לקוח, פרויקט, משימה..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
            />
          </div>
        </div>

        {/* Right: Actions */}
        <div className="adm-header-right">
          {/* Quick Create */}
          <div ref={quickCreateRef} style={{ position: 'relative' }}>
            <button
              className="adm-icon-btn"
              onClick={() => setShowQuickCreate(!showQuickCreate)}
              title="יצירה חדשה"
            >
              <PlusIcon />
            </button>
            {showQuickCreate && (
              <div className="adm-dropdown">
                <button
                  className="adm-dropdown-item"
                  onClick={() => handleQuickCreate('client')}
                >
                  לקוח חדש
                </button>
                <button
                  className="adm-dropdown-item"
                  onClick={() => handleQuickCreate('task')}
                >
                  משימה חדשה
                </button>
                <button
                  className="adm-dropdown-item"
                  onClick={() => handleQuickCreate('project')}
                >
                  פרויקט חדש
                </button>
              </div>
            )}
          </div>

          {/* Notifications */}
          <button className="adm-icon-btn" title="הודעות">
            <div style={{ position: 'relative' }}>
              <BellIcon />
              <div className="adm-notification-badge" />
            </div>
          </button>

          {/* AI Copilot */}
          <button className="adm-copilot-btn" title="AI עוזר">
            <SparkleIcon />
            <span>AI</span>
          </button>

          {/* Divider */}
          <div className="adm-divider" />

          {/* User Avatar & Menu */}
          <div ref={userMenuRef} style={{ position: 'relative' }}>
            <button
              className="adm-avatar"
              onClick={() => setShowUserMenu(!showUserMenu)}
              title={userName}
            >
              {userInitial}
            </button>
            {showUserMenu && (
              <div className="adm-dropdown" style={{ minWidth: '200px' }}>
                <div
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid rgba(0, 0, 0, 0.08)',
                  }}
                >
                  <div
                    style={{
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      color: 'rgba(0, 0, 0, 0.88)',
                    }}
                  >
                    {userName}
                  </div>
                  <div
                    style={{
                      fontSize: '0.75rem',
                      color: 'rgba(0, 0, 0, 0.56)',
                      marginTop: '2px',
                    }}
                  >
                    {userEmail}
                  </div>
                  <div className="adm-role-badge">
                    {ROLE_LABELS[userRole] || userRole}
                  </div>
                </div>
                <button
                  className="adm-dropdown-item"
                  onClick={() => (window.location.href = '/settings')}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <span
                    className="adm-dropdown-item-icon"
                    style={{ display: 'flex', alignItems: 'center' }}
                  >
                    <SettingsIcon />
                  </span>
                  <span>הגדרות</span>
                </button>
                <div className="adm-dropdown-separator" />
                <button
                  className="adm-dropdown-item"
                  onClick={handleLogout}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <span
                    className="adm-dropdown-item-icon"
                    style={{ display: 'flex', alignItems: 'center' }}
                  >
                    <LogoutIcon />
                  </span>
                  <span>יציאה</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
    </>
  );
}
