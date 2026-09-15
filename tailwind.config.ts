import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#fafaf8",
        line: "#e4e4e0",
        ink: {
          DEFAULT: "#1c1f23",
          muted: "#565d66",
          faint: "#7b828c",
        },
        accent: {
          DEFAULT: "#0f766e",
          strong: "#115e59",
          subtle: "#e6f4f1",
        },
        // Score/percentile bands. Always paired with a text label, never colour alone.
        band: {
          low: "#2f6f9f",
          mid: "#8a8f98",
          high: "#b45309",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      maxWidth: {
        page: "72rem",
      },
    },
  },
  plugins: [],
};

export default config;
