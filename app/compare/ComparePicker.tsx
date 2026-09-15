"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { SearchResults } from "@/lib/search";

export function ComparePicker({ current }: { current: string[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<SearchResults["school"]>([]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setOptions([]);
      return;
    }
    const timer = setTimeout(async () => {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`).catch(() => null);
      if (response?.ok) setOptions(((await response.json()) as SearchResults).school);
    }, 150);
    return () => clearTimeout(timer);
  }, [query]);

  if (current.length >= 4) return <p className="text-sm text-ink-muted">Up to four schools can be compared. Remove one to add another.</p>;

  return (
    <div className="max-w-xl space-y-2">
      <label htmlFor="compare-search" className="text-sm font-medium">
        Add a school
      </label>
      <input
        id="compare-search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Type a school name…"
        className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm"
        autoComplete="off"
      />
      {options.length > 0 && (
        <ul className="card divide-y divide-line text-sm">
          {options.map((option) => {
            const slug = option.href.replace("/schools/", "");
            const added = current.includes(slug);
            return (
              <li key={option.href}>
                <button
                  type="button"
                  disabled={added}
                  onClick={() => {
                    setQuery("");
                    router.push(`/compare?schools=${[...current, slug].join(",")}`);
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-paper disabled:text-ink-faint"
                >
                  {option.label}
                  {option.sublabel && <span className="block text-xs text-ink-muted">{option.sublabel}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
