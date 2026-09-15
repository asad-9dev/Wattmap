import { LayoutGrid, List } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PercentileRuler } from "@/components/charts/PercentileRuler";
import { DataUnavailable, PageHeader } from "@/components/ui/primitives";
import { Skeleton } from "@/components/ui/Skeleton";
import { data, load } from "@/lib/data";
import type { SchoolListFilters, SchoolListRow } from "@/lib/db/queries/schools";
import { formatEui, formatNumber, formatPercentile, formatSchoolLevel } from "@/lib/format";
import { firstValues, SchoolListParams } from "@/lib/validation/schools";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Search Ontario schools",
  description: "Filter and sort Ontario schools by board, city, region, school level, energy intensity, and peer percentile.",
};

const PAGE_SIZE = 25;
/** One fixed axis for every row, so rulers are comparable down the table. */
const RULER_MAX_GJ_M2 = 2;
const SORT_LABELS = { name: "School name", eui: "Latest EUI", score: "Opportunity score", percentile: "Peer percentile", year: "Latest reporting year" };

type RawParams = Record<string, string | string[] | undefined>;

export default async function SchoolsPage({ searchParams }: { searchParams: RawParams }) {
  const raw = firstValues(searchParams);
  const params = SchoolListParams.parse(raw);
  const view = raw.view === "grid" ? "grid" : "table";
  const [years, options] = await Promise.all([load(() => data.years()), load(() => data.filterOptions())]);

  if (!years.ok || !options.ok) {
    return (
      <>
        <PageHeader title="Search Ontario schools" />
        <div className="page py-8">
          <DataUnavailable reason={!years.ok ? years.reason : "unavailable"} />
        </div>
      </>
    );
  }

  const year = params.year && years.data.includes(params.year) ? params.year : (years.data.at(-1) ?? new Date().getFullYear());
  const filters: SchoolListFilters = {
    q: params.q,
    board: params.board,
    city: params.city,
    region: params.region,
    level: params.level,
    year,
    scoreMin: params.scoreMin,
    scoreMax: params.scoreMax,
    percentileMin: params.pctMin,
    percentileMax: params.pctMax,
    reportedOnly: params.reported,
    sort: params.sort,
    direction: params.dir,
    page: params.page ?? 1,
    pageSize: PAGE_SIZE,
  };

  return (
    <>
      <PageHeader title="Search Ontario schools">
        Energy metrics for the {year} reporting year. A school without figures has not been confidently matched to a facility in the
        provincial energy reports.
      </PageHeader>
      <div className="page grid gap-6 py-8 lg:grid-cols-[17rem_1fr]">
        <form method="get" className="panel h-fit space-y-4 p-4 text-sm lg:sticky lg:top-20" aria-label="Filter schools">
          {view === "grid" && <input type="hidden" name="view" value="grid" />}
          <Field label="School name" name="q" defaultValue={params.q} />
          <Field label="City" name="city" defaultValue={params.city} />
          <Select label="School board" name="board" value={params.board} options={options.data.boards.map((b) => [b.slug, b.name])} />
          <Select label="Region" name="region" value={params.region} options={options.data.regions.map((r) => [r, r])} />
          <Select label="School level" name="level" value={params.level} options={[["elementary", "Elementary"], ["secondary", "Secondary"], ["combined", "Elementary and secondary"]]} />
          <Select label="Reporting year" name="year" value={String(year)} options={years.data.map((y) => [String(y), String(y)])} includeAny={false} />
          <Range legend="Opportunity score" minName="scoreMin" maxName="scoreMax" min={params.scoreMin} max={params.scoreMax} />
          <Range legend="EUI percentile" minName="pctMin" maxName="pctMax" min={params.pctMin} max={params.pctMax} />
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" name="reported" value="1" defaultChecked={params.reported} className="h-4 w-4 accent-accent" />
            Only schools with energy data
          </label>
          <div className="grid grid-cols-2 gap-2">
            <Select label="Sort by" name="sort" value={params.sort} options={Object.entries(SORT_LABELS)} includeAny={false} />
            <Select label="Order" name="dir" value={params.dir} options={[["asc", "Ascending"], ["desc", "Descending"]]} includeAny={false} />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="submit" className="btn-primary flex-1">
              Apply
            </button>
            <Link href="/schools" className="btn-secondary">
              Reset
            </Link>
          </div>
        </form>

        <Suspense key={JSON.stringify(raw)} fallback={<Skeleton className="h-[36rem]" label="Loading schools" />}>
          <Results filters={filters} view={view} raw={raw} />
        </Suspense>
      </div>
    </>
  );
}

