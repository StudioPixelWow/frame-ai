"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ThemeToggle } from "./theme-toggle";
import { NotificationCenter } from "./notification-center";
import { RoleSwitcher } from "./role-switcher";
import { SoundToggle } from "./ui/sound-toggle";
import { useAuth } from "@/lib/auth/auth-context";

/* ── Nav items with icons ──────────────────────────────────────────────── */

interface NavItem {
  href: string;
  label: string;
  id: string;
  icon: React.ReactNode;
  allowedRoles?: Array<'admin' | 'employee' | 'client'>;
}

// SVG Icons component
const Icons = {
  Dashboard: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  ),
  Projects: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  ),
  Clients: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  Leads: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
      <circle cx="5" cy="12" r="1" />
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  Campaigns: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
      <path d="M9 12L6 7" />
      <path d="M15 12l3-5" />
    </svg>
  ),
  Tasks: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  ),
  Calendar: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  Team: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  BusinessProjects: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  ),
  BarChart: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" y1="20" x2="12" y2="10" />
      <line x1="18" y1="20" x2="18" y2="4" />
      <line x1="6" y1="20" x2="6" y2="16" />
    </svg>
  ),
  CreditCard: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  ),
  Mic: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 1a3 3 0 0 0-3 3v12a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  ),
  Shield: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <polyline points="9 12 12 15 15 9" />
    </svg>
  ),
  MessageCircle: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  Mail: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  ),
  TrendingUp: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 17" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  ),
  Briefcase: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
      <path d="M16 7v-2a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
    </svg>
  ),
  Settings: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v6m0 6v6M4.22 4.22l4.24 4.24m3.08 3.08l4.24 4.24M1 12h6m6 0h6M4.22 19.78l4.24-4.24m3.08-3.08l4.24-4.24M19.78 19.78l-4.24-4.24m-3.08-3.08l-4.24-4.24" />
    </svg>
  ),
};

const mainNavItems: NavItem[] = [
  { href: "/dashboard", label: "דשבורד", id: "nav-dashboard", icon: Icons.Dashboard },
  { href: "/projects", label: "PixelFrameAI", id: "nav-projects", icon: Icons.Projects, allowedRoles: ['admin', 'employee'] },
  { href: "/clients", label: "לקוחות", id: "nav-clients", icon: Icons.Clients, allowedRoles: ['admin', 'employee'] },
  { href: "/leads", label: "לידים", id: "nav-leads", icon: Icons.Leads, allowedRoles: ['admin', 'employee'] },
  { href: "/campaigns", label: "קמפיינים", id: "nav-campaigns", icon: Icons.Campaigns, allowedRoles: ['admin', 'employee'] },
  { href: "/tasks", label: "משימות", id: "nav-tasks", icon: Icons.Tasks, allowedRoles: ['admin', 'employee'] },
  { href: "/business-calendar", label: "יומן", id: "nav-biz-calendar", icon: Icons.Calendar, allowedRoles: ['admin', 'employee'] },
  { href: "/employees", label: "צוות", id: "nav-employees", icon: Icons.Team, allowedRoles: ['admin'] },
  { href: "/business-projects", label: "פרויקטים", id: "nav-otp", icon: Icons.BusinessProjects },
  { href: "/business-projects/dashboard", label: "דשבורד פרויקטים", id: "nav-biz-dash", icon: Icons.BarChart },
  { href: "/accounting", label: "חשבונות", id: "nav-payments", icon: Icons.CreditCard, allowedRoles: ['admin'] },
  { href: "/accounting/podcast", label: "פודקאסט", id: "nav-podcast", icon: Icons.Mic, allowedRoles: ['admin', 'employee'] },
  { href: "/approvals", label: "אישורים", id: "nav-approvals", icon: Icons.Shield, allowedRoles: ['admin', 'employee'] },
  { href: "/whatsapp", label: "וואטסאפ", id: "nav-whatsapp", icon: Icons.MessageCircle, allowedRoles: ['admin', 'employee'] },
  { href: "/mailing", label: "דיוור", id: "nav-mailing", icon: Icons.Mail, allowedRoles: ['admin', 'employee'] },
  { href: "/stats", label: "סטטיסטיקות", id: "nav-stats", icon: Icons.TrendingUp, allowedRoles: ['admin'] },
  { href: "/exec-dashboard", label: "מנהלים", id: "nav-exec", icon: Icons.Briefcase, allowedRoles: ['admin'] },
  { href: "/settings", label: "הגדרות", id: "nav-settings", icon: Icons.Settings, allowedRoles: ['admin'] },
];

/* ── Main component ────────────────────────────────────────────────────── */

