import Link from "next/link";
import { NavLinks } from "./NavLinks";

export function SiteHeader() {
  return (
    <header className="no-print sticky top-0 z-40 border-b border-line bg-paper/95 backdrop-blur">
      <div className="page flex h-14 items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight text-ink no-underline">
          <Logo />
          <span>WattMap</span>
        </Link>
        <NavLinks />
      </div>
    </header>
  );
}

function Logo() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" className="text-accent">
      <rect x="1" y="1" width="22" height="22" rx="4" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M13 4 7 13.5h4.5L10 20l6.5-9.5H12L13 4Z" fill="currentColor" />
    </svg>
  );
}
