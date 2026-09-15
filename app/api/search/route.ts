import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { data, load } from "@/lib/data";
import { buildSearchIndex, search } from "@/lib/search";

const Query = z.object({ q: z.string().trim().min(1).max(100) });

export async function GET(request: NextRequest) {
  const parsed = Query.safeParse({ q: request.nextUrl.searchParams.get("q") ?? "" });
  if (!parsed.success) return NextResponse.json({ error: "Provide a search query (1–100 characters)." }, { status: 400 });
  const source = await load(() => data.searchSource());
  if (!source.ok) return NextResponse.json({ error: "Search is temporarily unavailable." }, { status: 503 });
  return NextResponse.json(search(buildSearchIndex(source.data), parsed.data.q), {
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" },
  });
}
