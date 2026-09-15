"use client";

import { useEffect, useState } from "react";
import type { ResolvedTheme } from "@/lib/theme";

/** The theme currently applied to <html>, updated whenever the toggle or the OS changes it. */
export function useResolvedTheme(): ResolvedTheme {
  const [theme, setTheme] = useState<ResolvedTheme>("light");
  useEffect(() => {
    const root = document.documentElement;
    const read = () => setTheme(root.classList.contains("dark") ? "dark" : "light");
    read();
    const observer = new MutationObserver(read);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  return theme;
}

export type ChartColors = {
  accent: string;
  accentContrast: string;
  bar: string;
  ink: string;
  muted: string;
  grid: string;
  band: string;
  surface: string;
  lineStrong: string;
  signalHigh: string;
  signalMid: string;
  signalLow: string;
  cursor: string;
};

// Light values, used until the browser has computed styles (and for server rendering).
const LIGHT: ChartColors = {
  accent: "rgb(4 120 87)",
  accentContrast: "rgb(255 255 255)",
  bar: "rgb(5 150 105)",
  ink: "rgb(20 32 26)",
  muted: "rgb(86 97 91)",
  grid: "rgb(220 226 222)",
  band: "rgb(209 250 229)",
  surface: "rgb(255 255 255)",
  lineStrong: "rgb(195 204 198)",
  signalHigh: "rgb(180 83 9)",
  signalMid: "rgb(124 135 129)",
  signalLow: "rgb(47 102 144)",
  cursor: "rgb(4 120 87 / 0.06)",
};

/** Reads the theme's CSS colour tokens so canvas/SVG libraries (Recharts, MapLibre) match the page. */
export function readThemeColors(): ChartColors {
  if (typeof window === "undefined") return LIGHT;
  const styles = getComputedStyle(document.documentElement);
  const token = (name: string) => styles.getPropertyValue(`--c-${name}`).trim();
  const rgb = (name: string, alpha?: number) => (token(name) ? `rgb(${token(name)}${alpha !== undefined ? ` / ${alpha}` : ""})` : null);
  return {
    accent: rgb("accent") ?? LIGHT.accent,
    accentContrast: rgb("accent-contrast") ?? LIGHT.accentContrast,
    bar: rgb("chart-bar") ?? LIGHT.bar,
    ink: rgb("ink") ?? LIGHT.ink,
    muted: rgb("ink-muted") ?? LIGHT.muted,
    grid: rgb("line") ?? LIGHT.grid,
    band: rgb("accent-soft") ?? LIGHT.band,
    surface: rgb("surface") ?? LIGHT.surface,
    lineStrong: rgb("line-strong") ?? LIGHT.lineStrong,
    signalHigh: rgb("signal-high") ?? LIGHT.signalHigh,
    signalMid: rgb("signal-mid") ?? LIGHT.signalMid,
    signalLow: rgb("signal-low") ?? LIGHT.signalLow,
    cursor: rgb("accent", 0.08) ?? LIGHT.cursor,
  };
}

export function useChartColors(): ChartColors {
  const theme = useResolvedTheme();
  const [colors, setColors] = useState<ChartColors>(LIGHT);
  useEffect(() => setColors(readThemeColors()), [theme]);
  return colors;
}

/** Shared Recharts tooltip styling so tooltips follow the theme. */
export function tooltipStyles(colors: ChartColors) {
  return {
    contentStyle: { backgroundColor: colors.surface, border: `1px solid ${colors.grid}`, borderRadius: 6, color: colors.ink, fontSize: 13 },
    labelStyle: { color: colors.ink, fontWeight: 600 },
    itemStyle: { color: colors.ink },
  };
}
