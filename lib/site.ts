/** Public site URL for metadata, sitemap, and robots. Set NEXT_PUBLIC_SITE_URL in production. */
export function siteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);
  return (configured ?? "http://localhost:3000").replace(/\/$/, "");
}

export const NAV_LINKS = [
  { href: "/schools", label: "Schools" },
  { href: "/map", label: "Map" },
  { href: "/compare", label: "Compare" },
  { href: "/ontario", label: "Ontario" },
  { href: "/toolkit", label: "Toolkit" },
  { href: "/methodology", label: "Methodology" },
  { href: "/about", label: "About" },
] as const;

export const DISCLAIMER =
  "WattMap is an independent project using publicly available data. WattMap is not affiliated with or endorsed by the Government of Ontario or any school board.";
