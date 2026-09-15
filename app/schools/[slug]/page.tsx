import { ExternalLink, FileDown } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EnergyTrendChart } from "@/components/charts/EnergyTrendChart";
import { PeerDistribution } from "@/components/charts/PeerDistribution";
import { InfoTip } from "@/components/ui/InfoTip";
import { ConfidenceBadge, DataUnavailable, EmptyState, MetricCard, Section } from "@/components/ui/primitives";
import { PEER_ANOMALY_LABELS, type PeerAnomalyLabel } from "@/lib/analytics/anomaly";
import { toKwhEquivalent } from "@/lib/analytics/metrics";
import { data, load } from "@/lib/data";
import {
  formatArea,
  formatEkwhPerM2,
  formatEui,
  formatGhgIntensity,
  formatGj,
  formatNumber,
  formatPercentile,
  formatSchoolLevel,
  formatSignedPercent,
  formatYearRange,
} from "@/lib/format";
import { buildProfileView, GAP_EXPLANATION, SCORE_EXPLANATION, type ProfileView } from "@/lib/profile";
import type { SchoolProfile } from "@/lib/db/queries/schools";

export const dynamic = "force-dynamic";

type Params = { params: { slug: string } };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const result = await load(() => data.schoolProfile(params.slug));
  // Metadata resolves before streaming starts, so calling notFound() here yields a real 404 status.
  if (result.ok && !result.data) notFound();
  if (!result.ok || !result.data) return { title: "School energy profile" };
  const name = result.data.school.name;
  const description = `Explore publicly reported energy use, greenhouse-gas emissions, historical trends, and peer benchmarking for ${name}.`;
  return {
    title: `${name} Energy Profile`,
    description,
    alternates: { canonical: `/schools/${params.slug}` },
    openGraph: { title: `${name} Energy Profile | WattMap`, description },
  };
}

const METHOD_LABELS: Record<string, string> = {
  override: "manually verified",
  exact_name_board: "exact name within the board",
  address_board: "same address within the board",
  name_city_board: "near-identical name in the same city and board",
};

export default async function SchoolPage({ params }: Params) {
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
  const view = buildProfileView(profile);
  const { school } = profile;

  return (
    <article>
      <header className="grid-motif border-b border-line">
        <div className="page space-y-3 py-10">
          <nav aria-label="Breadcrumb" className="text-sm text-ink-muted">
            <Link href="/schools" className="link">
              Schools
            </Link>{" "}
            / {school.name}
          </nav>
          <h1 className="text-3xl font-semibold sm:text-4xl">{school.name}</h1>
          <p className="text-ink-muted">
            <Link href={`/boards/${school.boardSlug}`} className="link">
              {school.boardName}
            </Link>
            {" · "}
            {formatSchoolLevel(school.schoolLevel)}
            {school.city && ` · ${school.city}, Ontario`}
          </p>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            {view.latestYear && (
              <span className="text-ink-muted">
                Latest reporting year: <span className="num text-ink">{view.latestYear.year}</span>
                {view.latestYear.periodEnd && ` (period ending ${view.latestYear.periodEnd})`}
              </span>
            )}
            {view.hasEnergyData && <ConfidenceBadge level={view.confidence.level} prefix="Data confidence" />}
            {school.website && (
              <a href={normalizeUrl(school.website)} className="link inline-flex items-center gap-1" rel="noopener noreferrer" target="_blank">
                School website <ExternalLink size={13} aria-hidden="true" />
              </a>
            )}
          </div>
        </div>
      </header>

      <div className="page space-y-12 py-10">
        {!view.hasEnergyData ? (
          <EmptyState title="No energy data matched">
            We found this school, but WattMap could not confidently match it to a public energy-reporting facility. Schools that
            opened recently, share a building, or report under a different name may not appear in the provincial energy data.
          </EmptyState>
        ) : (
          <ProfileBody profile={profile} view={view} />
        )}
      </div>
    </article>
  );
}

