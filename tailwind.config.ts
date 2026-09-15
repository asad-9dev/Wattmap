import type { Config } from "tailwindcss";

/**
 * WattMap design tokens: cool neutral canvas, white panels, green-tinted ink, restrained emerald
 * accent. Contrast on white: ink 16:1, ink-muted 6.5:1, ink-faint 4.8:1, accent 5.5:1, signal-high 5.0:1.
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#f6f7f6",
        paper: "#f6f7f6",
        surface: "#ffffff",
        line: { DEFAULT: "#dce2de", strong: "#c3ccc6" },
        ink: { DEFAULT: "#14201a", muted: "#56615b", faint: "#6b756f" },
        accent: {
          DEFAULT: "#047857",
          strong: "#065f46",
          subtle: "#ecfdf5",
          soft: "#d1fae5",
          line: "#a7f3d0",
        },
        // Benchmark signals, always paired with text: higher than peers / typical / lower.
        signal: { high: "#b45309", mid: "#7c8781", low: "#2f6690", "high-wash": "#fff7ed", "low-wash": "#eff6fb" },
        band: { low: "#2f6690", mid: "#7c8781", high: "#b45309" },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      maxWidth: { page: "80rem" },
      borderRadius: { panel: "10px" },
      boxShadow: { panel: "0 1px 0 rgb(20 32 26 / 0.04)", raised: "0 4px 16px -4px rgb(20 32 26 / 0.12)" },
    },
  },
  plugins: [],
};

export default config;
