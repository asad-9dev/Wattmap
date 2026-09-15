"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { parsePreference, resolveTheme, THEME_STORAGE_KEY, type ThemePreference } from "@/lib/theme";

const OPTIONS = [
  { value: "light", label: "Light theme", Icon: Sun },
  { value: "dark", label: "Dark theme", Icon: Moon },
  { value: "system", label: "Match system theme", Icon: Monitor },
] as const;

function applyTheme(preference: ThemePreference) {
  const dark = resolveTheme(preference, window.matchMedia("(prefers-color-scheme: dark)").matches) === "dark";
  const root = document.documentElement;
  root.classList.toggle("dark", dark);
  root.style.colorScheme = dark ? "dark" : "light";
}

/** Light / dark / system switch. A radio group: arrow keys move between options. */
export function ThemeToggle() {
  const [preference, setPreference] = useState<ThemePreference>("system");
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    try {
      setPreference(parsePreference(localStorage.getItem(THEME_STORAGE_KEY)));
    } catch {
      // Storage unavailable (private mode): stay on the system theme.
    }
  }, []);

  useEffect(() => {
    if (preference !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const follow = () => applyTheme("system");
    media.addEventListener("change", follow);
    return () => media.removeEventListener("change", follow);
  }, [preference]);

  function choose(next: ThemePreference) {
    setPreference(next);
    try {
      if (next === "system") localStorage.removeItem(THEME_STORAGE_KEY);
      else localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // The choice still applies for this visit.
    }
    applyTheme(next);
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const next = (index + (event.key === "ArrowRight" ? 1 : OPTIONS.length - 1)) % OPTIONS.length;
    choose(OPTIONS[next]!.value);
    buttons.current[next]?.focus();
  }

  return (
    <div role="radiogroup" aria-label="Colour theme" className="inline-flex rounded-md border border-line bg-surface p-0.5">
      {OPTIONS.map(({ value, label, Icon }, index) => {
        const selected = preference === value;
        return (
          <button
            key={value}
            ref={(el) => {
              buttons.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={label}
            title={label}
            tabIndex={selected ? 0 : -1}
            onClick={() => choose(value)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={`inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded transition-colors duration-150 ${
              selected ? "bg-accent-subtle text-accent-strong" : "text-ink-muted hover:text-ink"
            }`}
          >
            <Icon size={15} aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
