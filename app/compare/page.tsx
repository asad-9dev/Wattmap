import type { Metadata } from "next";
import Link from "next/link";
import { CompareChart } from "@/components/charts/CompareChart";
import { DataUnavailable, PageHeader } from "@/components/ui/primitives";
import { data, load } from "@/lib/data";
import { formatArea, formatEui, formatGhgIntensity, formatGj, formatPercentile, formatSchoolLevel, formatSignedPercent } from "@/lib/format";
import { buildProfileView } from "@/lib/profile";
import { ComparePicker } from "./ComparePicker";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Compare schools", description: "Compare the energy intensity, trends, and peer benchmarks of up to four Ontario schools." };

export default async function ComparePage({ searchParams }: { searchParams: { schools?: string } }) {
  const slugs = [...new Set((searchParams.schools ?? "").split(",").map((s) => s.trim()).filter((s) => /^[a-z0-9-]{1,200}$/.test(s)))].slice(0, 4);
  const result = slugs.length ? await load(() => data.compare(slugs)) : null;
  const profiles = result?.ok ? result.data : [];
  const views = profiles.map((p) => ({ profile: p, view: buildProfileView(p) }));
  const without = (slug: string) => {
    const rest = slugs.filter((s) => s !== slug);
    return rest.length ? `/compare?schools=${rest.join(",")}` : "/compare";
  };

  const rows: { label: string; values: string[] }[] = [
    { label: "School level", values: views.map(({ profile }) => formatSchoolLevel(profile.school.schoolLevel)) },
    { label: "Latest reporting year", values: views.map(({ view }) => String(view.latestYear?.year ?? "—")) },
    { label: "Energy Use Intensity", values: views.map(({ view }) => formatEui(view.latestYear?.eui)) },
    { label: "GHG intensity", values: views.map(({ view }) => formatGhgIntensity(view.latestYear?.ghgIntensity)) },
    { label: "Peer percentile (EUI)", values: views.map(({ view }) => (view.metric && view.metric.peerCount >= 10 ? formatPercentile(view.metric.euiPercentile) : "—")) },
    { label: "Opportunity score", values: views.map(({ view }) => (view.metric?.opportunityScore != null ? `${view.metric.opportunityScore} (${view.metric.scoreConfidence})` : "—")) },
    { label: "5-year trend", values: views.map(({ view }) => (view.trend5 ? `${formatSignedPercent(view.trend5.annualChangePct)}/yr` : "—")) },
    { label: "Total site energy", values: views.map(({ view }) => formatGj(view.latestYear?.totalSiteEnergyGj)) },
    { label: "Floor area", values: views.map(({ view }) => formatArea(view.latestYear?.floorAreaM2)) },
    { label: "Data confidence", values: views.map(({ view }) => (view.hasEnergyData ? view.confidence.level : "No energy data")) },
  ];

  return (
    <>
      <PageHeader eyebrow="Compare" title="Compare schools">
        Absolute energy use depends heavily on building size, so compare intensity metrics (per m²) first. Total energy is shown for
        context only.
      </PageHeader>
      <div className="page space-y-8 py-8">
        <ComparePicker current={profiles.map((p) => p.school.slug)} />
        {result && !result.ok && <DataUnavailable reason={result.reason} />}
        {views.length === 0 ? (
          <p className="text-sm text-ink-muted">Add two to four schools to compare them side by side.</p>
        ) : (
          <>
            <div className="card overflow-x-auto">
              <table className="w-full min-w-[36rem] text-left text-sm">
                <caption className="sr-only">Comparison of selected schools</caption>
                <thead className="border-b border-line bg-paper">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-xs uppercase tracking-wide text-ink-muted">
                      Metric
                    </th>
                    {views.map(({ profile }) => (
                      <th key={profile.school.slug} scope="col" className="px-4 py-3 align-top">
                        <Link href={`/schools/${profile.school.slug}`} className="link font-medium">
                          {profile.school.name}
                        </Link>
                        <span className="block text-xs font-normal text-ink-muted">{profile.school.boardName}</span>
                        <Link href={without(profile.school.slug)} className="mt-1 inline-block text-xs text-ink-muted underline" aria-label={`Remove ${profile.school.name}`}>
                          Remove
                        </Link>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.label} className="border-b border-line/70 last:border-0">
                      <th scope="row" className="px-4 py-2 font-medium">
                        {row.label}
                      </th>
                      {row.values.map((value, i) => (
                        <td key={i} className="num px-4 py-2">
                          {value}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <section aria-labelledby="compare-trend" className="card space-y-3 p-4">
              <h2 id="compare-trend" className="font-semibold">
                Energy intensity over time
              </h2>
              <CompareChart schools={views.map(({ profile }) => ({ name: profile.school.name, points: profile.series.map((s) => ({ year: s.year, eui: s.eui })) }))} />
              <p className="text-sm text-ink-muted">Gaps are years without a report. 2020–2021 were pandemic-affected for every school.</p>
            </section>
          </>
        )}
      </div>
    </>
  );
}
