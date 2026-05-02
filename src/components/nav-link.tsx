"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavLinkProps {
  href: string;
  icon: React.ReactNode;
  label: string;
  /** If true, match any sub-path (e.g. /projects/123 matches /projects) */
  matchPrefix?: boolean;
}

export function NavLink({ href, icon, label, matchPrefix = true }: NavLinkProps) {
  const pathname = usePathname();
  const active = matchPrefix ? pathname.startsWith(href) : pathname === href;

  return (
    <Link
      href={href}
      className={`
        flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium
        transition-colors duration-150
        ${active
          ? "bg-accent-muted text-accent-text"
          : "text-foreground-muted hover:text-foreground hover:bg-surface-raised"
        }
      `}
    >
      <span className="w-5 h-5 flex-shrink-0">{icon}</span>
      <span>{label}</span>
    </Link>
  );
}
