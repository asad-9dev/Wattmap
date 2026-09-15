import type { Metadata } from "next";
import Link from "next/link";
import { DataUnavailable, PageHeader } from "@/components/ui/primitives";
import { data, load } from "@/lib/data";
import { formatEui, formatNumber } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ontario school boards", description: "Energy overviews for every Ontario school board." };

export default async function BoardsPage() {
  const result = await load(() => data.ontario());
  return (
    <>
      <PageHeader eyebrow="School boards" title="Ontario school boards">
        Median Energy Use Intensity of each board&apos;s benchmarked schools in the latest reporting year.
      </PageHeader>
      <div className="page py-10">
        {!result.ok || !result.data ? (
          <DataUnavailable reason={result.ok ? "unavailable" : result.reason} />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {result.data.byBoard.map((b) => (
              <li key={b.slug} className="card p-4">
                <Link href={`/boards/${b.slug}`} className="link font-medium">
                  {b.name}
                </Link>
                <p className="mt-1 text-sm text-ink-muted">
                  {formatNumber(b.schools)} schools · median <span className="num">{formatEui(b.medianEui)}</span>
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
