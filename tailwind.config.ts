import type { Config } from "tailwindcss";

/**
 * WattMap design tokens. Every colour is a CSS variable (app/globals.css) so light and dark
 * themes swap the whole palette at once; classes like `bg-accent/40` keep working through
 * <alpha-value>. Contrast targets (WCAG AA) are documented next to the variables.
 */
const token = (name: string) => `rgb(var(--c-${name}) / <alpha-value>)`;

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        canvas: token("canvas"),
        paper: token("canvas"),
        surface: token("surface"),
        line: { DEFAULT: token("line"), strong: token("line-strong") },
        ink: { DEFAULT: token("ink"), muted: token("ink-muted"), faint: token("ink-faint") },
        accent: {
          DEFAULT: token("accent"),
          strong: token("accent-strong"),
          subtle: token("accent-subtle"),
          soft: token("accent-soft"),
          line: token("accent-line"),
          /** Text placed on an accent-filled background. */
          contrast: token("accent-contrast"),
        },
        // Benchmark signals, always paired with text: higher than peers / typical / lower.
        signal: {
          high: token("signal-high"),
          mid: token("signal-mid"),
          low: token("signal-low"),
          "high-wash": token("signal-high-wash"),
          "low-wash": token("signal-low-wash"),
        },
        band: { low: token("signal-low"), mid: token("signal-mid"), high: token("signal-high") },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      maxWidth: { page: "80rem" },
      borderRadius: { panel: "10px" },
      boxShadow: {
        panel: "0 1px 0 rgb(var(--c-shadow) / 0.05)",
        raised: "0 4px 16px -4px rgb(var(--c-shadow) / 0.18)",
      },
    },
  },
  plugins: [],
};

export default config;