export function SideNav() {
  const pathname = usePathname();
  const { role } = useAuth();
  const [isExpanded, setIsExpanded] = useState(false);

  // Filter nav items based on role
  const visibleNavItems = mainNavItems.filter(
    (item) => !item.allowedRoles || item.allowedRoles.includes(role)
  );

  const isActive = (href: string) => {
    return pathname === href || pathname.startsWith(href + "/");
  };

  const renderNavLink = (item: NavItem) => {
    const active = isActive(item.href);
    return (
      <Link
        key={item.id}
        href={item.href}
        title={item.label}
        className="relative group"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          padding: "0.875rem 0.75rem",
          borderRadius: "0.5rem",
          color: active ? "var(--accent-text)" : "var(--foreground-muted)",
          textDecoration: "none",
          fontSize: "0.8rem",
          fontWeight: "500",
          transition: "all 150ms ease-out",
          backgroundColor: active ? "var(--accent-muted)" : "transparent",
          position: "relative",
        }}
        onMouseEnter={(e) => {
          if (!active) {
            (e.currentTarget as HTMLElement).style.backgroundColor = "var(--surface-raised)";
            (e.currentTarget as HTMLElement).style.color = "var(--foreground)";
          }
        }}
        onMouseLeave={(e) => {
          if (!active) {
            (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
            (e.currentTarget as HTMLElement).style.color = "var(--foreground-muted)";
          }
        }}
      >
        {/* Left accent bar for active state */}
        {active && (
          <div
            style={{
              position: "absolute",
              insetInlineEnd: 0,
              top: "50%",
              transform: "translateY(-50%)",
              width: "3px",
              height: "70%",
              backgroundColor: "var(--accent)",
              borderRadius: "3px 0 0 3px",
            }}
          />
        )}

        {/* Icon */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            width: "1.25rem",
            height: "1.25rem",
            color: "inherit",
          }}
        >
          {item.icon}
        </div>

        {/* Label (hidden in collapsed state on mobile) */}
        <span
          style={{
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            opacity: isExpanded ? 1 : 0,
            maxWidth: isExpanded ? "100%" : "0",
            transition: "opacity 150ms, max-width 150ms",
          }}
        >
          {item.label}
        </span>

        {/* Tooltip on hover for collapsed state */}
        {!isExpanded && (
          <div
            style={{
              position: "absolute",
              insetInlineEnd: "100%",
              top: "50%",
              transform: "translateY(-50%)",
              marginRight: "0.5rem",
              backgroundColor: "var(--surface-raised)",
              color: "var(--foreground)",
              padding: "0.375rem 0.75rem",
              borderRadius: "0.375rem",
              fontSize: "0.75rem",
              fontWeight: "500",
              whiteSpace: "nowrap",
              pointerEvents: "none",
              opacity: 0,
              transition: "opacity 150ms",
              zIndex: 50,
              border: "1px solid var(--border)",
            }}
            className="group-hover:opacity-100"
          >
            {item.label}
          </div>
        )}
      </Link>
    );
  };

  return (
    <nav
      style={{
        position: "fixed",
        insetInlineStart: 0,
        top: 0,
        bottom: 0,
        width: isExpanded ? "240px" : "64px",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "var(--sidenav-bg, rgba(255, 255, 255, 0.85))",
        backdropFilter: "blur(16px)",
        borderInlineEnd: "1px solid var(--border)",
        zIndex: 50,
        transition: "width 250ms ease-out",
        overscrollBehavior: "contain",
      }}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      {/* Logo Section */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: isExpanded ? "flex-start" : "center",
          padding: "1rem 0.75rem",
          borderBottom: "1px solid var(--border)",
          height: "4rem",
          flexShrink: 0,
        }}
      >
        <Link
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: isExpanded ? "0.75rem" : "0",
            textDecoration: "none",
            transition: "gap 150ms",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://s-pixel.co.il/wp-content/uploads/2026/04/Asset-1.png"
            alt="PixelFrameAI"
            style={{
              height: 28,
              width: "auto",
              filter: "var(--logo-filter, none)",
              flexShrink: 0,
            }}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
          {isExpanded && (
            <span
              style={{
                fontSize: "0.8rem",
                fontWeight: "700",
                letterSpacing: "-0.02em",
                color: "var(--accent-text)",
                whiteSpace: "nowrap",
                opacity: 1,
                transition: "opacity 150ms",
              }}
            >
              PixelFrame
            </span>
          )}
        </Link>
      </div>

      {/* Scrollable Nav Items */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
          padding: "0.5rem 0.5rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.25rem",
        }}
      >
        {visibleNavItems.map(renderNavLink)}
      </div>

      {/* Bottom Actions Section */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
          padding: "1rem 0.5rem",
          borderTop: "1px solid var(--border)",
          flexShrink: 0,
        }}
      >
        {/* Notification Center */}
        <div
          style={{
            display: "flex",
            justifyContent: isExpanded ? "flex-start" : "center",
          }}
        >
          <NotificationCenter />
        </div>

        {/* Role Switcher */}
        <div
          style={{
            display: "flex",
            justifyContent: isExpanded ? "flex-start" : "center",
          }}
        >
          <RoleSwitcher />
        </div>

        {/* Sound Toggle */}
        <div
          style={{
            display: "flex",
            justifyContent: isExpanded ? "flex-start" : "center",
          }}
        >
          <SoundToggle />
        </div>

        {/* Theme Toggle */}
        <div
          style={{
            display: "flex",
            justifyContent: isExpanded ? "flex-start" : "center",
          }}
        >
          <ThemeToggle />
        </div>

        {/* User Avatar Link */}
        {isExpanded && (
          <Link
            href="/profile"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              padding: "0.5rem 0.75rem",
              borderRadius: "0.375rem",
              border: "1px solid var(--border)",
              backgroundColor: "var(--surface)",
              color: "var(--foreground)",
              textDecoration: "none",
              fontSize: "0.75rem",
              fontWeight: "500",
              transition: "all 150ms",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = "var(--surface-raised)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = "var(--surface)";
            }}
          >
            <div
              style={{
                width: "1.75rem",
                height: "1.75rem",
                borderRadius: "50%",
                backgroundColor: "var(--accent)",
                opacity: 0.2,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.625rem",
                fontWeight: "700",
                color: "var(--accent-text)",
                flexShrink: 0,
              }}
            >
              T
            </div>
            <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              טל
            </span>
          </Link>
        )}
      </div>
    </nav>
  );
}
