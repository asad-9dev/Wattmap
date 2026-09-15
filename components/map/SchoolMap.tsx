"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { Map as MapLibreMap, NavigationControl, Popup, type GeoJSONSource, type MapLayerMouseEvent } from "maplibre-gl";
import { useEffect, useMemo, useRef } from "react";
import { formatEui, formatGhgIntensity, formatPercentile } from "@/lib/format";
import { bandsFor, NO_VALUE_COLOR, type MapMetric } from "./metricScale";

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
};

// OpenFreeMap serves OpenStreetMap vector tiles without an API key; override per deployment.
const STYLE_URL = process.env.NEXT_PUBLIC_MAP_STYLE_URL ?? "https://tiles.openfreemap.org/styles/positron";
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

function colorExpression(metric: MapMetric, points: SchoolPoint[]) {
  const values = points.map((p) => p[metric]).filter((v): v is number => v !== null);
  const [low, mid, high] = bandsFor(metric, values);
  return ["case", ["<", ["get", "value"], 0], NO_VALUE_COLOR, ["step", ["get", "value"], low!.color, mid!.min, mid!.color, high!.min, high!.color]];
}

/** Popup content built with DOM APIs (never innerHTML) because names come from source data. */
function popupContent(p: SchoolPoint): HTMLElement {
  const root = document.createElement("div");
  root.className = "space-y-1 text-[13px] leading-5 text-ink";
  const title = document.createElement("p");
  title.className = "font-semibold";
  title.textContent = p.name;
  const meta = document.createElement("p");
  meta.className = "text-ink-muted";
  meta.textContent = [p.boardName, p.city].filter(Boolean).join(" · ");
  const stats = document.createElement("p");
  stats.textContent = `EUI ${formatEui(p.eui)} · ${p.score !== null ? `Score ${p.score}/100` : "No score"}`;
  const extra = document.createElement("p");
  extra.className = "text-ink-muted";
  extra.textContent = `${formatPercentile(p.percentile)} · ${formatGhgIntensity(p.ghgIntensity)}`;
  const link = document.createElement("a");
  link.href = `/schools/${p.slug}`;
  link.className = "link font-medium";
  link.textContent = "View school →";
  root.append(title, meta, stats, extra, link);
  return root;
}

export function SchoolMap({ points, metric, height = 560 }: { points: SchoolPoint[]; metric: MapMetric; height?: number }) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const latest = useRef({ points, metric });
  latest.current = { points, metric };
  const data = useMemo(() => toGeoJson(points, metric), [points, metric]);

  useEffect(() => {
    if (!container.current) return;
    const map = new MapLibreMap({
      container: container.current,
      style: STYLE_URL,
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
          "circle-color": "#047857",
          "circle-opacity": 0.8,
          "circle-radius": ["step", ["get", "point_count"], 14, 25, 18, 100, 24, 500, 30],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });
      map.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: "schools",
        filter: ["has", "point_count"],
        layout: { "text-field": ["get", "point_count_abbreviated"], "text-size": 12, "text-font": ["Noto Sans Regular"] },
        paint: { "text-color": "#ffffff" },
      });
      map.addLayer({
        id: "schools",
        type: "circle",
        source: "schools",
        filter: ["!", ["has", "point_count"]],
        paint: {
          // @ts-expect-error MapLibre's expression typing does not model runtime-built step expressions.
          "circle-color": colorExpression(currentMetric, current),
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 6, 4, 12, 8],
          "circle-stroke-width": 1,
          "circle-stroke-color": "#ffffff",
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
    });
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    (map.getSource("schools") as GeoJSONSource | undefined)?.setData(data);
    if (map.getLayer("schools")) {
      // @ts-expect-error see above
      map.setPaintProperty("schools", "circle-color", colorExpression(metric, points));
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
