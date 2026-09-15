import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BoardSchoolTable } from "@/components/boards/BoardSchoolTable";
import { EnergyTrendChart } from "@/components/charts/EnergyTrendChart";
import { EuiHistogram } from "@/components/charts/EuiHistogram";
import { SchoolMapLoader } from "@/components/map/SchoolMapLoader";
import { DataUnavailable, MetricCard, PageHeader, Panel } from "@/components/ui/primitives";
import { histogram } from "@/lib/analytics/histogram";
import { withYearGaps } from "@/lib/analytics/series";
import { data, load } from "@/lib/data";
import { formatEui, formatGj, formatNumber, formatTonnesCo2e, splitUnit } from "@/lib/format";

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
  const eui = splitUnit(formatEui(medianEui));
  const energy = splitUnit(formatGj(latest?.totalEnergyGj));

  return (
    <>
      <PageHeader title={board.name}>
        <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {board.boardType && <Fact term="Type">{board.boardType}</Fact>}
          {board.language && <Fact term="Language">{board.language}</Fact>}
          {board.region && <Fact term="Region">{board.region}</Fact>}
          {board.website && (
            <Fact term="Website">
              <a className="link" href={/^https?:/i.test(board.website) ? board.website : `https://${board.website}`} rel="noopener noreferrer">
                {board.website.replace(/^https?:\/\//i, "")}
              </a>
            </Fact>
          )}
        </dl>
      </PageHeader>
      <div className="page space-y-4 py-8">
        <section aria-label="Board summary" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Schools benchmarked" value={formatNumber(benchmarkedCount)} detail={`Of ${formatNumber(schools.length)} active schools, ${latestYear ?? "—"}`} />
          <MetricCard label="Median school EUI" value={eui.value} unit={eui.unit} emphasis />
          <MetricCard label="Median opportunity score" value={medianScore != null ? formatNumber(medianScore) : "—"} detail="Among scored schools" />
          <MetricCard
            label="Reported energy"
            value={energy.value}
            unit={energy.unit}
            detail={latest ? `${formatNumber(latest.facilities)} facilities, ${formatTonnesCo2e(latest.totalGhgKg)}` : undefined}
          />
        </section>
        <p className="text-sm leading-6 text-ink-muted">
          Board figures summarize the facilities this board reported. Differences between boards reflect building stock, climate, and
          reporting, and do not by themselves show that a board caused them.
          {latest && latest.excludedImplausible > 0 && ` Totals leave out ${latest.excludedImplausible} record(s) with physically implausible values.`}
        </p>

        <div className="grid gap-4 lg:grid-cols-2">
          <Panel id="trend" title="Aggregate trend" description="All facilities the board reported each year. Aggregate EUI uses records with both energy and floor area.">
            <EnergyTrendChart
              title={`${board.name} aggregate energy`}
              metrics={["totalSiteEnergyGj", "eui", "ghgTonnes"]}
              rows={withYearGaps(yearly.map((y) => ({ year: y.year, totalSiteEnergyGj: y.totalEnergyGj, eui: y.aggregateEui, ghgKgCo2e: y.totalGhgKg })))}
            />
          </Panel>
          {benchmarked.length > 0 && (
            <Panel id="distribution" title="School EUI distribution" description={`Benchmarked schools in each Energy Use Intensity range, ${latestYear}.`}>
              <EuiHistogram bins={histogram(benchmarked.map((s) => s.eui!), 16)} median={medianEui} />
            </Panel>
          )}
        </div>

        {points.length > 0 && (
          <Panel id="map" title="Map" description="Schools with benchmarked data and official Ministry coordinates.">
            <SchoolMapLoader points={points} metric="eui" height={420} />
          </Panel>
        )}

        <Panel id="schools" title="Schools" description="Filter and sort every active school in the board. Figures are for the latest reporting year.">
          <BoardSchoolTable
            boardName={board.name}
            schools={schools.map((s) => ({
              slug: s.slug,
              name: s.name,
              city: s.city,
              level: s.level,
              eui: s.eui,
              percentile: s.percentile,
              score: s.score,
              scoreConfidence: s.scoreConfidence,
            }))}
          />
        </Panel>
      </div>
    </>
  );
}

function Fact({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-ink-muted">{term}</dt>
      <dd className="font-medium text-ink">{children}</dd>
    </div>
  );
}
