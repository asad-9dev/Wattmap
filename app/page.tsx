import Link from "next/link";
import { Suspense } from "react";
import { EuiHistogram } from "@/components/charts/EuiHistogram";
import { PercentileRuler } from "@/components/charts/PercentileRuler";
import { SearchBox } from "@/components/search/SearchBox";
import { DataUnavailable, MetricCard, Panel } from "@/components/ui/primitives";
import { Skeleton } from "@/components/ui/Skeleton";
import { histogram } from "@/lib/analytics/histogram";
import { quantile, toKwhEquivalent } from "@/lib/analytics/metrics";
import { data, load } from "@/lib/data";
import { formatEkwhPerM2, formatEui, formatNumber, formatTonnesCo2e, splitUnit } from "@/lib/format";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <>
      <section className="grid-motif border-b border-line bg-surface/60">
        <div className="page grid gap-10 py-12 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:py-16">
          <div>
            <h1 className="text-[34px] font-semibold leading-[1.1] tracking-tight sm:text-[44px]">See how Ontario schools use energy.</h1>
            <p className="mt-4 max-w-xl text-lg leading-7 text-ink-muted">
              Search, compare, and explore publicly reported school energy performance across Ontario.
            </p>
            <div className="mt-6 max-w-xl">
              <SearchBox />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/map" className="btn-primary">
                Explore Ontario
              </Link>
              <Link href="/schools" className="btn-secondary">
                Browse all schools
              </Link>
            </div>
          </div>
          <Suspense fallback={<Skeleton className="h-64" label="Loading provincial benchmark" />}>
            <HeroBenchmark />
          </Suspense>
        </div>
      </section>

      <div className="page space-y-10 py-10">
        <Suspense fallback={<Skeleton className="h-36" label="Loading provincial statistics" />}>
          <ProvincialSummary />
        </Suspense>
        <Suspense fallback={<Skeleton className="h-80" label="Loading distribution" />}>
          <DistributionPreview />
        </Suspense>
        <HowItWorks />
        <MethodologyPreview />
      </div>
    </>
  );
}

