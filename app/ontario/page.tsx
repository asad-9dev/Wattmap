import type { Metadata } from "next";
import Link from "next/link";
import { EnergyTrendChart } from "@/components/charts/EnergyTrendChart";
import { EuiHistogram } from "@/components/charts/EuiHistogram";
import { DataUnavailable, MetricCard, PageHeader, Section } from "@/components/ui/primitives";
import { histogram } from "@/lib/analytics/histogram";
import { quantile } from "@/lib/analytics/stats";
import { withYearGaps } from "@/lib/analytics/series";
import { data, load } from "@/lib/data";
import { formatEui, formatGj, formatNumber, formatSchoolLevel, formatTonnesCo2e } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Ontario school energy overview",
  description: "Provincial totals, energy-intensity distribution, and historical trends for Ontario school-board facilities.",
};

export default async function OntarioPage() {
  const result = await load(() => data.ontario());
  if (!result.ok || !result.data) {
    return (
      <>
        <PageHeader eyebrow="Ontario" title="Ontario overview" />
        <div className="page py-10">
          <DataUnavailable reason={result.ok ? "unavailable" : result.reason} />
        </div>
      </>
    );
  }
  const o = result.data;
  const latestReported = o.reported.at(-1);
  const latestBenchmarked = o.benchmarked.at(-1);
  const excluded = o.reported.filter((r) => r.excludedImplausible > 0);
  const byYear = new Map(o.benchmarked.map((b) => [b.year, b.medianEui]));

  return (
    <>
      <PageHeader eyebrow="Ontario" title="Ontario school energy overview">
        Two scopes appear on this page and are labelled everywhere: <strong>all reporting school-board facilities</strong> (every row
        in the provincial reports, including administrative buildings and schools that have since closed), and{" "}
        <strong>benchmarked schools</strong> (school buildings matched to active Ministry school records).
      </PageHeader>
      <div className="page space-y-12 py-10">
        <section aria-label={`${o.latestYear} summary`} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Facilities reporting" value={formatNumber(latestReported?.facilities)} detail={`All school-board facilities, ${o.latestYear}`} />
          <MetricCard label="Total reported energy" value={formatGj(latestReported?.totalEnergyGj)} detail="All reporting facilities" />
          <MetricCard label="Total reported GHG" value={formatTonnesCo2e(latestReported?.totalGhgKg)} detail="All reporting facilities" />
          <MetricCard label="Median school EUI" value={formatEui(latestBenchmarked?.medianEui)} detail={`${formatNumber(latestBenchmarked?.schools)} benchmarked schools`} />
        </section>

        <Section id="trend" title="Historical trend" description="Totals cover all reporting facilities; the energy-intensity series is the median of benchmarked schools. Totals change partly because the number of reporting facilities changes.">
          <div className="card p-4">
            <EnergyTrendChart
              title="Ontario school-board energy"
              rows={withYearGaps(o.reported.map((r) => ({ year: r.year, totalSiteEnergyGj: r.totalEnergyGj, ghgKgCo2e: r.totalGhgKg, eui: byYear.get(r.year) ?? null })))}
            />
          </div>
          {excluded.length > 0 && (
            <p className="text-sm text-ink-muted">
              Totals leave out records whose reported values are physically implausible for a school building (
              {excluded.map((r) => `${r.excludedImplausible} in ${r.year}`).join(", ")}). They remain visible on their own profiles.{" "}
              <Link className="link" href="/methodology#cleaning">
                Why
              </Link>
            </p>
          )}
        </Section>

        <Section id="distribution" title="Energy intensity distribution" description={`Benchmarked schools, ${o.latestYear} reporting year.`}>
          <div className="card p-4">
            <EuiHistogram bins={histogram(o.distribution)} median={quantile(o.distribution, 0.5)} height={260} />
          </div>
        </Section>

        <div className="grid gap-8 lg:grid-cols-2">
          <Section id="levels" title="By school level">
            <BreakdownTable rows={o.byLevel.map((l) => ({ label: formatSchoolLevel(l.level), schools: l.schools, medianEui: l.medianEui }))} caption="Median EUI by school level" />
          </Section>
          <Section id="regions" title="By region">
            <BreakdownTable rows={o.byRegion.map((r) => ({ label: r.region ?? "Not reported", schools: r.schools, medianEui: r.medianEui }))} caption="Median EUI by region" />
          </Section>
        </div>

        <Section id="boards" title="By school board" description="Differences between boards reflect building stock, climate, and reporting as well as operations; they do not by themselves show that a board caused them.">
          <BreakdownTable
            rows={o.byBoard.map((b) => ({ label: b.name, href: `/boards/${b.slug}`, schools: b.schools, medianEui: b.medianEui }))}
            caption="Median EUI by school board"
          />
        </Section>
      </div>
    </>
  );
}

function BreakdownTable({ rows, caption }: { rows: { label: string; href?: string; schools: number; medianEui: number | null }[]; caption: string }) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[20rem] text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="border-b border-line bg-paper text-xs uppercase tracking-wide text-ink-muted">
          <tr>
            <th scope="col" className="px-4 py-2">Group</th>
            <th scope="col" className="px-4 py-2 text-right">Schools</th>
            <th scope="col" className="px-4 py-2 text-right">Median EUI</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-b border-line/70 last:border-0">
              <th scope="row" className="px-4 py-2 font-normal">
                {row.href ? (
                  <Link className="link" href={row.href}>
                    {row.label}
                  </Link>
                ) : (
                  row.label
                )}
              </th>
              <td className="num px-4 py-2 text-right">{formatNumber(row.schools)}</td>
              <td className="num px-4 py-2 text-right">{formatEui(row.medianEui)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
