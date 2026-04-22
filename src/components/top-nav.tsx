"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./theme-toggle";
import { NotificationCenter } from "./notification-center";
import { RoleSwitcher } from "./role-switcher";
import { SoundToggle } from "./ui/sound-toggle";
import { useAuth } from "@/lib/auth/auth-context";

/* ── Nav items matching the preview exactly ─────────────────────────────── */

interface NavItem {
  href: string;
  label: string;
  id: string;
  /** Which roles can see this nav item. Omit for 'all roles'. */
  allowedRoles?: Array<'admin' | 'employee' | 'client'>;
}

const mainNavItems: NavItem[] = [
  { href: "/dashboard",         label: "דשבורד",          id: "nav-dashboard" },
  { href: "/projects",          label: "PixelFrameAI",    id: "nav-projects", allowedRoles: ['admin', 'employee'] },
  { href: "/clients",           label: "לקוחות",          id: "nav-clients", allowedRoles: ['admin', 'employee'] },
  { href: "/leads",             label: "לידים",           id: "nav-leads", allowedRoles: ['admin', 'employee'] },
  { href: "/campaigns",         label: "קמפיינים",        id: "nav-campaigns", allowedRoles: ['admin', 'employee'] },
  { href: "/tasks",             label: "משימות",          id: "nav-tasks", allowedRoles: ['admin', 'employee'] },
  { href: "/business-calendar", label: "יומן",            id: "nav-biz-calendar", allowedRoles: ['admin', 'employee'] },
  { href: "/employees",         label: "צוות",            id: "nav-employees", allowedRoles: ['admin'] },
  { href: "/business-projects", label: "פרויקטים",        id: "nav-otp" },
  { href: "/business-projects/dashboard", label: "דשבורד פרויקטים", id: "nav-biz-dash" },
  { href: "/accounting",        label: "חשבונות",         id: "nav-payments", allowedRoles: ['admin'] },
  { href: "/accounting/podcast", label: "פודקאסט",        id: "nav-podcast", allowedRoles: ['admin', 'employee'] },
  { href: "/approvals",         label: "אישורים",         id: "nav-approvals", allowedRoles: ['admin', 'employee'] },
  { href: "/whatsapp",          label: "וואטסאפ",         id: "nav-whatsapp", allowedRoles: ['admin', 'employee'] },
  { href: "/mailing",           label: "דיוור",           id: "nav-mailing", allowedRoles: ['admin', 'employee'] },
  { href: "/stats",             label: "סטטיסטיקות",      id: "nav-stats", allowedRoles: ['admin'] },
  { href: "/exec-dashboard",    label: "מנהלים",          id: "nav-exec", allowedRoles: ['admin'] },
  { href: "/settings",          label: "הגדרות",          id: "nav-settings", allowedRoles: ['admin'] },
];


/* ── Main component ────────────────────────────────────────────────────── */

export function TopNav() {
  const pathname = usePathname();
  const { role } = useAuth();

  // Filter nav items based on role
  const visibleNavItems = mainNavItems.filter(
    (item) => !item.allowedRoles || item.allowedRoles.includes(role)
  );

  const renderNavLink = (item: NavItem) => {
    const active = pathname === item.href || pathname.startsWith(item.href + "/");
    return (
      <Link
        key={item.id}
        href={item.href}
        className={`
          px-2.5 py-1.5 rounded-lg text-[0.82rem] font-medium whitespace-nowrap
          transition-colors duration-150
          ${active
            ? "bg-accent-muted text-accent-text border-b-2 border-accent"
            : "text-foreground-muted hover:text-foreground hover:bg-surface-raised"
          }
        `}
      >
        {item.label}
      </Link>
    );
  };

  return (
    <nav className="h-14 sticky top-0 z-40 flex items-center border-b border-border bg-surface/80 backdrop-blur-md">
      <div className="flex items-center gap-3 w-full px-4">

        {/* Brand */}
        <Link href="/" className="flex items-center gap-2 flex-shrink-0 ml-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://s-pixel.co.il/wp-content/uploads/2026/04/Asset-1.png"
            alt="PixelFrameAI"
            style={{ height: 28, width: "auto", filter: "brightness(0) invert(1)" }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
          <span className="text-sm font-bold tracking-tight text-accent-text hidden sm:inline">
            PixelFrameAI
          </span>
        </Link>

        {/* Divider */}
        <div className="h-5 w-px bg-border-muted flex-shrink-0" />

        {/* Scrollable nav items */}
        <div className="flex-1 overflow-x-auto scrollbar-hide">
          <div className="flex items-center gap-0.5">
            {visibleNavItems.map(renderNavLink)}
          </div>
        </div>

        {/* Right-side actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0 mr-1">
          {/* Notification center */}
          <NotificationCenter />

          {/* Role switcher */}
          <RoleSwitcher />

          {/* Email status pill */}
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border bg-surface text-xs text-foreground-muted">
            <span className="w-1.5 h-1.5 rounded-full bg-success" />
            <span>מחובר</span>
          </div>

          <SoundToggle />
          <ThemeToggle />

          {/* User avatar pill */}
          <Link
            href="/profile"
            className="flex items-center gap-2 px-2 py-1 rounded-full border border-border bg-surface hover:bg-surface-raised transition-colors duration-150 cursor-pointer no-underline"
          >
            <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center text-xs font-bold text-accent-text">
              T
            </div>
            <span className="hidden sm:inline text-xs font-medium text-foreground-muted">
              טל
            </span>
          </Link>

          {/* Interactive preview badge */}
          <Link
            href="/"
            className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-accent/30 bg-accent/8 text-xs font-semibold text-accent no-underline hover:bg-accent/15 transition-colors duration-150"
          >
            תצוגה אינטראקטיבית
          </Link>
        </div>
      </div>
    </nav>
  );
}
