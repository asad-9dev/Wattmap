/**
 * Grouped, typo-tolerant autocomplete over schools, cities, and boards. The whole index is a
 * few thousand short strings, so it lives in server memory instead of needing Postgres
 * extensions (pg_trgm/unaccent) that a default Supabase project does not enable.
 */

import { foldText } from "@/lib/analytics/category";

export type SearchKind = "school" | "city" | "board";

export type SearchDoc = {
  kind: SearchKind;
  label: string;
  sublabel: string | null;
  href: string;
  words: string[];
  folded: string;
};

export type SearchSource = {
  schools: { name: string; slug: string; city: string | null; boardName: string }[];
  boards: { name: string; slug: string }[];
};

export function normalizeQuery(text: string): string {
  return foldText(text)
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function doc(kind: SearchKind, label: string, sublabel: string | null, href: string): SearchDoc {
  const folded = normalizeQuery(label);
  return { kind, label, sublabel, href, folded, words: folded.split(" ").filter(Boolean) };
}

export function buildSearchIndex(source: SearchSource): SearchDoc[] {
  const cities = new Map<string, { label: string; count: number }>();
  for (const school of source.schools) {
    if (!school.city) continue;
    const key = normalizeQuery(school.city);
    const entry = cities.get(key) ?? { label: school.city, count: 0 };
    entry.count += 1;
    cities.set(key, entry);
  }
  return [
    ...source.schools.map((s) => doc("school", s.name, [s.city, s.boardName].filter(Boolean).join(" · "), `/schools/${s.slug}`)),
    ...[...cities.values()].map((c) =>
      doc("city", c.label, `${c.count} school${c.count === 1 ? "" : "s"}`, `/schools?city=${encodeURIComponent(c.label)}`),
    ),
    ...source.boards.map((b) => doc("board", b.name, null, `/boards/${b.slug}`)),
  ];
}

function bigrams(word: string): Set<string> {
  const padded = ` ${word} `;
  const grams = new Set<string>();
  for (let i = 0; i < padded.length - 1; i += 1) grams.add(padded.slice(i, i + 2));
  return grams;
}

/** Sørensen–Dice coefficient on character bigrams: 1 = identical, tolerant of one-letter typos. */
export function dice(a: string, b: string): number {
  const left = bigrams(a);
  const right = bigrams(b);
  let shared = 0;
  for (const gram of left) if (right.has(gram)) shared += 1;
  return (2 * shared) / (left.size + right.size);
}

const FUZZY_THRESHOLD = 0.6;

/** 0 = no match. Exact prefixes outrank substrings, which outrank typo-tolerant matches. */
export function scoreDoc(query: string, target: SearchDoc): number {
  if (!query) return 0;
  if (target.folded.startsWith(query)) return 100;
  const queryWords = query.split(" ");
  if (queryWords.every((q) => target.words.some((w) => w.startsWith(q)))) return 80;
  if (target.folded.includes(query)) return 60;
  const perWord = queryWords.map((q) => Math.max(0, ...target.words.map((w) => (w.startsWith(q) ? 1 : dice(q, w)))));
  const average = perWord.reduce((sum, s) => sum + s, 0) / perWord.length;
  return average >= FUZZY_THRESHOLD ? 40 * average : 0;
}

export type SearchResults = Record<SearchKind, Pick<SearchDoc, "label" | "sublabel" | "href">[]>;

export function search(index: readonly SearchDoc[], rawQuery: string, perKind = 6): SearchResults {
  const query = normalizeQuery(rawQuery);
  const results: SearchResults = { school: [], city: [], board: [] };
  if (query.length < 2) return results;
  const scored = index
    .map((d) => ({ d, score: scoreDoc(query, d) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.d.label.localeCompare(b.d.label));
  for (const { d } of scored) {
    if (results[d.kind].length < perKind) results[d.kind].push({ label: d.label, sublabel: d.sublabel, href: d.href });
  }
  return results;
}
