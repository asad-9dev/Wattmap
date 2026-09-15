import Link from "next/link";
import { EuiHistogram } from "@/components/charts/EuiHistogram";
import { histogram } from "@/lib/analytics/histogram";
import { quantile } from "@/lib/analytics/stats";
import { formatEui, formatNumber } from "@/lib/format";

export function OntarioPreview({ distribution, year }: { distribution: number[]; year: number }) {
  const bins = histogram(distribution);
  const q25 = quantile(distribution, 0.25);
  const median = quantile(distribution, 0.5);
  const q75 = quantile(distribution, 0.75);
  return (
    <section aria-labelledby="preview-title" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="preview-title" className="text-xl font-semibold">
            How energy intensity varies across Ontario schools
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            Energy Use Intensity of {formatNumber(distribution.length)} benchmarked school buildings, {year} reporting year.
          </p>
        </div>
        <Link href="/ontario" className="link text-sm">
          Open the Ontario overview
        </Link>
      </div>
      <div className="card p-4">
        <EuiHistogram bins={bins} median={median} />
        <p className="mt-3 text-sm text-ink-muted">
          The median school used <span className="num text-ink">{formatEui(median)}</span>; half of schools fall between{" "}
          <span className="num text-ink">{formatEui(q25)}</span> and <span className="num text-ink">{formatEui(q75)}</span>.
          Differences reflect building age, systems, schedules, and use — not only efficiency.
        </p>
      </div>
    </section>
  );
}
