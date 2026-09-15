"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { NAV_LINKS } from "@/lib/site";

export function NavLinks() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const linkClass = (href: string) =>
    `rounded px-2.5 py-1.5 text-sm no-underline transition-colors duration-150 ${
      isActive(href) ? "bg-accent-subtle font-medium text-accent-strong" : "text-ink-muted hover:text-ink"
    }`;

  return (
    <nav aria-label="Main" className="flex items-center gap-2">
      <ul className="hidden items-center gap-0.5 lg:flex">
        {NAV_LINKS.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className={linkClass(link.href)} aria-current={isActive(link.href) ? "page" : undefined}>
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
      <div className="hidden lg:block">
        <ThemeToggle />
      </div>
      <button
        type="button"
        className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded text-ink lg:hidden"
        aria-expanded={open}
        aria-controls="mobile-nav"
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
      </button>
      {open && (
        <div id="mobile-nav" className="absolute inset-x-0 top-14 border-b border-line bg-canvas px-4 pb-4 pt-2 shadow-raised lg:hidden">
          <ul>
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className={`block ${linkClass(link.href)} py-2.5`} aria-current={isActive(link.href) ? "page" : undefined}>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-sm text-ink-muted">
            <span>Theme</span>
            <ThemeToggle />
          </div>
        </div>
      )}
    </nav>
  );
}
