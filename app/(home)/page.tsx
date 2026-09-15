import { ArrowRight, BarChart3, Database, Scale } from "lucide-react";
import Link from "next/link";
import { SearchBox } from "@/components/search/SearchBox";
import { DataUnavailable, MetricCard } from "@/components/ui/primitives";
import { data, load } from "@/lib/data";
import { formatEui, formatNumber, formatTonnesCo2e } from "@/lib/format";
import { OntarioPreview } from "./OntarioPreview";

export const dynamic = "force-dynamic";

const STEPS = [
  {
    Icon: Database,
    title: "Public data, cleaned",
    body: "Ontario publishes yearly energy and emissions reports for every school-board facility. WattMap reads every year since 2011, reconciles changing file layouts, and matches facilities to Ministry school records.",
  },
  {
    Icon: Scale,
    title: "Compared with real peers",
    body: "Each school is benchmarked only against schools of the same level and similar size — never against every building in the province.",
  },
  {
    Icon: BarChart3,
    title: "Explained, not judged",
    body: "Every number links back to its source and formula. Scores are screening indicators for further investigation, not audits or official ratings.",
  },
];

export default async function HomePage() {
  const [stats, overview] = await Promise.all([load(() => data.homeStats()), load(() => data.ontario())]);

  return (
    <>
      <section className="grid-motif border-b border-line">
        <div className="page grid gap-10 py-16 sm:py-24">
          <div className="max-w-3xl">
            <p className="eyebrow">Ontario school energy analytics</p>
            <h1 className="mt-3 text-4xl font-semibold leading-tight sm:text-5xl">See how Ontario schools use energy.</h1>
            <p className="mt-4 text-lg text-ink-muted">
              Search, compare, and explore publicly reported school energy performance across Ontario.
            </p>
          </div>
          <div className="max-w-2xl">
            <SearchBox />
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href="/map" className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white no-underline hover:bg-accent-strong">
                Explore Ontario <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link href="/schools" className="inline-flex items-center gap-2 rounded-md border border-line bg-white px-4 py-2.5 text-sm font-medium text-ink no-underline hover:border-accent">
                Browse all schools
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div className="page space-y-16 py-12">
        <section aria-labelledby="stats-title" className="space-y-4">
          <h2 id="stats-title" className="text-xl font-semibold">
            {stats.ok && stats.data ? `Ontario school facilities, ${stats.data.latestYear} reporting year` : "Ontario school facilities"}
          </h2>
          {!stats.ok ? (
            <DataUnavailable reason={stats.reason} />
          ) : stats.data === null ? (
            <DataUnavailable reason="unavailable" />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard label="Facilities reporting" value={formatNumber(stats.data.reportingFacilities)} detail={`${formatNumber(stats.data.boards)} school boards`} />
              <MetricCard label="Schools benchmarked" value={formatNumber(stats.data.benchmarkedSchools)} detail="Matched to Ministry school records" />
              <MetricCard label="Median energy intensity" value={formatEui(stats.data.medianEui)} detail="Site energy per m² of floor area" />
              <MetricCard
                label="Years of history"
                value={formatNumber(stats.data.yearsOfData)}
                detail={stats.data.firstYear ? `Reporting years ${stats.data.firstYear}–${stats.data.latestYear}` : undefined}
              />
            </div>
          )}
          {stats.ok && stats.data?.totalEnergyGj != null && (
            <p className="text-sm text-ink-muted">
              Reported site energy across all school-board facilities in {stats.data.latestYear}:{" "}
              <span className="num text-ink">{formatNumber(stats.data.totalEnergyGj / 1e6, 2)} million GJ</span>.
              {overview.ok && overview.data && (
                <>
                  {" "}
                  Reported emissions:{" "}
                  <span className="num text-ink">{formatTonnesCo2e(overview.data.reported.at(-1)?.totalGhgKg)}</span>.
                </>
              )}
            </p>
          )}
        </section>

        {overview.ok && overview.data && overview.data.distribution.length > 0 && (
          <OntarioPreview distribution={overview.data.distribution} year={overview.data.latestYear} />
        )}

        <section aria-labelledby="how-title" className="space-y-6">
          <h2 id="how-title" className="text-xl font-semibold">
            How WattMap works
          </h2>
          <ol className="grid gap-4 md:grid-cols-3">
            {STEPS.map(({ Icon, title, body }, index) => (
              <li key={title} className="card p-5">
                <div className="flex items-center gap-2">
                  <span className="num text-sm text-ink-faint">0{index + 1}</span>
                  <Icon size={18} className="text-accent" aria-hidden="true" />
                </div>
                <h3 className="mt-3 font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-ink-muted">{body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="transparency-title" className="card grid gap-6 p-6 md:grid-cols-[2fr_1fr] md:items-center">
          <div>
            <h2 id="transparency-title" className="text-xl font-semibold">
              Every calculation is documented
            </h2>
            <p className="mt-2 text-sm leading-6 text-ink-muted">
              Energy Use Intensity, peer selection, percentiles, the Energy Opportunity Score, and the modeled gap to the peer
              median are defined with formulas, units, and limitations. WattMap performs screening and benchmarking, not
              professional energy audits.
            </p>
          </div>
          <div className="flex flex-col gap-2 md:items-end">
            <Link href="/methodology" className="link text-sm">
              Read the methodology
            </Link>
            <Link href="/data" className="link text-sm">
              See data sources and coverage
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
