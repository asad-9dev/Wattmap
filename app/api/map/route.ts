import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { data, load } from "@/lib/data";

const Query = z.object({ year: z.coerce.number().int().min(2000).max(2100).optional() });

export async function GET(request: NextRequest) {
  const parsed = Query.safeParse({ year: request.nextUrl.searchParams.get("year") ?? undefined });
  if (!parsed.success) return NextResponse.json({ error: "year must be a reporting year such as 2023." }, { status: 400 });
  const year = parsed.data.year ?? (await load(() => data.latestYear()));
  const resolvedYear = typeof year === "number" ? year : year.ok ? year.data : null;
  if (resolvedYear === null) return NextResponse.json({ error: "Map data is temporarily unavailable." }, { status: 503 });
  const points = await load(() => data.mapPoints(resolvedYear));
  if (!points.ok) return NextResponse.json({ error: "Map data is temporarily unavailable." }, { status: 503 });
  return NextResponse.json(
    { year: resolvedYear, points: points.data },
    { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } },
  );
}
