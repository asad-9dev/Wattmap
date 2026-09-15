import Link from "next/link";
import { DISCLAIMER } from "@/lib/site";

const FOOTER_LINKS = [
  { href: "/methodology", label: "Methodology" },
  { href: "/data", label: "Data sources" },
  { href: "/toolkit", label: "Eco Club toolkit" },
  { href: "/boards", label: "School boards" },
  { href: "/about", label: "About WattMap" },
];

export function SiteFooter() {
  return (
    <footer className="no-print mt-16 border-t border-line bg-surface">
      <div className="page grid gap-6 py-8 text-sm text-ink-muted md:grid-cols-[2fr_1fr]">
        <div className="space-y-2">
          <p className="font-semibold text-ink">WattMap</p>
          <p className="max-w-2xl leading-6">{DISCLAIMER}</p>
          <p className="max-w-2xl leading-6">
            Contains information licensed under the{" "}
            <a className="link" href="https://www.ontario.ca/page/open-government-licence-ontario">
              Open Government Licence – Ontario
            </a>
            . Source data: Government of Ontario, Ontario Data Catalogue.
          </p>
        </div>
        <nav aria-label="Footer">
          <ul className="flex flex-col gap-1.5 md:items-end">
            {FOOTER_LINKS.map((link) => (
              <li key={link.href}>
                <Link className="link" href={link.href}>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
