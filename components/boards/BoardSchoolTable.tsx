"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { formatEui, formatPercentile, formatSchoolLevel } from "@/lib/format";

export type BoardSchoolRow = {
  slug: string;
  name: string;
  city: string | null;
  level: string | null;
  eui: number | null;
  percentile: number | null;
  score: number | null;
  scoreConfidence: string | null;
};

type SortKey = "name" | "city" | "eui" | "percentile" | "score";
const COLUMNS: { key: SortKey; label: string; numeric: boolean }[] = [
  { key: "name", label: "School", numeric: false },
  { key: "city", label: "City", numeric: false },
  { key: "eui", label: "EUI (GJ/m²)", numeric: true },
  { key: "percentile", label: "Peer percentile", numeric: true },
  { key: "score", label: "Score", numeric: true },
];

const fold = (s: string) => s.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();

/** Client-side filter and sort: a board has at most a few hundred schools. */
export function BoardSchoolTable({ schools, boardName }: { schools: BoardSchoolRow[]; boardName: string }) {
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState("");
  const [reportedOnly, setReportedOnly] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "name", dir: "asc" });

  const rows = useMemo(() => {
    const q = fold(query.trim());
    const filtered = schools.filter(
      (s) => (!q || fold(s.name).includes(q)) && (!level || s.level === level) && (!reportedOnly || s.eui !== null),
    );
    const direction = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      if (av === null && bv === null) return a.name.localeCompare(b.name);
      if (av === null) return 1; // missing values always last
      if (bv === null) return -1;
      return (typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv))) * direction;
    });
  }, [schools, query, level, reportedOnly, sort]);

  function toggleSort(key: SortKey) {
    setSort((current) => (current.key === key ? { key, dir: current.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "name" || key === "city" ? "asc" : "desc" }));
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3 text-sm">
        <label className="block min-w-[12rem] flex-1 space-y-1">
          <span className="font-medium">Filter by school name</span>
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} className="field" placeholder="e.g. Central" />
        </label>
        <label className="block space-y-1">
          <span className="font-medium">School level</span>
          <select value={level} onChange={(e) => setLevel(e.target.value)} className="field cursor-pointer">
            <option value="">Any</option>
            <option value="elementary">Elementary</option>
            <option value="secondary">Secondary</option>
            <option value="combined">Elementary and secondary</option>
          </select>
        </label>
        <label className="flex min-h-[40px] cursor-pointer items-center gap-2">
          <input type="checkbox" checked={reportedOnly} onChange={(e) => setReportedOnly(e.target.checked)} className="h-4 w-4 accent-accent" />
          Only schools with energy data
        </label>
      </div>
      <p className="text-sm text-ink-muted" aria-live="polite">
        Showing <span className="num font-semibold text-ink">{rows.length}</span> of {schools.length} schools
      </p>
      {rows.length === 0 ? (
        <p className="inset text-sm">No schools match these filters. Clear the name filter or choose another level.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-line">
          <table className="table-dense min-w-[40rem]">
            <caption className="sr-only">Schools in {boardName}. Column headers are buttons that sort the table.</caption>
            <thead>
              <tr>
                {COLUMNS.map((column) => {
                  const active = sort.key === column.key;
                  const Icon = active ? (sort.dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
                  return (
                    <th
                      key={column.key}
                      scope="col"
                      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                      className={column.numeric ? "text-right" : undefined}
                    >
                      <button
                        type="button"
                        onClick={() => toggleSort(column.key)}
                        className={`inline-flex cursor-pointer items-center gap-1 rounded font-medium ${active ? "text-ink" : "text-ink-muted hover:text-ink"}`}
                      >
                        {column.label}
                        <Icon size={13} aria-hidden="true" />
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.slug}>
                  <th scope="row" className="font-normal">
                    <Link className="link font-medium" href={`/schools/${s.slug}`}>
                      {s.name}
                    </Link>
                    <span className="block text-xs text-ink-muted">{formatSchoolLevel(s.level)}</span>
                  </th>
                  <td>{s.city ?? "—"}</td>
                  <td className="num text-right">{formatEui(s.eui).replace(" GJ/m²", "")}</td>
                  <td className="num text-right">{formatPercentile(s.percentile)}</td>
                  <td className="num text-right">
                    {s.score ?? "—"}
                    {s.scoreConfidence && <span className="block text-[11px] text-ink-muted">{s.scoreConfidence} confidence</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
