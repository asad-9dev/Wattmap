import { asc, eq } from "drizzle-orm";
import { boards, schools } from "@/drizzle/schema";
import type { AnyDatabase } from "@/lib/db";
import type { SearchSource } from "@/lib/search";

export async function loadSearchSource(db: AnyDatabase): Promise<SearchSource> {
  const [schoolRows, boardRows] = await Promise.all([
    db
      .select({ name: schools.name, slug: schools.slug, city: schools.city, boardName: boards.name })
      .from(schools)
      .innerJoin(boards, eq(schools.boardId, boards.id))
      .where(eq(schools.active, true))
      .orderBy(asc(schools.name)),
    db.select({ name: boards.name, slug: boards.slug }).from(boards).orderBy(asc(boards.name)),
  ]);
  return { schools: schoolRows, boards: boardRows };
}
