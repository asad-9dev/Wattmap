import type { MetadataRoute } from "next";
import { data, load } from "@/lib/data";
import { siteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

const STATIC_PATHS = ["", "/schools", "/map", "/compare", "/ontario", "/boards", "/toolkit", "/methodology", "/data", "/about"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const entries: MetadataRoute.Sitemap = STATIC_PATHS.map((path) => ({ url: `${base}${path}`, changeFrequency: "monthly", priority: path === "" ? 1 : 0.7 }));
  const source = await load(() => data.searchSource());
  if (source.ok) {
    entries.push(...source.data.schools.map((s) => ({ url: `${base}/schools/${s.slug}`, changeFrequency: "yearly" as const, priority: 0.6 })));
    entries.push(...source.data.boards.map((b) => ({ url: `${base}/boards/${b.slug}`, changeFrequency: "yearly" as const, priority: 0.5 })));
  }
  return entries;
}
