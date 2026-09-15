"use client";

import { Building2, MapPin, School, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { SearchResults } from "@/lib/search";

const GROUPS = [
  { kind: "school", heading: "Schools", Icon: School },
  { kind: "city", heading: "Cities", Icon: MapPin },
  { kind: "board", heading: "School boards", Icon: Building2 },
] as const;

type Option = { href: string; label: string; sublabel: string | null; kind: (typeof GROUPS)[number]["kind"] };

export function SearchBox({ size = "large", autoFocus = false }: { size?: "large" | "compact"; autoFocus?: boolean }) {
  const router = useRouter();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [active, setActive] = useState(-1);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const request = useRef(0);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults(null);
      return;
    }
    const id = ++request.current;
    setStatus("loading");
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`);
        if (!response.ok) throw new Error(String(response.status));
        const body = (await response.json()) as SearchResults;
        if (id === request.current) {
          setResults(body);
          setActive(-1);
          setStatus("idle");
        }
      } catch {
        if (id === request.current) setStatus("error");
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [query]);

  const options: Option[] = useMemo(
    () => (results ? GROUPS.flatMap((g) => results[g.kind].map((r) => ({ ...r, kind: g.kind }))) : []),
    [results],
  );

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(options.length - 1, i + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.max(-1, i - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const chosen = options[active];
      if (chosen) go(chosen.href);
      else if (query.trim()) go(`/schools?q=${encodeURIComponent(query.trim())}`);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  const showList = open && query.trim().length >= 2;
  const large = size === "large";

  return (
    <div className="relative w-full">
      <label htmlFor={`${listId}-input`} className="sr-only">
        Search a school, city, or school board
      </label>
      <div className={`flex items-center gap-2 rounded-md border border-line bg-surface ${large ? "px-4 py-3" : "px-3 py-2"} focus-within:border-accent`}>
        <Search size={large ? 20 : 16} className="shrink-0 text-ink-faint" aria-hidden="true" />
        <input
          id={`${listId}-input`}
          type="search"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          autoComplete="off"
          autoFocus={autoFocus}
          value={query}
          placeholder="Search a school, city, or school board..."
          className={`w-full bg-transparent outline-none placeholder:text-ink-faint ${large ? "text-lg" : "text-sm"}`}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
        />
      </div>
      {showList && (
        <div id={listId} role="listbox" className="absolute z-30 mt-1 max-h-[70vh] w-full overflow-y-auto rounded-md border border-line bg-surface py-1 shadow-lg">
          {status === "error" && <p className="px-4 py-3 text-sm text-ink-muted">Search is temporarily unavailable.</p>}
          {status !== "error" && options.length === 0 && (
            <p className="px-4 py-3 text-sm text-ink-muted">{status === "loading" ? "Searching…" : "No matching schools, cities, or boards."}</p>
          )}
          {GROUPS.map(({ kind, heading, Icon }) => {
            const group = options.filter((o) => o.kind === kind);
            if (group.length === 0) return null;
            return (
              <div key={kind} role="group" aria-label={heading}>
                <p className="px-4 pb-1 pt-2 font-mono text-[11px] uppercase tracking-wider text-ink-faint">{heading}</p>
                {group.map((option) => {
                  const index = options.indexOf(option);
                  return (
                    <div
                      key={option.href}
                      id={`${listId}-${index}`}
                      role="option"
                      aria-selected={index === active}
                      className={`flex cursor-pointer items-start gap-3 px-4 py-2 ${index === active ? "bg-accent-subtle" : "hover:bg-paper"}`}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        go(option.href);
                      }}
                      onMouseEnter={() => setActive(index)}
                    >
                      <Icon size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
                      <span>
                        <span className="block text-sm text-ink">{option.label}</span>
                        {option.sublabel && <span className="block text-xs text-ink-muted">{option.sublabel}</span>}
                      </span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
