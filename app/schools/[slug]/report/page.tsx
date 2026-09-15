import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PeerDistribution } from "@/components/charts/PeerDistribution";
import { StaticLineChart } from "@/components/charts/StaticLineChart";
import { PrintButton } from "@/components/ui/PrintButton";
import { DataUnavailable } from "@/components/ui/primitives";
import { data, load } from "@/lib/data";
import {
  formatArea,
  formatEui,
  formatGhgIntensity,
  formatGj,
  formatNumber,
  formatPercentile,
  formatSchoolLevel,
  formatSignedPercent,
  formatYearRange,
} from "@/lib/format";
import { buildProfileView, GAP_EXPLANATION, SCORE_EXPLANATION } from "@/lib/profile";
import { DISCLAIMER } from "@/lib/site";

export const dynamic = "force-dynamic";

type Params = { params: { slug: string } };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const result = await load(() => data.schoolProfile(params.slug));
  if (result.ok && !result.data) notFound(); // before streaming, so the status is 404
  const name = result.ok && result.data ? result.data.school.name : "School";
  return { title: `${name} Energy Report`, robots: { index: false } };
}

export default async function ReportPage({ params }: Params) {
  const result = await load(() => data.schoolProfile(params.slug));
  if (!result.ok) {
    return (
      <div className="page py-12">
        <DataUnavailable reason={result.reason} />
      </div>
    );
  }
  if (!result.data) notFound();
  const profile = result.data;
  const { school } = profile;
  const view = buildProfileView(profile);
  const { metric, latestYear } = view;
  const generated = new Date().toISOString().slice(0, 10);

  return (
    <div className="page max-w-4xl py-8 print:max-w-none print:px-0 print:py-0">
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href={`/schools/${school.slug}`} className="link text-sm">
          ← Back to profile
        </Link>
        <PrintButton />
      </div>

      <article className="card space-y-8 p-8 print:border-0 print:p-0">
        <header className="flex items-start justify-between gap-6 border-b border-line pb-6">
          <div>
            <p className="eyebrow">WattMap school energy report</p>
            <h1 className="mt-2 text-2xl font-semibold">{school.name}</h1>
            <p className="text-sm text-ink-muted">
              {school.boardName} · {formatSchoolLevel(school.schoolLevel)} · {school.city ?? ""}
            </p>
          </div>
          <dl className="text-right text-xs text-ink-muted">
            <dt>Report date</dt>
            <dd className="num text-ink">{generated}</dd>
            <dt className="mt-1">Latest reporting year</dt>
            <dd className="num text-ink">{latestYear?.year ?? "—"}</dd>
          </dl>
        </header>

        {!view.hasEnergyData ? (
          <p>WattMap could not confidently match this school to a public energy-reporting facility, so no energy figures are available.</p>
        ) : (
          <>
            <section className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              <Stat label="Total site energy" value={formatGj(latestYear?.totalSiteEnergyGj)} />
              <Stat label="Energy Use Intensity" value={formatEui(latestYear?.eui)} />
              <Stat label="GHG intensity" value={formatGhgIntensity(latestYear?.ghgIntensity)} />
              <Stat label="Floor area" value={formatArea(latestYear?.floorAreaM2)} />
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold">Energy Opportunity Score</h2>
              {metric?.opportunityScore != null ? (
                <p>
                  <strong className="num text-xl">{metric.opportunityScore} / 100</strong> — {metric.scoreConfidence} confidence.{" "}
                  {formatPercentile(metric.euiPercentile)} for energy intensity among {formatNumber(metric.peerCount)} comparable facilities.
                </p>
              ) : (
                <p>Not shown: {metric?.scoreReasons[0] ?? "insufficient data for a reliable score."}</p>
              )}
              <p className="text-xs text-ink-muted">{SCORE_EXPLANATION}</p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold">Energy intensity history</h2>
              <StaticLineChart
                points={view.chartRows.map((r) => ({ year: r.year, value: "missing" in r ? null : r.eui }))}
                unit="GJ/m²"
                digits={2}
                label="Energy Use Intensity by reporting year"
              />
              <p className="text-xs text-ink-muted">
                Reporting years {formatYearRange(view.years)}. Shaded: 2020–2021, pandemic-affected. Gaps: years without a report.
                {view.trend5 && ` 5-year trend: ${formatSignedPercent(view.trend5.annualChangePct)}/yr.`}
              </p>
            </section>

            {metric && metric.peerCount >= 10 && latestYear?.eui != null && (
              <section className="space-y-2">
                <h2 className="text-lg font-semibold">Peer comparison</h2>
                <PeerDistribution peerEuis={metric.peerEuis} target={latestYear.eui} q25={metric.peerQ25Eui} median={metric.peerMedianEui} q75={metric.peerQ75Eui} />
                <p className="text-sm">Peer group: {[...metric.peerCriteria, metric.peerStage].filter(Boolean).join("; ")}.</p>
              </section>
            )}

            <section className="space-y-2">
              <h2 className="text-lg font-semibold">Modeled energy gap to peer median</h2>
              <p>
                {metric?.energyGapGj == null
                  ? "Not available for this school."
                  : metric.energyGapGj > 0
                    ? `Approximately ${formatGj(metric.energyGapGj)} per year. This is a benchmarking estimate, not an engineering audit or guaranteed savings calculation.`
                    : "Energy intensity is at or below the peer median; the modeled gap is zero."}
              </p>
              <p className="text-xs text-ink-muted">{GAP_EXPLANATION}</p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold">Data quality notes — confidence: {view.confidence.level}</h2>
              {view.confidence.reasons.length === 0 ? (
                <p className="text-sm">No data-quality issues were detected for the latest reporting year.</p>
              ) : (
                <ul className="list-disc space-y-1 pl-5 text-sm">
                  {view.confidence.reasons.map((r) => (
                    <li key={r.text}>{r.text}</li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}

        <section className="space-y-2 border-t border-line pt-6 text-xs text-ink-muted">
          <h2 className="text-sm font-semibold text-ink">Methodology and sources</h2>
          <p>
            EUI = total site energy (GJ) ÷ floor area (m²). Peers share the operation type and school level and have similar floor area;
            the percentile is the share of peers with lower EUI. Score = 100 × (0.8 × percentile/100 + 0.2 × trend factor), where the
            trend factor maps −10 %/yr → 0 and +10 %/yr → 1. Full methodology: /methodology.
          </p>
          <p>
            Sources: Government of Ontario, Ontario Data Catalogue — “Energy use and greenhouse gas emissions for the Broader Public
            Sector” ({profile.series.flatMap((s) => s.sources).filter((v, i, a) => a.indexOf(v) === i).join(", ")}); “Ontario public school
            contact information”. Contains information licensed under the Open Government Licence – Ontario.
          </p>
          <p>{DISCLAIMER}</p>
        </section>
      </article>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-line p-3">
      <p className="text-[11px] uppercase tracking-wide text-ink-muted">{label}</p>
      <p className="num mt-1 text-base font-semibold">{value}</p>
    </div>
  );
}
