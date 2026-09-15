/** Colour-theme preference: an explicit choice, or follow the operating system. */
export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "wattmap-theme";

export function resolveTheme(preference: string | null | undefined, systemPrefersDark: boolean): ResolvedTheme {
  if (preference === "light" || preference === "dark") return preference;
  return systemPrefersDark ? "dark" : "light";
}

export function parsePreference(stored: string | null | undefined): ThemePreference {
  return stored === "light" || stored === "dark" ? stored : "system";
}

/**
 * Inlined in <head> so the correct theme is applied before first paint (no flash of the wrong
 * theme). It mirrors resolveTheme() because it must run before any bundle loads.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var p=localStorage.getItem("${THEME_STORAGE_KEY}");var d=p==="dark"||(p!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;r.classList.toggle("dark",d);r.style.colorScheme=d?"dark":"light";}catch(e){}})();`;
