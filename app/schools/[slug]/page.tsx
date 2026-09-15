import { AlertTriangle, CircleDot, ExternalLink, FileDown, Info, Scale } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { EnergyTrendChart } from "@/components/charts/EnergyTrendChart";
import { PeerHistogram } from "@/components/charts/PeerHistogram";
import { PercentileRuler } from "@/components/charts/PercentileRuler";
import { InfoTip } from "@/components/ui/InfoTip";
import { ConfidenceBadge, DataUnavailable, EmptyState, MetricCard, Panel } from "@/components/ui/primitives";
import { PEER_ANOMALY_LABELS, type PeerAnomalyLabel } from "@/lib/analytics/anomaly";
import type { ConfidenceReason } from "@/lib/analytics/metrics";
import { toKwhEquivalent } from "@/lib/analytics/metrics";
import { data, load } from "@/lib/data";
import type { SchoolProfile } from "@/lib/db/queries/schools";
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
  splitUnit,
} from "@/lib/format";
import { buildProfileView, GAP_EXPLANATION, SCORE_EXPLANATION, type ProfileView } from "@/lib/profile";

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
      <header className="grid-motif border-b border-line bg-surface/60">
        <div className="page space-y-4 py-8">
          <nav aria-label="Breadcrumb" className="text-sm text-ink-muted">
            <Link href="/schools" className="link">
              Schools
            </Link>
            <span aria-hidden="true"> / </span>
            <span aria-current="page">{school.name}</span>
          </nav>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-[28px] font-semibold leading-tight tracking-tight sm:text-[34px]">{school.name}</h1>
              <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                <Fact term="Board">
                  <Link href={`/boards/${school.boardSlug}`} className="link">
                    {school.boardName}
                  </Link>
                </Fact>
                <Fact term="Level">{formatSchoolLevel(school.schoolLevel)}</Fact>
                {school.city && <Fact term="City">{school.city}, Ontario</Fact>}
                {view.latestYear && (
                  <Fact term="Latest report">
                    <span className="num">{view.latestYear.year}</span>
                    {view.latestYear.periodEnd && <span className="text-ink-muted"> (to {view.latestYear.periodEnd})</span>}
                  </Fact>
                )}
              </dl>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                {view.hasEnergyData && <ConfidenceBadge level={view.confidence.level} prefix="Data confidence" />}
                {school.website && (
                  <a href={normalizeUrl(school.website)} className="link inline-flex items-center gap-1" rel="noopener noreferrer" target="_blank">
                    School website <ExternalLink size={13} aria-hidden="true" />
                    <span className="sr-only">(opens in a new tab)</span>
                  </a>
                )}
              </div>
            </div>
            {view.hasEnergyData && (
              <div className="no-print flex flex-wrap gap-2">
                <Link href={`/schools/${school.slug}/report`} className="btn-primary">
                  <FileDown size={16} aria-hidden="true" /> Download WattMap Report
                </Link>
                <Link href={`/compare?schools=${school.slug}`} className="btn-secondary">
                  <Scale size={16} aria-hidden="true" /> Compare
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="page space-y-4 py-8">
        {!view.hasEnergyData ? (
          <EmptyState title="No energy data matched">
            We found this school, but WattMap could not confidently match it to a public energy-reporting facility. Schools that opened
            recently, share a building, or report under a different name may not appear in the provincial energy data.
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
  const total = splitUnit(formatGj(latestYear?.totalSiteEnergyGj));
  const eui = splitUnit(formatEui(latestYear?.eui));
  const ghg = splitUnit(formatGhgIntensity(latestYear?.ghgIntensity));
  const benchmarked = metric !== null && metric.peerCount >= 10 && latestYear?.eui != null;

  return (
    <>
      <section aria-label="Key metrics" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Total site energy" value={total.value} unit={total.unit} detail={latestYear ? `${latestYear.year} reporting year` : undefined} />
        <MetricCard
          label="Energy Use Intensity"
          value={eui.value}
          unit={eui.unit}
          detail={latestYear?.eui != null ? `${formatEkwhPerM2(toKwhEquivalent(latestYear.eui))} energy-equivalent` : "Floor area unavailable"}
          info={
            <InfoTip label="Energy Use Intensity">
              Total site energy divided by floor area (GJ/m²). The ekWh/m² figure expresses the same total energy in kWh units; it is not
              electricity use.
            </InfoTip>
          }
        />
        <MetricCard label="GHG intensity" value={ghg.value} unit={ghg.unit} detail="Reported emissions per m²" />
        <MetricCard
          label="Energy Opportunity Score"
          value={scored ? metric!.opportunityScore : "Not shown"}
          unit={scored ? "/ 100" : undefined}
          detail={scored ? undefined : (metric?.scoreReasons[0] ?? "Insufficient data for a reliable score.")}
          info={<InfoTip label="What does this mean?">{SCORE_EXPLANATION}</InfoTip>}
          emphasis
        >
          {scored && metric?.scoreConfidence && (
            <div className="mt-0.5">
              <ConfidenceBadge level={metric.scoreConfidence as "High" | "Medium" | "Low"} prefix="Score confidence" />
            </div>
          )}
        </MetricCard>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel id="history" title="Energy over time" description="Reported values by reporting year; from 2021 each year runs September to August.">
          <EnergyTrendChart
            rows={view.chartRows}
            title={`${school.name} energy history`}
            metrics={["totalSiteEnergyGj", "eui", "electricityKwh", "naturalGasM3", "naturalGasGj", "normalizedTotalEnergyGj"]}
          />
          {profile.series.some((s) => s.totalDerived) && (
            <p className="mt-3 text-[13px] leading-5 text-ink-muted">
              Totals for 2011–2020 are the ministry&apos;s published intensity (GJ/m²) × reported floor area; those files do not publish a
              total directly.
            </p>
          )}
        </Panel>
        <Panel id="emissions" title="Emissions over time" description="Reported greenhouse-gas emissions, total and per m² of floor area.">
          <EnergyTrendChart rows={view.chartRows} title={`${school.name} emissions history`} metrics={["ghgTonnes", "ghgIntensity"]} />
        </Panel>
      </div>

      <Panel id="peers" title="Peer comparison" description="Compared only with facilities of the same type, school level, and similar floor area in the same reporting year.">
        {benchmarked ? (
          <div className="space-y-5">
            <PercentileRuler
              value={latestYear!.eui!}
              q25={metric!.peerQ25Eui}
              median={metric!.peerMedianEui}
              q75={metric!.peerQ75Eui}
              max={Math.max(...metric!.peerEuis, latestYear!.eui!) * 1.05}
            />
            <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
              <figure>
                <PeerHistogram peerEuis={metric!.peerEuis} target={latestYear!.eui!} q25={metric!.peerQ25Eui} median={metric!.peerMedianEui} q75={metric!.peerQ75Eui} />
                <figcaption className="mt-2 text-[13px] leading-5 text-ink-muted">
                  Bars count comparable facilities in each intensity range. The shaded band is the middle half of the peer group (25th–75th
                  percentile).
                </figcaption>
              </figure>
              <div className="space-y-3 text-sm">
                <h3 className="font-semibold">Where this school stands</h3>
                <p className="leading-6">
                  Energy intensity is higher than <strong className="num">{Math.round(metric!.euiPercentile ?? 0)}%</strong> of{" "}
                  {formatNumber(metric!.peerCount)} comparable Ontario facilities ({formatPercentile(metric!.euiPercentile)}; a higher
                  percentile means more energy per m²).
                </p>
                <dl className="grid grid-cols-2 gap-2">
                  <InsetStat term="Peer median" value={formatEui(metric!.peerMedianEui)} />
                  <InsetStat term="Middle half" value={`${formatNumber(metric!.peerQ25Eui, 2)}–${formatNumber(metric!.peerQ75Eui, 2)}`} />
                  <InsetStat term="Peers" value={formatNumber(metric!.peerCount)} />
                  <InsetStat term="Screening" value={metric!.anomalyLabel ? PEER_ANOMALY_LABELS[metric!.anomalyLabel as PeerAnomalyLabel] : "—"} />
                </dl>
                {metric!.ghgPercentile != null && <p className="text-ink-muted">GHG intensity: {formatPercentile(metric!.ghgPercentile)} in the same peer group.</p>}
                <details className="rounded-md border border-line p-3">
                  <summary className="cursor-pointer font-medium text-accent-strong">How peers are selected</summary>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-muted">
                    {metric!.peerCriteria.map((criterion) => (
                      <li key={criterion}>{criterion}</li>
                    ))}
                    {metric!.peerStage && <li>{metric!.peerStage}</li>}
                    <li>Same reporting year; records with data-quality problems are excluded from every peer group.</li>
                  </ul>
                  <p className="mt-2 text-ink-muted">
                    Criteria relax step by step until at least 20 peers remain (minimum 10).{" "}
                    <Link className="link" href="/methodology#peers">
                      Full method
                    </Link>
                  </p>
                </details>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm leading-6">
            <strong>Insufficient comparable facilities for a reliable peer benchmark.</strong> There are not enough comparable facilities to
            calculate a reliable percentile for the latest reporting year.
          </p>
        )}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel id="opportunity" title="Theoretical energy opportunity" actions={<InfoTip label="Modeled energy gap">{GAP_EXPLANATION}</InfoTip>}>
          {metric?.energyGapGj != null ? (
            metric.energyGapGj > 0 ? (
              <div className="space-y-3 text-sm leading-6">
                <div className="rounded-md border-l-[3px] border-l-signal-high bg-signal-high-wash px-4 py-3">
                  <p className="label">Modeled gap to peer median</p>
                  <p className="num text-[26px] font-semibold leading-8">
                    {splitUnit(formatGj(metric.energyGapGj)).value} <span className="text-sm font-normal text-ink-muted">GJ per year</span>
                  </p>
                </div>
                <p>
                  If this facility&apos;s energy intensity matched the current median of comparable facilities, the model suggests annual
                  site-energy use would be approximately {formatGj(metric.energyGapGj)} lower.
                </p>
                <p className="text-ink-muted">This is a benchmarking estimate, not an engineering audit or guaranteed savings calculation.</p>
              </div>
            ) : (
              <p className="text-sm leading-6">Energy intensity is at or below the peer median, so the modeled gap is zero.</p>
            )
          ) : (
            <p className="text-sm leading-6 text-ink-muted">A modeled gap needs a reliable peer median and floor area; one is not available.</p>
          )}
        </Panel>

        <Panel id="confidence" title="Data confidence" actions={<ConfidenceBadge level={view.confidence.level} prefix="Rating" />}>
          {view.confidence.reasons.length === 0 ? (
            <p className="text-sm leading-6">Complete reporting, a firm facility match, and a full peer group support the figures on this page.</p>
          ) : (
            <ul className="space-y-2 text-sm leading-6">
              {view.confidence.reasons.map((reason) => (
                <ReasonItem key={reason.text} reason={reason} />
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel id="trends" title="Trends" description="Annualized change in energy intensity (least-squares fit); 2020 and 2021 are excluded as pandemic-affected." bodyClassName="grid gap-2 p-4 sm:grid-cols-3 sm:p-5">
        <InsetStat term="3-year trend" value={view.trend3 ? `${formatSignedPercent(view.trend3.annualChangePct)} per year` : "Needs 3 usable years"} note={view.trend3 ? `Years ${view.trend3.yearsUsed.join(", ")}` : undefined} />
        <InsetStat term="5-year trend" value={view.trend5 ? `${formatSignedPercent(view.trend5.annualChangePct)} per year` : "Needs 5 usable years"} note={view.trend5 ? `Years ${view.trend5.yearsUsed.join(", ")}` : undefined} />
        <InsetStat
          term="Latest year-over-year"
          value={view.latestChange ? `${formatSignedPercent(view.latestChange.changePct)} YoY` : "No previous-year report"}
          note={view.latestChange ? `${view.latestChange.previousYear} to ${view.latestChange.year}${view.latestChange.pandemicAffected ? ", pandemic-affected" : ""}` : undefined}
        />
      </Panel>

      <Panel id="building" title="Building and reporting information">
        <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <DetailItem term="Floor area" value={formatArea(latestYear?.floorAreaM2)} />
          <DetailItem term="Weekly operating hours" value={latestYear?.weeklyHours != null ? `${formatNumber(latestYear.weeklyHours)} h` : "Not reported"} />
          <DetailItem term="Portables" value={latestYear?.portableCount != null ? formatNumber(latestYear.portableCount) : "Not reported"} />
          <DetailItem term="Operation type (as reported)" value={latestYear?.operationType ?? "Not reported"} />
          <DetailItem term="Grades" value={school.gradeRange ?? "Not reported"} />
          <DetailItem term="Reporting period" value={latestYear?.periodEnd ? `12 months ending ${latestYear.periodEnd}` : "Not stated in the source"} />
          <DetailItem term="Years available" value={`${formatYearRange(view.years)} (${view.years.length} reports)`} />
          <DetailItem term="Address" value={[school.street, school.city, school.postalCode].filter(Boolean).join(", ") || "Not reported"} />
          <DetailItem
            term="Matched facility records"
            value={profile.facilities.map((f) => `${f.facilityName} (${METHOD_LABELS[f.matchMethod ?? ""] ?? f.matchMethod})`).join("; ")}
          />
        </dl>
        <p className="mt-4 text-[13px] text-ink-muted">
          Every figure comes from Ontario&apos;s Broader Public Sector energy reports.{" "}
          <Link href="/methodology" className="link">
            How the figures are calculated
          </Link>
        </p>
      </Panel>
    </>
  );
}

const REASON_ICON = { limiting: AlertTriangle, caution: CircleDot, info: Info } as const;
const REASON_CLASS = { limiting: "text-signal-high", caution: "text-ink", info: "text-ink-muted" } as const;

function ReasonItem({ reason }: { reason: ConfidenceReason }) {
  const Icon = REASON_ICON[reason.severity];
  return (
    <li className="flex gap-2">
      <Icon size={16} className={`mt-1 shrink-0 ${REASON_CLASS[reason.severity]}`} aria-hidden="true" />
      <span>
        <span className="sr-only">{reason.severity === "limiting" ? "Limits confidence: " : reason.severity === "caution" ? "Caution: " : "Note: "}</span>
        {reason.text}
      </span>
    </li>
  );
}

function Fact({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-ink-muted">{term}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  );
}

function InsetStat({ term, value, note }: { term: string; value: string; note?: string }) {
  return (
    <div className="inset">
      <dt className="label">{term}</dt>
      <dd className="num mt-0.5 font-semibold">{value}</dd>
      {note && <dd className="mt-0.5 text-xs text-ink-muted">{note}</dd>}
    </div>
  );
}

function DetailItem({ term, value }: { term: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-ink-muted">{term}</dt>
      <dd className="mt-0.5 text-ink [overflow-wrap:anywhere]">{value}</dd>
    </div>
  );
}

function normalizeUrl(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}
