import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EnergyTrendChart } from "@/components/charts/EnergyTrendChart";
import { EuiHistogram } from "@/components/charts/EuiHistogram";
import { SchoolMapLoader } from "@/components/map/SchoolMapLoader";
import { DataUnavailable, MetricCard, PageHeader, Section } from "@/components/ui/primitives";
import { histogram } from "@/lib/analytics/histogram";
import { withYearGaps } from "@/lib/analytics/series";
import { data, load } from "@/lib/data";
import { formatEui, formatGj, formatNumber, formatPercentile, formatSchoolLevel, formatTonnesCo2e } from "@/lib/format";

export const dynamic = "force-dynamic";

type Params = { params: { slug: string } };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const result = await load(() => data.boardProfile(params.slug));
  if (result.ok && !result.data) notFound(); // before streaming, so the status is 404
  if (!result.ok || !result.data) return { title: "School board" };
  const name = result.data.board.name;
  return {
    title: `${name} Energy Overview`,
    description: `Publicly reported energy use, emissions, and peer benchmarks for schools in ${name}.`,
  };
}

export default async function BoardPage({ params }: Params) {
  const result = await load(() => data.boardProfile(params.slug));
  if (!result.ok) {
    return (
      <div className="page py-12">
        <DataUnavailable reason={result.reason} />
      </div>
    );
  }
  if (!result.data) notFound();
  const { board, schools, yearly, latestYear, benchmarkedCount, medianEui, medianScore } = result.data;
  const latest = yearly.at(-1);
  const benchmarked = schools.filter((s) => s.eui !== null);
  const points = benchmarked
    .filter((s) => s.lat !== null && s.lon !== null)
    .map((s) => ({ slug: s.slug, name: s.name, city: s.city, boardName: board.name, lat: s.lat!, lon: s.lon!, eui: s.eui, percentile: s.percentile, score: s.score, ghgIntensity: null, level: s.level }));

  return (
    <>
      <PageHeader eyebrow="School board" title={board.name}>
        {[board.boardType, board.language, board.region].filter(Boolean).join(" · ")}
        {board.website && (
          <>
            {" · "}
            <a className="link" href={/^https?:/i.test(board.website) ? board.website : `https://${board.website}`} rel="noopener noreferrer">
              Board website
            </a>
          </>
        )}
      </PageHeader>
      <div className="page space-y-12 py-10">
        <section aria-label="Board summary" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Schools benchmarked" value={formatNumber(benchmarkedCount)} detail={`of ${formatNumber(schools.length)} active schools, ${latestYear ?? "—"}`} />
          <MetricCard label="Median school EUI" value={formatEui(medianEui)} />
          <MetricCard label="Median opportunity score" value={medianScore != null ? formatNumber(medianScore) : "—"} detail="Among scored schools" />
          <MetricCard label="Reported energy" value={formatGj(latest?.totalEnergyGj)} detail={latest ? `${formatNumber(latest.facilities)} facilities · ${formatTonnesCo2e(latest.totalGhgKg)}` : undefined} />
        </section>
        <p className="text-sm text-ink-muted">
          Board-level figures summarize the facilities this board reported. Differences between boards reflect building stock, climate,
          and reporting, and do not by themselves show that a board caused them.
        </p>

        <Section id="trend" title="Aggregate trend" description="All facilities the board reported each year, matched to a school or not. Aggregate EUI uses only records with both energy and floor area.">
          <div className="card p-4">
            <EnergyTrendChart
              title={`${board.name} aggregate energy`}
              rows={withYearGaps(yearly.map((y) => ({ year: y.year, totalSiteEnergyGj: y.totalEnergyGj, eui: y.aggregateEui, ghgKgCo2e: y.totalGhgKg })))}
            />
          </div>
        </Section>

        {benchmarked.length > 0 && (
          <Section id="distribution" title="School EUI distribution" description={`Energy Use Intensity of benchmarked schools, ${latestYear}.`}>
            <div className="card p-4">
              <EuiHistogram bins={histogram(benchmarked.map((s) => s.eui!), 16)} median={medianEui} />
            </div>
          </Section>
        )}

        {points.length > 0 && (
          <Section id="map" title="Map">
            <SchoolMapLoader points={points} metric="eui" height={420} />
          </Section>
        )}

        <Section id="schools" title="Schools">
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <caption className="sr-only">Schools in {board.name}</caption>
              <thead className="border-b border-line bg-paper text-xs uppercase tracking-wide text-ink-muted">
                <tr>
                  <th scope="col" className="px-4 py-2">School</th>
                  <th scope="col" className="px-4 py-2">City</th>
                  <th scope="col" className="px-4 py-2 text-right">EUI</th>
                  <th scope="col" className="px-4 py-2 text-right">Percentile</th>
                  <th scope="col" className="px-4 py-2 text-right">Score</th>
                </tr>
              </thead>
              <tbody>
                {schools.map((s) => (
                  <tr key={s.slug} className="border-b border-line/70 last:border-0">
                    <th scope="row" className="px-4 py-2 font-normal">
                      <Link className="link" href={`/schools/${s.slug}`}>
                        {s.name}
                      </Link>
                      <span className="block text-xs text-ink-muted">{formatSchoolLevel(s.level)}</span>
                    </th>
                    <td className="px-4 py-2">{s.city ?? "—"}</td>
                    <td className="num px-4 py-2 text-right">{formatEui(s.eui)}</td>
                    <td className="num px-4 py-2 text-right">{formatPercentile(s.percentile)}</td>
                    <td className="num px-4 py-2 text-right">{s.score ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      </div>
    </>
  );
}
