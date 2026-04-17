"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./theme-toggle";
import { NotificationCenter } from "./notification-center";

/* ── Nav items matching the preview exactly ─────────────────────────────── */

interface NavItem {
  href: string;
  label: string;
  id: string;
}

const mainNavItems: NavItem[] = [
  { href: "/dashboard",         label: "דשבורד",          id: "nav-dashboard" },
  { href: "/projects",          label: "PixelFrameAI",    id: "nav-projects" },
  { href: "/clients",           label: "לקוחות",          id: "nav-clients" },
  { href: "/leads",             label: "לידים",           id: "nav-leads" },
  { href: "/campaigns",         label: "קמפיינים",        id: "nav-campaigns" },
  { href: "/tasks",             label: "משימות",          id: "nav-tasks" },
  { href: "/business-calendar", label: "יומן",            id: "nav-biz-calendar" },
  { href: "/employees",         label: "צוות",            id: "nav-employees" },
  { href: "/business-projects", label: "פרויקטים",        id: "nav-otp" },
  { href: "/business-projects/dashboard", label: "דשבורד פרויקטים", id: "nav-biz-dash" },
  { href: "/accounting",        label: "חשבונות",         id: "nav-payments" },
  { href: "/accounting/podcast", label: "פודקאסט",        id: "nav-podcast" },
  { href: "/approvals",         label: "אישורים",         id: "nav-approvals" },
  { href: "/whatsapp",          label: "וואטסאפ",         id: "nav-whatsapp" },
  { href: "/mailing",           label: "דיוור",           id: "nav-mailing" },
  { href: "/stats",             label: "סטטיסטיקות",      id: "nav-stats" },
  { href: "/exec-dashboard",    label: "מנהלים",          id: "nav-exec" },
  { href: "/settings",          label: "הגדרות",          id: "nav-settings" },
];


/* ── Main component ────────────────────────────────────────────────────── */

export function TopNav() {
  const pathname = usePathname();

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
            {mainNavItems.map(renderNavLink)}
          </div>
        </div>

        {/* Right-side actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0 mr-1">
          {/* Notification center */}
          <NotificationCenter />

          {/* Email status pill */}
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border bg-surface text-xs text-foreground-muted">
            <span className="w-1.5 h-1.5 rounded-full bg-success" />
            <span>מחובר</span>
          </div>

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
