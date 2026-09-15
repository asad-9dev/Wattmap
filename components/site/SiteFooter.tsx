import Link from "next/link";
import { DISCLAIMER } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="no-print mt-16 border-t border-line bg-white">
      <div className="page grid gap-6 py-8 text-sm text-ink-muted md:grid-cols-[2fr_1fr]">
        <div className="space-y-2">
          <p className="font-medium text-ink">WattMap</p>
          <p>{DISCLAIMER}</p>
          <p>
            Contains information licensed under the{" "}
            <a className="link" href="https://www.ontario.ca/page/open-government-licence-ontario">
              Open Government Licence – Ontario
            </a>
            . Source data: Government of Ontario, Ontario Data Catalogue.
          </p>
        </div>
        <nav aria-label="Footer" className="flex flex-col gap-1.5 md:items-end">
          <Link className="link" href="/methodology">
            Methodology
          </Link>
          <Link className="link" href="/data">
            Data sources
          </Link>
          <Link className="link" href="/about">
            About WattMap
          </Link>
        </nav>
      </div>
    </footer>
  );
}
