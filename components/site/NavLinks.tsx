"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { NAV_LINKS } from "@/lib/site";

export function NavLinks() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const linkClass = (href: string) =>
    `rounded px-2.5 py-1.5 text-sm no-underline transition-colors ${
      isActive(href) ? "bg-accent-subtle font-medium text-accent-strong" : "text-ink-muted hover:text-ink"
    }`;

  return (
    <nav aria-label="Main">
      <ul className="hidden items-center gap-1 md:flex">
        {NAV_LINKS.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className={linkClass(link.href)} aria-current={isActive(link.href) ? "page" : undefined}>
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="rounded p-2 text-ink md:hidden"
        aria-expanded={open}
        aria-controls="mobile-nav"
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
      </button>
      {open && (
        <ul id="mobile-nav" className="absolute inset-x-0 top-14 border-b border-line bg-paper px-4 py-2 shadow-sm md:hidden">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className={`block ${linkClass(link.href)} py-2.5`}
                aria-current={isActive(link.href) ? "page" : undefined}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </nav>
  );
}