function ProfileBody({ profile, view }: { profile: SchoolProfile; view: ProfileView }) {
  const { metric, latestYear } = view;
  const { school } = profile;
  const scored = metric?.opportunityScore != null;

  return (
    <>
      <section aria-label="Key metrics" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Total site energy" value={formatGj(latestYear?.totalSiteEnergyGj)} detail={latestYear ? `${latestYear.year} reporting year` : undefined} />
        <MetricCard
          label="Energy Use Intensity"
          value={formatEui(latestYear?.eui)}
          detail={latestYear?.eui != null ? `≈ ${formatEkwhPerM2(toKwhEquivalent(latestYear.eui))} (energy-equivalent)` : "Floor area unavailable"}
          info={
            <InfoTip label="Energy Use Intensity">
              Total site energy divided by floor area (GJ/m²). The ekWh/m² figure expresses the same total energy in kWh units; it is
              not electricity use.
            </InfoTip>
          }
        />
        <MetricCard label="GHG intensity" value={formatGhgIntensity(latestYear?.ghgIntensity)} detail="Reported emissions per m²" />
        <MetricCard
          label="Energy Opportunity Score"
          value={scored ? `${metric!.opportunityScore} / 100` : "Not shown"}
          detail={scored ? undefined : (metric?.scoreReasons[0] ?? "Insufficient data for a reliable score.")}
          info={<InfoTip label="What does this mean?">{SCORE_EXPLANATION}</InfoTip>}
        >
          {scored && metric?.scoreConfidence && (
            <div className="mt-1">
              <ConfidenceBadge level={metric.scoreConfidence as "High" | "Medium" | "Low"} prefix="Score confidence" />
            </div>
          )}
        </MetricCard>
      </section>

      <Section
        id="history"
        title="Energy over time"
        description="Reported values for every year this school's facilities appear in Ontario's Broader Public Sector energy reports. Years are the source's reporting years; from 2021 each covers September to August."
      >
        <div className="card p-4">
          <EnergyTrendChart rows={view.chartRows} title={`${school.name} energy history`} />
        </div>
        {profile.series.some((s) => s.totalDerived) && (
          <p className="text-sm text-ink-muted">
            Totals for 2011–2020 are derived from the ministry&apos;s published energy intensity (GJ/m²) multiplied by the reported
            floor area; those files do not publish a total directly.
          </p>
        )}
      </Section>

      <Section id="peers" title="Peer comparison" description="Compared only with facilities of the same type, school level, and similar floor area.">
        {metric && metric.peerCount >= 10 && latestYear?.eui != null ? (
          <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
            <div className="card p-4">
              <PeerDistribution
                peerEuis={metric.peerEuis}
                target={latestYear.eui}
                q25={metric.peerQ25Eui}
                median={metric.peerMedianEui}
                q75={metric.peerQ75Eui}
              />
            </div>
            <div className="card space-y-3 p-4 text-sm">
              <h3 className="font-semibold">Where this school stands</h3>
              <p>
                Energy intensity is higher than{" "}
                <strong className="num">{Math.round(metric.euiPercentile ?? 0)}%</strong> of {formatNumber(metric.peerCount)} comparable
                Ontario facilities ({formatPercentile(metric.euiPercentile)} — a higher percentile means higher energy use per m²).
              </p>
              {metric.anomalyLabel && (
                <p>
                  Screening result: <strong>{PEER_ANOMALY_LABELS[metric.anomalyLabel as PeerAnomalyLabel]}</strong>
                </p>
              )}
              {metric.ghgPercentile != null && <p>GHG intensity: {formatPercentile(metric.ghgPercentile)} within the same peer group.</p>}
              <details>
                <summary className="cursor-pointer text-accent-strong">How peers are selected</summary>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-muted">
                  {metric.peerCriteria.map((criterion) => (
                    <li key={criterion}>{criterion}</li>
                  ))}
                  {metric.peerStage && <li>{metric.peerStage}</li>}
                  <li>Same reporting year; records with data-quality problems are excluded from every peer group.</li>
                </ul>
                <p className="mt-2 text-ink-muted">
                  WattMap starts with the strictest criteria and relaxes floor area step by step until at least 20 peers remain (minimum
                  10). <Link className="link" href="/methodology#peers">Full method</Link>
                </p>
              </details>
            </div>
          </div>
        ) : (
          <EmptyState title="Insufficient comparable facilities for a reliable peer benchmark.">
            There are not enough comparable facilities to calculate a reliable percentile for the latest reporting year.
          </EmptyState>
        )}
      </Section>

      <Section id="opportunity" title="Theoretical energy opportunity">
        {metric?.energyGapGj != null ? (
          metric.energyGapGj > 0 ? (
            <div className="card space-y-2 p-4 text-sm">
              <p className="flex items-center gap-1 text-base">
                Modeled gap to peer median: <strong className="num">{formatGj(metric.energyGapGj)}/year</strong>
                <InfoTip label="Modeled energy gap">{GAP_EXPLANATION}</InfoTip>
              </p>
              <p>
                If this facility&apos;s energy intensity matched the current median of comparable facilities, the model suggests annual
                site-energy use would be approximately {formatGj(metric.energyGapGj)} lower.
              </p>
              <p className="text-ink-muted">This is a benchmarking estimate, not an engineering audit or guaranteed savings calculation.</p>
            </div>
          ) : (
            <p className="card p-4 text-sm">Energy intensity is at or below the peer median, so the modeled gap is zero.</p>
          )
        ) : (
          <p className="text-sm text-ink-muted">A modeled gap needs a reliable peer median and floor area; one is not available.</p>
        )}
      </Section>

      <Section id="trends" title="Trends" description="Annualized change in energy intensity by least-squares fit; 2020 and 2021 are excluded as pandemic-affected.">
        <div className="grid gap-4 sm:grid-cols-3">
          <MetricCard label="3-year trend" value={view.trend3 ? `${formatSignedPercent(view.trend3.annualChangePct)}/yr` : "—"} detail={view.trend3 ? `Years ${view.trend3.yearsUsed.join(", ")}` : "Needs 3 usable years"} />
          <MetricCard label="5-year trend" value={view.trend5 ? `${formatSignedPercent(view.trend5.annualChangePct)}/yr` : "—"} detail={view.trend5 ? `Years ${view.trend5.yearsUsed.join(", ")}` : "Needs 5 usable years"} />
          <MetricCard
            label="Latest year-over-year"
            value={view.latestChange ? `${formatSignedPercent(view.latestChange.changePct)} YoY` : "—"}
            detail={
              view.latestChange
                ? `${view.latestChange.previousYear} → ${view.latestChange.year}${view.latestChange.pandemicAffected ? " (pandemic-affected)" : ""}`
                : "No report for the previous year"
            }
          />
        </div>
      </Section>

      <Section id="building" title="Building and reporting information">
        <dl className="card grid gap-x-8 gap-y-3 p-4 text-sm sm:grid-cols-2">
          <Fact term="Floor area" value={formatArea(latestYear?.floorAreaM2)} />
          <Fact term="Weekly operating hours" value={latestYear?.weeklyHours != null ? `${formatNumber(latestYear.weeklyHours)} h` : "Not reported"} />
          <Fact term="Portables" value={latestYear?.portableCount != null ? formatNumber(latestYear.portableCount) : "Not reported"} />
          <Fact term="Operation type (as reported)" value={latestYear?.operationType ?? "Not reported"} />
          <Fact term="School board" value={school.boardName} />
          <Fact term="Grades" value={school.gradeRange ?? "Not reported"} />
          <Fact term="Reporting period" value={latestYear?.periodEnd ? `12 months ending ${latestYear.periodEnd}` : "Not stated in the source"} />
          <Fact term="Years available" value={`${formatYearRange(view.years)} (${view.years.length} reports)`} />
          <Fact term="Address" value={[school.street, school.city, school.postalCode].filter(Boolean).join(", ") || "Not reported"} />
          <Fact
            term="Matched facility records"
            value={profile.facilities.map((f) => `${f.facilityName} (${METHOD_LABELS[f.matchMethod ?? ""] ?? f.matchMethod})`).join("; ")}
          />
        </dl>
      </Section>

      <Section id="confidence" title="Data confidence">
        <div className="card space-y-3 p-4 text-sm">
          <ConfidenceBadge level={view.confidence.level} prefix="Data confidence" />
          {view.confidence.reasons.length === 0 ? (
            <p>Complete reporting, a firm facility match, and a full peer group support the figures on this page.</p>
          ) : (
            <ul className="list-disc space-y-1 pl-5">
              {view.confidence.reasons.map((reason) => (
                <li key={reason.text}>
                  <span className="sr-only">{reason.severity}: </span>
                  {reason.text}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Section>

      <div className="no-print flex flex-wrap items-center gap-4">
        <Link href={`/schools/${school.slug}/report`} className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white no-underline hover:bg-accent-strong">
          <FileDown size={16} aria-hidden="true" /> Download WattMap Report
        </Link>
        <Link href={`/compare?schools=${school.slug}`} className="link text-sm">
          Compare with other schools
        </Link>
        <Link href="/methodology" className="link text-sm">
          Methodology
        </Link>
      </div>
    </>
  );
}

function Fact({ term, value }: { term: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-ink-muted">{term}</dt>
      <dd className="mt-0.5 text-ink">{value}</dd>
    </div>
  );
}

function normalizeUrl(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}
