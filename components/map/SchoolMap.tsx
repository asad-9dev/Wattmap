"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { Map as MapLibreMap, NavigationControl, Popup, setWorkerUrl, type GeoJSONSource, type MapLayerMouseEvent } from "maplibre-gl";
import { useEffect, useMemo, useRef } from "react";
import { readThemeColors, type ChartColors } from "@/components/theme/useTheme";
import { formatEui, formatGhgIntensity, formatPercentile } from "@/lib/format";
import type { ResolvedTheme } from "@/lib/theme";
import { bandsFor, type MapMetric } from "./metricScale";

export type SchoolPoint = {
  slug: string;
  name: string;
  city: string | null;
  boardName: string;
  lat: number;
  lon: number;
  eui: number | null;
  percentile: number | null;
  score: number | null;
  ghgIntensity: number | null;
  level?: string | null;
  region?: string | null;
};

// MapLibre decodes tiles in a module worker that the Next.js bundle does not include; without
// this, the map loads its style but never draws tiles or markers. The files are copied to
// public/maplibre/ before every dev/build run (scripts/copy-maplibre-worker.mjs).
setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

// OpenFreeMap serves OpenStreetMap vector tiles without an API key; override per deployment.
const STYLE_URLS: Record<ResolvedTheme, string> = {
  light: process.env.NEXT_PUBLIC_MAP_STYLE_URL ?? "https://tiles.openfreemap.org/styles/positron",
  dark: process.env.NEXT_PUBLIC_MAP_STYLE_URL_DARK ?? "https://tiles.openfreemap.org/styles/dark",
};
const ONTARIO_CENTER: [number, number] = [-80.5, 45.5];

function toGeoJson(points: SchoolPoint[], metric: MapMetric): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: points.map((p) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [p.lon, p.lat] },
      properties: { ...p, value: p[metric] ?? -1 },
    })),
  };
}

function colorExpression(metric: MapMetric, points: SchoolPoint[], colors: ChartColors) {
  const values = points.map((p) => p[metric]).filter((v): v is number => v !== null);
  const [, mid, high] = bandsFor(metric, values);
  return [
    "case",
    ["<", ["get", "value"], 0],
    colors.lineStrong,
    ["step", ["get", "value"], colors.signalLow, mid!.min, colors.signalMid, high!.min, colors.signalHigh],
  ];
}

/** Popup content built with DOM APIs (never innerHTML) because names come from source data. */
function popupContent(p: SchoolPoint): HTMLElement {
  const root = document.createElement("div");
  root.className = "space-y-1 text-[13px] leading-5";
  const title = document.createElement("p");
  title.className = "font-semibold";
  title.textContent = p.name;
  const meta = document.createElement("p");
  meta.className = "text-ink-muted";
  meta.textContent = p.city ? `${p.boardName}, ${p.city}` : p.boardName;
  const stats = document.createElement("p");
  stats.textContent = `EUI ${formatEui(p.eui)}. ${p.score !== null ? `Score ${p.score} of 100.` : "No score."}`;
  const extra = document.createElement("p");
  extra.className = "text-ink-muted";
  extra.textContent = `${formatPercentile(p.percentile)}; ${formatGhgIntensity(p.ghgIntensity)}`;
  const link = document.createElement("a");
  link.href = `/schools/${p.slug}`;
  link.className = "link font-medium";
  link.textContent = `View ${p.name}`;
  root.append(title, meta, stats, extra, link);
  return root;
}

export function SchoolMap({ points, metric, height = 560, theme }: { points: SchoolPoint[]; metric: MapMetric; height?: number; theme: ResolvedTheme }) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const colorsRef = useRef<ChartColors | null>(null);
  const latest = useRef({ points, metric });
  latest.current = { points, metric };
  const data = useMemo(() => toGeoJson(points, metric), [points, metric]);

  useEffect(() => {
    if (!container.current) return;
    const colors = readThemeColors();
    colorsRef.current = colors;
    const map = new MapLibreMap({
      container: container.current,
      style: STYLE_URLS[theme],
      center: ONTARIO_CENTER,
      zoom: 4.6,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    map.addControl(new NavigationControl({ showCompass: false }), "top-right");

    map.on("load", () => {
      const { points: current, metric: currentMetric } = latest.current;
      map.addSource("schools", { type: "geojson", data: toGeoJson(current, currentMetric), cluster: true, clusterMaxZoom: 9, clusterRadius: 42 });
      map.addLayer({
        id: "clusters",
        type: "circle",
        source: "schools",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": colors.accent,
          "circle-opacity": 0.85,
          "circle-radius": ["step", ["get", "point_count"], 14, 25, 18, 100, 24, 500, 30],
          "circle-stroke-width": 2,
          "circle-stroke-color": colors.surface,
        },
      });
      map.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: "schools",
        filter: ["has", "point_count"],
        layout: { "text-field": ["get", "point_count_abbreviated"], "text-size": 12, "text-font": ["Noto Sans Regular"] },
        paint: { "text-color": colors.accentContrast },
      });
      map.addLayer({
        id: "schools",
        type: "circle",
        source: "schools",
        filter: ["!", ["has", "point_count"]],
        paint: {
          // @ts-expect-error MapLibre's expression typing does not model runtime-built step expressions.
          "circle-color": colorExpression(currentMetric, current, colors),
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 6, 4, 12, 8],
          "circle-stroke-width": 1,
          "circle-stroke-color": colors.surface,
        },
      });

      map.on("click", "clusters", async (event: MapLayerMouseEvent) => {
        const feature = event.features?.[0];
        const source = map.getSource("schools") as GeoJSONSource | undefined;
        if (!feature || !source || feature.geometry.type !== "Point") return;
        const zoom = await source.getClusterExpansionZoom(feature.properties.cluster_id as number);
        map.easeTo({ center: feature.geometry.coordinates as [number, number], zoom });
      });
      map.on("click", "schools", (event: MapLayerMouseEvent) => {
        const feature = event.features?.[0];
        if (!feature || feature.geometry.type !== "Point") return;
        const props = feature.properties as Record<string, unknown>;
        const point = latest.current.points.find((p) => p.slug === props.slug);
        if (!point) return;
        new Popup({ closeButton: true, maxWidth: "260px" })
          .setLngLat(feature.geometry.coordinates as [number, number])
          .setDOMContent(popupContent(point))
          .addTo(map);
      });
      for (const layer of ["clusters", "schools"]) {
        map.on("mouseenter", layer, () => (map.getCanvas().style.cursor = "pointer"));
        map.on("mouseleave", layer, () => (map.getCanvas().style.cursor = ""));
      }
      // "idle" fires once tiles and markers have actually rendered, which needs a working worker.
      map.once("idle", () => {
        if (container.current) container.current.dataset.mapState = "ready";
      });
    });
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [theme]);

  useEffect(() => {
    const map = mapRef.current;
    const colors = colorsRef.current;
    if (!map || !colors || !map.isStyleLoaded()) return;
    (map.getSource("schools") as GeoJSONSource | undefined)?.setData(data);
    if (map.getLayer("schools")) {
      // @ts-expect-error see above
      map.setPaintProperty("schools", "circle-color", colorExpression(metric, points, colors));
    }
  }, [data, metric, points]);

  return (
    <div
      ref={container}
      style={{ height }}
      className="w-full overflow-hidden rounded-md border border-line"
      role="region"
      aria-label={`Map of ${points.length} schools. Use the school list for a text alternative.`}
    />
  );
}
