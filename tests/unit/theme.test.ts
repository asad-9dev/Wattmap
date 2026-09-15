import { describe, expect, it } from "vitest";
import { parsePreference, resolveTheme, THEME_INIT_SCRIPT, THEME_STORAGE_KEY } from "../../lib/theme";

describe("resolveTheme", () => {
  it("honours an explicit choice over the system setting", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });
  it("follows the system otherwise, including unknown values", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme(null, false)).toBe("light");
    expect(resolveTheme("purple", true)).toBe("dark");
  });
});

describe("parsePreference", () => {
  it("accepts only light or dark as stored choices", () => {
    expect(parsePreference("dark")).toBe("dark");
    expect(parsePreference("light")).toBe("light");
    expect(parsePreference(null)).toBe("system");
    expect(parsePreference("<script>")).toBe("system");
  });
});

describe("THEME_INIT_SCRIPT", () => {
  function run(stored: string | null, systemDark: boolean) {
    const classes = new Set<string>();
    const root = {
      classList: { toggle: (name: string, on: boolean) => (on ? classes.add(name) : classes.delete(name)) },
      style: {} as Record<string, string>,
    };
    const script = new Function("localStorage", "window", "document", THEME_INIT_SCRIPT);
    script({ getItem: (key: string) => (key === THEME_STORAGE_KEY ? stored : null) }, { matchMedia: () => ({ matches: systemDark }) }, { documentElement: root });
    return { dark: classes.has("dark"), colorScheme: root.style.colorScheme };
  }
  it("applies the same rule as resolveTheme before first paint", () => {
    expect(run("dark", false)).toEqual({ dark: true, colorScheme: "dark" });
    expect(run("light", true)).toEqual({ dark: false, colorScheme: "light" });
    expect(run(null, true)).toEqual({ dark: true, colorScheme: "dark" });
    expect(run(null, false)).toEqual({ dark: false, colorScheme: "light" });
  });
});
