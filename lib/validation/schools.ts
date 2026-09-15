import { z } from "zod";
import { SCHOOL_SORTS } from "@/lib/db/queries/schools";

const optionalText = z
  .string()
  .trim()
  .max(120)
  .optional()
  .transform((v) => (v ? v : undefined));
const optionalNumber = (min: number, max: number) =>
  z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => (v === undefined || v === "" ? undefined : Number(v)))
    .pipe(z.number().min(min).max(max).optional());

/** Query-string schema shared by /schools and /api/schools. Invalid values fall back to defaults. */
export const SchoolListParams = z.object({
  q: optionalText,
  board: optionalText,
  city: optionalText,
  region: optionalText,
  level: z.enum(["elementary", "secondary", "combined"]).optional().catch(undefined),
  year: optionalNumber(2000, 2100).catch(undefined),
  scoreMin: optionalNumber(0, 100).catch(undefined),
  scoreMax: optionalNumber(0, 100).catch(undefined),
  pctMin: optionalNumber(0, 100).catch(undefined),
  pctMax: optionalNumber(0, 100).catch(undefined),
  reported: z
    .string()
    .optional()
    .transform((v) => v === "1"),
  sort: z.enum(SCHOOL_SORTS).catch("name").default("name"),
  dir: z.enum(["asc", "desc"]).catch("asc").default("asc"),
  page: optionalNumber(1, 10000).catch(undefined),
});

export type SchoolListParams = z.infer<typeof SchoolListParams>;

export function firstValues(params: Record<string, string | string[] | undefined>): Record<string, string | undefined> {
  return Object.fromEntries(Object.entries(params).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]));
}
