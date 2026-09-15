"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { SchoolMapLoader } from "@/components/map/SchoolMapLoader";
import { MAP_METRICS, type MapMetric } from "@/components/map/metricScale";
import type { SchoolPoint } from "@/components/map/SchoolMap";

type State = { status: "loading" } | { status: "error" } | { status: "ready"; points: SchoolPoint[] };

const fold = (s: string) => s.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().trim();

export function MapExplorer({ years, defaultYear }: { years: number[]; defaultYear: number }) {
  const [year, setYear] = useState(defaultYear);
  const [metric, setMetric] = useState<MapMetric>("eui");
  const [level, setLevel] = useState("");
  const [board, setBoard] = useState("");
  const [region, setRegion] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    fetch(`/api/map?year=${year}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((body: { points: SchoolPoint[] }) => !cancelled && setState({ status: "ready", points: body.points }))
      .catch(() => !cancelled && setState({ status: "error" }));
    return () => {
      cancelled = true;
    };
  }, [year]);

  const all = useMemo(() => (state.status === "ready" ? state.points : []), [state]);
  const boards = useMemo(() => [...new Set(all.map((p) => p.boardName))].sort(), [all]);
  const regions = useMemo(() => [...new Set(all.map((p) => (p as SchoolPoint & { region?: string | null }).region).filter(Boolean) as string[])].sort(), [all]);
  const shown = useMemo(
    () =>
      all.filter(
        (p) =>
          (!level || p.level === level) &&
          (!board || p.boardName === board) &&
          (!region || (p as SchoolPoint & { region?: string | null }).region === region) &&
          (!city || fold(p.city ?? "").includes(fold(city))),
      ),
    [all, level, board, region, city],
  );

  const select = "w-full rounded border border-line bg-surface px-2 py-1.5 text-sm";
  return (
    <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
      <form className="card h-fit space-y-3 p-4 text-sm" aria-label="Map filters" onSubmit={(e) => e.preventDefault()}>
        <label className="block space-y-1">
          <span className="font-medium">Colour by</span>
          <select className={select} value={metric} onChange={(e) => setMetric(e.target.value as MapMetric)}>
            {MAP_METRICS.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="font-medium">Reporting year</span>
          <select className={select} value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {years.map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="font-medium">School level</span>
          <select className={select} value={level} onChange={(e) => setLevel(e.target.value)}>
            <option value="">Any</option>
            <option value="elementary">Elementary</option>
            <option value="secondary">Secondary</option>
            <option value="combined">Elementary and secondary</option>
          </select>
        </label>
        <label className="block space-y-1">
          <span className="font-medium">School board</span>
          <select className={select} value={board} onChange={(e) => setBoard(e.target.value)}>
            <option value="">Any</option>
            {boards.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="font-medium">Region</span>
          <select className={select} value={region} onChange={(e) => setRegion(e.target.value)}>
            <option value="">Any</option>
            {regions.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="font-medium">City</span>
          <input className={select} value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Ajax" />
        </label>
        <p className="text-xs text-ink-muted" aria-live="polite">
          {state.status === "ready" ? `${shown.length.toLocaleString("en-CA")} schools shown` : state.status === "loading" ? "Loading schools…" : ""}
        </p>
        <Link href="/schools?reported=1" className="link block text-xs">
          Prefer a list? Browse schools as a table
        </Link>
      </form>
      <div className="min-w-0">
        {state.status === "error" ? (
          <p className="card p-4 text-sm">Map data is temporarily unavailable. Please try again shortly.</p>
        ) : (
          <SchoolMapLoader points={shown} metric={metric} height={600} />
        )}
      </div>
    </div>
  );
}
