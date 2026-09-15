import type { Metadata } from "next";
import { DataUnavailable, MetricCard, PageHeader, Section } from "@/components/ui/primitives";
import { load } from "@/lib/data";
import { getDb } from "@/lib/db";
import { getDataSourceInfo } from "@/lib/db/queries/overview";
import { formatNumber } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Data sources", description: "Source datasets, reporting years, ingestion history, licences, and limitations." };

const SOURCES = [
  {
    name: "Energy use and greenhouse gas emissions for the Broader Public Sector",
    publisher: "Government of Ontario (Ontario Data Catalogue)",
    url: "https://data.ontario.ca/dataset/energy-use-and-greenhouse-gas-emissions-for-the-broader-public-sector",
    use: "Annual energy use, floor area, operating hours, and GHG emissions for every school-board facility, 2011–2023 (English editions).",
  },
  {
    name: "Ontario public school contact information",
    publisher: "Ministry of Education (Ontario Data Catalogue)",
    url: "https://data.ontario.ca/dataset/ontario-public-school-contact-information",
    use: "School and board names, numbers, levels, languages, grades, addresses, and websites.",
  },
  {
    name: "School information and student demographics",
    publisher: "Ministry of Education (Ontario Data Catalogue)",
    url: "https://data.ontario.ca/dataset/school-information-and-student-demographics",
    use: "Latitude and longitude only. No student or achievement data is read or stored.",
  },
];

const STATUS_LABELS: Record<string, string> = { matched: "Matched to a school", ambiguous: "Ambiguous (awaiting review)", unmatched: "Unmatched", rejected: "Reviewed: not a school" };

export default async function DataPage() {
  const result = await load(() => getDataSourceInfo(getDb()));
  const run = result.ok ? result.data.latestRun : null;
  return (
    <>
      <PageHeader eyebrow="Data" title="Data sources">
        WattMap uses only official public data from the Government of Ontario. Records are stored with their source file, reporting year,
        import time, original organization and facility names, and the untouched source row.
      </PageHeader>
      <div className="page space-y-12 py-10">
        <Section id="sources" title="Source datasets">
          <ul className="grid gap-4 md:grid-cols-3">
            {SOURCES.map((s) => (
              <li key={s.name} className="card space-y-2 p-4 text-sm">
                <a href={s.url} className="link font-medium" rel="noopener noreferrer">
                  {s.name}
                </a>
                <p className="text-ink-muted">{s.publisher}</p>
                <p>{s.use}</p>
              </li>
            ))}
          </ul>
        </Section>

        <Section id="coverage" title="Coverage and ingestion">
          {!result.ok ? (
            <DataUnavailable reason={result.reason} />
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <MetricCard label="Reporting years" value={formatNumber(result.data.years.length)} detail={result.data.years.length ? `${result.data.years[0]!.year}–${result.data.years.at(-1)!.year}` : undefined} />
                <MetricCard label="Energy records" value={formatNumber(result.data.years.reduce((s, y) => s + y.records, 0))} detail="Facility-years" />
                <MetricCard
                  label="Records with quality flags"
                  value={formatNumber(result.data.flaggedRecords)}
                  detail={`Kept and shown; ${formatNumber(result.data.implausibleRecords)} implausible values excluded from totals and peers`}
                />
                <MetricCard
                  label="Last successful ingestion"
                  value={run ? new Date(run.startedAt).toISOString().slice(0, 10) : "—"}
                  detail={run ? `${formatNumber(run.accepted)} accepted · ${formatNumber(run.rejected)} rejected` : "No ingestion recorded"}
                />
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <table className="card w-full text-left text-sm">
                  <caption className="px-4 pt-3 text-left font-medium">Records per reporting year</caption>
                  <thead className="text-xs uppercase text-ink-muted">
                    <tr>
                      <th scope="col" className="px-4 py-2">Year</th>
                      <th scope="col" className="px-4 py-2 text-right">Facility records</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.data.years.map((y) => (
                      <tr key={y.year} className="border-t border-line/70">
                        <th scope="row" className="num px-4 py-1.5 font-normal">{y.year}</th>
                        <td className="num px-4 py-1.5 text-right">{formatNumber(y.records)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <table className="card h-fit w-full text-left text-sm">
                  <caption className="px-4 pt-3 text-left font-medium">Facility-to-school matching</caption>
                  <thead className="text-xs uppercase text-ink-muted">
                    <tr>
                      <th scope="col" className="px-4 py-2">Status</th>
                      <th scope="col" className="px-4 py-2 text-right">Facilities</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.data.matchStatus.map((m) => (
                      <tr key={m.status} className="border-t border-line/70">
                        <th scope="row" className="px-4 py-1.5 font-normal">{STATUS_LABELS[m.status] ?? m.status}</th>
                        <td className="num px-4 py-1.5 text-right">{formatNumber(m.facilities)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Section>

        <Section id="licence" title="Licence and attribution">
          <div className="prose-wm text-sm">
            <p>
              Contains information licensed under the{" "}
              <a className="link" href="https://www.ontario.ca/page/open-government-licence-ontario" rel="noopener noreferrer">
                Open Government Licence – Ontario
              </a>
              . Source data © King&apos;s Printer for Ontario. WattMap is an independent project using publicly available data. WattMap is not
              affiliated with or endorsed by the Government of Ontario or any school board.
            </p>
          </div>
        </Section>

        <Section id="limitations" title="Data limitations">
          <ul className="prose-wm list-disc space-y-1 pl-5 text-sm">
            <li>Values are self-reported by school boards and published as received; WattMap flags but does not correct them.</li>
            <li>The 2024 file published so far contains no school-board records.</li>
            <li>Totals for 2011–2020 are derived from the ministry&apos;s published intensity × floor area.</li>
            <li>Weather-normalized values exist only for some facilities from 2021 onward.</li>
            <li>Facilities that could not be confidently matched are counted in provincial and board totals but have no school profile.</li>
          </ul>
        </Section>
      </div>
    </>
  );
}