async function HeroBenchmark() {
  const overview = await load(() => data.ontario());
  if (!overview.ok || !overview.data || overview.data.distribution.length === 0) return <DataUnavailable reason={overview.ok ? "unavailable" : overview.reason} />;
  const values = overview.data.distribution;
  const q25 = quantile(values, 0.25);
  const median = quantile(values, 0.5);
  const q75 = quantile(values, 0.75);
  const p95 = quantile(values, 0.95) ?? 1;
  return (
    <Panel
      title={`The benchmark ruler, ${overview.data.latestYear}`}
      description={`Energy Use Intensity of ${formatNumber(values.length)} benchmarked Ontario school buildings.`}
    >
      <PercentileRuler value={null} q25={q25} median={median} q75={q75} max={p95} groupLabel="Ontario schools" />
      <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
        {[
          ["25th percentile", q25],
          ["Median", median],
          ["75th percentile", q75],
        ].map(([label, value]) => (
          <div key={label as string} className="inset">
            <dt className="label">{label}</dt>
            <dd className="num mt-0.5 text-lg font-semibold">
              {formatNumber(value as number | null, 2)} <span className="text-xs font-normal text-ink-muted">GJ/m²</span>
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-[13px] leading-5 text-ink-muted">
        Every school profile places the school on this ruler against its own peer group: same level, similar size, same year.
      </p>
    </Panel>
  );
}

async function ProvincialSummary() {
  const [stats, overview] = await Promise.all([load(() => data.homeStats()), load(() => data.ontario())]);
  if (!stats.ok || !stats.data) return <DataUnavailable reason={stats.ok ? "unavailable" : stats.reason} />;
  const s = stats.data;
  const ghg = overview.ok ? overview.data?.reported.at(-1)?.totalGhgKg : null;
  const eui = splitUnit(formatEui(s.medianEui));
  const ghgParts = splitUnit(formatTonnesCo2e(ghg));
  return (
    <section aria-labelledby="summary-title" className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="summary-title" className="text-lg font-semibold">
          Ontario school facilities, {s.latestYear} reporting year
        </h2>
        <p className="text-sm text-ink-muted">
          {formatNumber(s.yearsOfData)} years of reports, {s.firstYear}–{s.latestYear}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Facilities reporting" value={formatNumber(s.reportingFacilities)} detail={`Across ${formatNumber(s.boards)} school boards`} />
        <MetricCard label="Schools benchmarked" value={formatNumber(s.benchmarkedSchools)} detail="Matched to Ministry school records" />
        <MetricCard
          label="Median energy intensity"
          value={eui.value}
          unit={eui.unit}
          detail={`${formatEkwhPerM2(toKwhEquivalent(s.medianEui))} energy-equivalent`}
          emphasis
        />
        <MetricCard
          label="Reported site energy"
          value={s.totalEnergyGj != null ? formatNumber(s.totalEnergyGj / 1e6, 2) : "—"}
          unit="million GJ"
          detail={ghg != null ? `${ghgParts.value} ${ghgParts.unit} reported emissions` : undefined}
        />
      </div>
    </section>
  );
}

async function DistributionPreview() {
  const overview = await load(() => data.ontario());
  if (!overview.ok || !overview.data || overview.data.distribution.length === 0) return null;
  const { distribution, latestYear } = overview.data;
  return (
    <Panel
      id="distribution"
      title="How energy intensity varies across Ontario schools"
      description={`Number of benchmarked school buildings in each Energy Use Intensity range, ${latestYear}.`}
      actions={
        <Link href="/ontario" className="link text-sm">
          Open the Ontario overview
        </Link>
      }
    >
      <EuiHistogram bins={histogram(distribution)} median={quantile(distribution, 0.5)} />
      <p className="mt-3 text-[13px] leading-5 text-ink-muted">
        Half of schools fall between {formatEui(quantile(distribution, 0.25))} and {formatEui(quantile(distribution, 0.75))}. Differences
        reflect building age, systems, schedules, and use, not only efficiency.
      </p>
    </Panel>
  );
}

const STEPS = [
  {
    title: "Public reports, cleaned",
    body: "Every school board reports each building's yearly energy use to the province. WattMap reads every report since 2011, reconciles three file layouts, and matches buildings to Ministry school records.",
  },
  {
    title: "Compared with real peers",
    body: "Each school is benchmarked only against schools of the same level and similar floor area in the same year — never against every building in Ontario.",
  },
  {
    title: "Explained, not judged",
    body: "Every figure shows its formula, source, and confidence. Scores flag where further investigation may help; they are not audits or official ratings.",
  },
];

function HowItWorks() {
  return (
    <Panel id="how" title="How WattMap works" bodyClassName="grid md:grid-cols-3">
      {STEPS.map((step, index) => (
        <div key={step.title} className="border-line p-5 md:border-l md:first:border-l-0 [&:not(:first-child)]:border-t md:[&:not(:first-child)]:border-t-0">
          <p className="num text-sm font-semibold text-accent-strong">Step {index + 1}</p>
          <h3 className="mt-1 font-semibold">{step.title}</h3>
          <p className="mt-2 text-sm leading-6 text-ink-muted">{step.body}</p>
        </div>
      ))}
    </Panel>
  );
}

const FORMULAS = [
  { title: "Energy Use Intensity", formula: "site energy (GJ) ÷ floor area (m²)", body: "The core comparison metric: energy per square metre, so building size does not dominate.", anchor: "eui" },
  { title: "Peer percentile", formula: "peers below + ½ ties, as % of peers", body: "Higher means more energy per m² than comparable schools. 72nd = higher than 72% of peers.", anchor: "percentiles" },
  { title: "Opportunity score", formula: "100 × (0.8 × percentile + 0.2 × trend)", body: "A screening indicator from 0 to 100, hidden when peers or data are insufficient.", anchor: "score" },
  { title: "Gap to peer median", formula: "(EUI − peer median) × floor area", body: "The modeled yearly energy difference if the school matched its peers' median.", anchor: "gap" },
];

function MethodologyPreview() {
  return (
    <Panel
      id="methodology-preview"
      title="How the numbers are calculated"
      description="Every metric is a documented, tested formula on public data."
      actions={
        <Link href="/methodology" className="link text-sm">
          Read the methodology
        </Link>
      }
      bodyClassName="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-4"
    >
      {FORMULAS.map((f) => (
        <Link key={f.title} href={`/methodology#${f.anchor}`} className="group rounded-md border border-line p-4 no-underline transition-colors duration-150 hover:border-accent">
          <h3 className="font-semibold text-ink group-hover:text-accent-strong">{f.title}</h3>
          <p className="mt-2 rounded bg-accent-subtle px-2 py-1.5 font-mono text-[12px] leading-5 text-accent-strong">{f.formula}</p>
          <p className="mt-2 text-[13px] leading-5 text-ink-muted">{f.body}</p>
        </Link>
      ))}
    </Panel>
  );
}
