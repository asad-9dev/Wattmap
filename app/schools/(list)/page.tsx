import type { Metadata } from "next";
import Link from "next/link";
import { DataUnavailable, PageHeader } from "@/components/ui/primitives";
import { data, load } from "@/lib/data";
import type { SchoolListFilters } from "@/lib/db/queries/schools";
import { formatEui, formatPercentile, formatSchoolLevel } from "@/lib/format";
import { firstValues, SchoolListParams } from "@/lib/validation/schools";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Search Ontario schools",
  description: "Filter and sort Ontario schools by board, city, region, school level, energy intensity, and peer percentile.",
};

const PAGE_SIZE = 25;
const SORT_LABELS = { name: "School name", eui: "Latest EUI", score: "Opportunity score", percentile: "Peer percentile", year: "Latest reporting year" };

export default async function SchoolsPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const params = SchoolListParams.parse(firstValues(searchParams));
  const [years, options] = await Promise.all([load(() => data.years()), load(() => data.filterOptions())]);
  if (!years.ok || !options.ok) {
    return (
      <>
        <PageHeader eyebrow="Schools" title="Search Ontario schools" />
        <div className="page py-10">
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
  const result = await load(() => data.schoolList(filters));
  const pages = result.ok ? Math.max(1, Math.ceil(result.data.total / PAGE_SIZE)) : 1;

  const hrefFor = (page: number) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(firstValues(searchParams))) if (value && key !== "page") query.set(key, value);
    query.set("page", String(page));
    return `/schools?${query.toString()}`;
  };

  return (
    <>
      <PageHeader eyebrow="Schools" title="Search Ontario schools">
        Energy metrics are shown for the {year} reporting year. A school with no figures has not been confidently matched to a
        facility in the provincial energy reports.
      </PageHeader>
      <div className="page grid gap-8 py-8 lg:grid-cols-[18rem_1fr]">
        <form method="get" className="card h-fit space-y-4 p-4 text-sm" aria-label="Filter schools">
          <Field label="School name" name="q" defaultValue={params.q} />
          <Field label="City" name="city" defaultValue={params.city} />
          <Select label="School board" name="board" value={params.board} options={options.data.boards.map((b) => [b.slug, b.name])} />
          <Select label="Region" name="region" value={params.region} options={options.data.regions.map((r) => [r, r])} />
          <Select label="School level" name="level" value={params.level} options={[["elementary", "Elementary"], ["secondary", "Secondary"], ["combined", "Elementary and secondary"]]} />
          <Select label="Reporting year" name="year" value={String(year)} options={years.data.map((y) => [String(y), String(y)])} includeAny={false} />
          <fieldset className="space-y-1">
            <legend className="font-medium">Opportunity score</legend>
            <div className="flex gap-2">
              <NumberInput label="Minimum score" name="scoreMin" value={params.scoreMin} />
              <NumberInput label="Maximum score" name="scoreMax" value={params.scoreMax} />
            </div>
          </fieldset>
          <fieldset className="space-y-1">
            <legend className="font-medium">EUI percentile</legend>
            <div className="flex gap-2">
              <NumberInput label="Minimum percentile" name="pctMin" value={params.pctMin} />
              <NumberInput label="Maximum percentile" name="pctMax" value={params.pctMax} />
            </div>
          </fieldset>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="reported" value="1" defaultChecked={params.reported} className="accent-accent" />
            Only schools with energy data
          </label>
          <Select label="Sort by" name="sort" value={params.sort} options={Object.entries(SORT_LABELS)} includeAny={false} />
          <Select label="Order" name="dir" value={params.dir} options={[["asc", "Ascending"], ["desc", "Descending"]]} includeAny={false} />
          <div className="flex gap-2">
            <button type="submit" className="rounded-md bg-accent px-4 py-2 font-medium text-white hover:bg-accent-strong">
              Apply
            </button>
            <Link href="/schools" className="rounded-md border border-line px-4 py-2 text-ink no-underline">
              Reset
            </Link>
          </div>
        </form>

        <section aria-labelledby="results-title" className="min-w-0 space-y-4">
          {!result.ok ? (
            <DataUnavailable reason={result.reason} />
          ) : (
            <>
              <h2 id="results-title" className="text-sm text-ink-muted" aria-live="polite">
                {result.data.total.toLocaleString("en-CA")} schools
              </h2>
              {result.data.rows.length === 0 ? (
                <p className="card p-4 text-sm">No schools match these filters.</p>
              ) : (
                <div className="card overflow-x-auto">
                  <table className="w-full min-w-[40rem] text-left text-sm">
                    <caption className="sr-only">Schools matching the filters, {year} reporting year</caption>
                    <thead className="border-b border-line bg-paper text-xs uppercase tracking-wide text-ink-muted">
                      <tr>
                        <th scope="col" className="px-4 py-2">School</th>
                        <th scope="col" className="px-4 py-2">City</th>
                        <th scope="col" className="px-4 py-2 text-right">EUI</th>
                        <th scope="col" className="px-4 py-2 text-right">Peer percentile</th>
                        <th scope="col" className="px-4 py-2 text-right">Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.data.rows.map((row) => (
                        <tr key={row.slug} className="border-b border-line/70 last:border-0">
                          <th scope="row" className="px-4 py-2.5 font-normal">
                            <Link href={`/schools/${row.slug}`} className="link font-medium">
                              {row.name}
                            </Link>
                            <span className="block text-xs text-ink-muted">
                              {row.boardName} · {formatSchoolLevel(row.schoolLevel)}
                            </span>
                          </th>
                          <td className="px-4 py-2.5">{row.city ?? "—"}</td>
                          <td className="num px-4 py-2.5 text-right">{formatEui(row.euiGjM2)}</td>
                          <td className="num px-4 py-2.5 text-right">{row.peerCount && row.peerCount >= 10 ? formatPercentile(row.euiPercentile) : "—"}</td>
                          <td className="num px-4 py-2.5 text-right">
                            {row.opportunityScore ?? "—"}
                            {row.scoreConfidence && <span className="block text-[11px] text-ink-muted">{row.scoreConfidence} confidence</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <nav aria-label="Pagination" className="flex items-center justify-between text-sm">
                {filters.page > 1 ? (
                  <Link className="link" href={hrefFor(filters.page - 1)}>
                    ← Previous
                  </Link>
                ) : (
                  <span />
                )}
                <span className="text-ink-muted">
                  Page {filters.page} of {pages}
                </span>
                {filters.page < pages ? (
                  <Link className="link" href={hrefFor(filters.page + 1)}>
                    Next →
                  </Link>
                ) : (
                  <span />
                )}
              </nav>
            </>
          )}
        </section>
      </div>
    </>
  );
}

function Field({ label, name, defaultValue }: { label: string; name: string; defaultValue?: string }) {
  return (
    <label className="block space-y-1">
      <span className="font-medium">{label}</span>
      <input name={name} defaultValue={defaultValue} className="w-full rounded border border-line px-2 py-1.5" />
    </label>
  );
}

function NumberInput({ label, name, value }: { label: string; name: string; value?: number }) {
  return (
    <label className="block flex-1">
      <span className="sr-only">{label}</span>
      <input type="number" min={0} max={100} name={name} defaultValue={value} placeholder={label.startsWith("Min") ? "Min" : "Max"} className="w-full rounded border border-line px-2 py-1.5" />
    </label>
  );
}

function Select({ label, name, value, options, includeAny = true }: { label: string; name: string; value?: string; options: [string, string][]; includeAny?: boolean }) {
  return (
    <label className="block space-y-1">
      <span className="font-medium">{label}</span>
      <select name={name} defaultValue={value ?? ""} className="w-full rounded border border-line bg-white px-2 py-1.5">
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