async function Results({ filters, view, raw }: { filters: SchoolListFilters; view: "table" | "grid"; raw: Record<string, string | undefined> }) {
  const result = await load(() => data.schoolList(filters));
  if (!result.ok) return <DataUnavailable reason={result.reason} />;
  const { rows, total } = result.data;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const href = (changes: Record<string, string | undefined>) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...raw, ...changes })) if (value) query.set(key, value);
    return `/schools?${query.toString()}`;
  };

  return (
    <section aria-labelledby="results-title" className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="results-title" className="text-sm text-ink-muted" aria-live="polite">
          <span className="num font-semibold text-ink">{formatNumber(total)}</span> schools, {filters.year} reporting year
        </h2>
        <nav aria-label="Result layout" className="inline-flex rounded-md border border-line bg-surface p-0.5">
          <ViewLink href={href({ view: undefined, page: undefined })} active={view === "table"} label="Table" Icon={List} />
          <ViewLink href={href({ view: "grid", page: undefined })} active={view === "grid"} label="Grid" Icon={LayoutGrid} />
        </nav>
      </div>

      {rows.length === 0 ? (
        <p className="panel p-5 text-sm">No schools match these filters. Try removing a filter or choosing another reporting year.</p>
      ) : view === "table" ? (
        <div className="panel overflow-x-auto">
          <table className="table-dense min-w-[46rem]">
            <caption className="sr-only">Schools matching the filters, {filters.year} reporting year</caption>
            <thead>
              <tr>
                <th scope="col">School</th>
                <th scope="col">City</th>
                <th scope="col" className="text-right">
                  EUI (GJ/m²)
                </th>
                <th scope="col" className="w-44">
                  Against peer range
                </th>
                <th scope="col" className="text-right">
                  Score
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.slug}>
                  <th scope="row" className="font-normal">
                    <Link href={`/schools/${row.slug}`} className="link font-medium">
                      {row.name}
                    </Link>
                    <span className="block text-xs text-ink-muted">{formatSchoolLevel(row.schoolLevel)}</span>
                  </th>
                  <td>
                    {row.city ?? "—"}
                    <span className="block text-xs text-ink-muted">{row.boardName}</span>
                  </td>
                  <td className="num text-right">{row.euiGjM2 != null ? formatNumber(row.euiGjM2, 2) : "—"}</td>
                  <td>
                    <PeerCell row={row} />
                  </td>
                  <td className="num text-right">
                    {row.opportunityScore ?? "—"}
                    {row.scoreConfidence && <span className="block text-[11px] text-ink-muted">{row.scoreConfidence} confidence</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => (
            <li key={row.slug} className="panel flex flex-col gap-2 p-4">
              <Link href={`/schools/${row.slug}`} className="link font-medium">
                {row.name}
              </Link>
              <p className="text-xs leading-5 text-ink-muted">
                {formatSchoolLevel(row.schoolLevel)} in {row.city ?? "an unlisted city"}
                <br />
                {row.boardName}
              </p>
              <div className="mt-auto flex items-end justify-between gap-3 pt-1">
                <div>
                  <p className="label">EUI</p>
                  <p className="num text-lg font-semibold">{formatEui(row.euiGjM2)}</p>
                </div>
                <div className="text-right">
                  <p className="label">Score</p>
                  <p className="num text-lg font-semibold">{row.opportunityScore ?? "—"}</p>
                </div>
              </div>
              <PeerCell row={row} />
            </li>
          ))}
        </ul>
      )}

      <nav aria-label="Pagination" className="flex items-center justify-between gap-2 text-sm">
        {filters.page > 1 ? (
          <Link className="btn-secondary" href={href({ page: String(filters.page - 1) })}>
            Previous page
          </Link>
        ) : (
          <span />
        )}
        <span className="num text-ink-muted">
          Page {filters.page} of {pages}
        </span>
        {filters.page < pages ? (
          <Link className="btn-secondary" href={href({ page: String(filters.page + 1) })}>
            Next page
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </section>
  );
}

function PeerCell({ row }: { row: SchoolListRow }) {
  if (row.euiGjM2 == null || !row.peerCount || row.peerCount < 10) return <span className="text-xs text-ink-muted">No peer benchmark</span>;
  return (
    <div>
      <PercentileRuler size="sm" value={row.euiGjM2} q25={row.peerQ25Eui} median={row.peerMedianEui} q75={row.peerQ75Eui} max={RULER_MAX_GJ_M2} />
      <span className="num block text-[11px] text-ink-muted">{formatPercentile(row.euiPercentile)}</span>
    </div>
  );
}

function ViewLink({ href, active, label, Icon }: { href: string; active: boolean; label: string; Icon: typeof List }) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={`inline-flex min-h-[32px] items-center gap-1.5 rounded px-2.5 text-xs font-medium no-underline ${active ? "bg-accent-subtle text-accent-strong" : "text-ink-muted hover:text-ink"}`}
    >
      <Icon size={14} aria-hidden="true" />
      {label}
    </Link>
  );
}

function Field({ label, name, defaultValue }: { label: string; name: string; defaultValue?: string }) {
  return (
    <label className="block space-y-1">
      <span className="font-medium">{label}</span>
      <input name={name} defaultValue={defaultValue} className="field" />
    </label>
  );
}

function Range({ legend, minName, maxName, min, max }: { legend: string; minName: string; maxName: string; min?: number; max?: number }) {
  return (
    <fieldset className="space-y-1">
      <legend className="font-medium">{legend}</legend>
      <div className="flex items-center gap-2">
        <label className="flex-1">
          <span className="sr-only">Minimum {legend.toLowerCase()}</span>
          <input type="number" inputMode="numeric" min={0} max={100} name={minName} defaultValue={min} placeholder="0" className="field" />
        </label>
        <span className="text-ink-muted" aria-hidden="true">
          to
        </span>
        <label className="flex-1">
          <span className="sr-only">Maximum {legend.toLowerCase()}</span>
          <input type="number" inputMode="numeric" min={0} max={100} name={maxName} defaultValue={max} placeholder="100" className="field" />
        </label>
      </div>
    </fieldset>
  );
}

function Select({ label, name, value, options, includeAny = true }: { label: string; name: string; value?: string; options: [string, string][]; includeAny?: boolean }) {
  return (
    <label className="block space-y-1">
      <span className="font-medium">{label}</span>
      <select name={name} defaultValue={value ?? ""} className="field cursor-pointer">
        {includeAny && <option value="">Any</option>}
        {options.map(([optionValue, text]) => (
          <option key={optionValue} value={optionValue}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}
