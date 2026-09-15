import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// RLS is enabled on every table with no policies: the anon/authenticated Supabase roles get
// nothing through the auto-generated REST API. The Next.js server (direct Postgres connection)
// and the ingestion pipeline (service-role key) bypass RLS, so they are unaffected.

/** WattMap's normalized peer-grouping category, derived from the Ministry "School Level" field. */
export const schoolLevel = pgEnum("school_level", ["elementary", "secondary", "combined"]);

/** Only `matched` links a facility to a school; everything else waits for human review. */
export const matchStatus = pgEnum("match_status", ["matched", "ambiguous", "unmatched", "rejected"]);

/** Ordered from most to least deterministic; see docs/matching.md. */
export const matchMethod = pgEnum("match_method", [
  "override",
  "exact_name_board",
  "address_board",
  "name_city_board",
  "fuzzy",
]);

// Drizzle's $onUpdate only fires for Drizzle-issued updates; the ingestion pipeline sets
// updated_at explicitly on every upsert.
const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const boards = pgTable(
  "boards",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    boardNumber: text("board_number").notNull(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    boardType: text("board_type"),
    language: text("language"),
    region: text("region"),
    website: text("website"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("boards_board_number_key").on(t.boardNumber),
    uniqueIndex("boards_slug_key").on(t.slug),
  ],
).enableRLS();

export const schools = pgTable(
  "schools",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    /** Ministry school number (BSID). Text, because it is an identifier, not a quantity. */
    schoolNumber: text("school_number").notNull(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    boardId: integer("board_id")
      .notNull()
      .references(() => boards.id, { onDelete: "restrict" }),
    schoolLevel: schoolLevel("school_level"),
    schoolType: text("school_type"),
    language: text("language"),
    gradeRange: text("grade_range"),
    region: text("region"),
    street: text("street"),
    city: text("city"),
    province: text("province"),
    postalCode: text("postal_code"),
    website: text("website"),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    coordinatesSource: text("coordinates_source"),
    active: boolean("active").notNull().default(true),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("schools_school_number_key").on(t.schoolNumber),
    uniqueIndex("schools_slug_key").on(t.slug),
    index("schools_board_id_idx").on(t.boardId),
    index("schools_city_idx").on(t.city),
    check("schools_latitude_range", sql`${t.latitude} between -90 and 90`),
    check("schools_longitude_range", sql`${t.longitude} between -180 and 180`),
  ],
).enableRLS();

/** One entry per candidate school considered during matching, stored for human review. */
export type MatchCandidate = {
  school_number: string;
  school_name: string;
  method: string;
  score: number;
};

/** A facility as it appears in Broader Public Sector energy reporting. */
export const facilities = pgTable(
  "facilities",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    /**
     * Stable natural key: hash of normalized organization | facility name | city.
     * Keeps a facility's identity constant across yearly files whose layouts differ.
     */
    sourceKey: text("source_key").notNull(),
    sourceFacilityIdentifier: text("source_facility_identifier"),
    /** Original spelling from the source file, kept for attribution. */
    facilityName: text("facility_name").notNull(),
    organizationName: text("organization_name").notNull(),
    operationType: text("operation_type"),
    street: text("street"),
    city: text("city"),
    postalCode: text("postal_code"),
    // restrict, not set null: a matched facility must keep its school (see check below).
    // Schools are retired with active = false rather than deleted.
    schoolId: integer("school_id").references(() => schools.id, { onDelete: "restrict" }),
    boardId: integer("board_id").references(() => boards.id, { onDelete: "set null" }),
    matchStatus: matchStatus("match_status").notNull().default("unmatched"),
    matchMethod: matchMethod("match_method"),
    matchConfidence: real("match_confidence"),
    matchCandidates: jsonb("match_candidates").$type<MatchCandidate[]>(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("facilities_source_key_key").on(t.sourceKey),
    index("facilities_school_id_idx").on(t.schoolId),
    index("facilities_board_id_idx").on(t.boardId),
    index("facilities_match_status_idx").on(t.matchStatus),
    check("facilities_match_confidence_range", sql`${t.matchConfidence} between 0 and 1`),
    // Enforces "never silently force a match" at the database level.
    check(
      "facilities_school_only_when_matched",
      sql`(${t.matchStatus} = 'matched') = (${t.schoolId} is not null)`,
    ),
  ],
).enableRLS();

/**
 * One facility-year of reported energy. Every measure is nullable: a field missing from a
 * given year's source file stays null rather than being estimated.
 */
export const energyRecords = pgTable(
  "energy_records",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    facilityId: integer("facility_id")
      .notNull()
      .references(() => facilities.id, { onDelete: "cascade" }),
    reportingYear: integer("reporting_year").notNull(),
    reportingPeriodStart: date("reporting_period_start"),
    reportingPeriodEnd: date("reporting_period_end"),
    electricityKwh: doublePrecision("electricity_kwh"),
    electricityGj: doublePrecision("electricity_gj"),
    naturalGasM3: doublePrecision("natural_gas_m3"),
    naturalGasGj: doublePrecision("natural_gas_gj"),
    fuelOilGj: doublePrecision("fuel_oil_gj"),
    otherEnergyGj: doublePrecision("other_energy_gj"),
    totalSiteEnergyGj: doublePrecision("total_site_energy_gj"),
    normalizedTotalEnergyGj: doublePrecision("normalized_total_energy_gj"),
    ghgKgCo2e: doublePrecision("ghg_kg_co2e"),
    normalizedGhgKgCo2e: doublePrecision("normalized_ghg_kg_co2e"),
    floorAreaM2: doublePrecision("floor_area_m2"),
    weeklyHours: doublePrecision("weekly_hours"),
    portableCount: integer("portable_count"),
    operationType: text("operation_type"),
    /** The untouched source row, so any derived value can be traced back. */
    rawSourceJson: jsonb("raw_source_json").notNull(),
    // Problems are flagged, not rejected by constraints: questionable records stay visible.
    dataQualityFlags: text("data_quality_flags")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    sourceDataset: text("source_dataset").notNull(),
    sourceResource: text("source_resource"),
    sourceRowHash: text("source_row_hash").notNull(),
    importedAt: timestamp("imported_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Upsert target for idempotent ingestion; its leading column also serves facility_id lookups.
    uniqueIndex("energy_records_facility_year_key").on(t.facilityId, t.reportingYear),
    index("energy_records_reporting_year_idx").on(t.reportingYear),
    check("energy_records_reporting_year_range", sql`${t.reportingYear} between 2000 and 2100`),
  ],
).enableRLS();

/**
 * Persisted benchmarking results, rebuilt from energy_records by `npm run analytics:rebuild`
 * using the pure functions in lib/analytics. The benchmarked entity is a school (all facilities
 * matched to it, combined per year) or, for facilities with no confirmed school, the facility.
 */
export const peerMetrics = pgTable(
  "peer_metrics",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    schoolId: integer("school_id").references(() => schools.id, { onDelete: "cascade" }),
    facilityId: integer("facility_id").references(() => facilities.id, { onDelete: "cascade" }),
    reportingYear: integer("reporting_year").notNull(),
    /** Facility records combined into this row (more than one only for multi-building schools). */
    facilityCount: integer("facility_count").notNull().default(1),
    operationCategory: text("operation_category").notNull(),
    schoolLevel: schoolLevel("school_level"),
    euiGjM2: doublePrecision("eui_gj_m2"),
    ghgIntensityKgM2: doublePrecision("ghg_intensity_kg_m2"),
    electricityIntensityKwhM2: doublePrecision("electricity_intensity_kwh_m2"),
    /** Which relaxation stage produced the peer group, for "How peers are selected". */
    peerStage: text("peer_stage"),
    peerCriteria: text("peer_criteria").array().notNull().default(sql`'{}'::text[]`),
    peerCount: integer("peer_count").notNull().default(0),
    /** Sorted peer EUIs, kept so the distribution chart needs no second query. */
    peerEuis: doublePrecision("peer_euis").array().notNull().default(sql`'{}'::double precision[]`),
    euiPercentile: doublePrecision("eui_percentile"),
    ghgPercentile: doublePrecision("ghg_percentile"),
    peerMedianEui: doublePrecision("peer_median_eui"),
    peerQ25Eui: doublePrecision("peer_q25_eui"),
    peerQ75Eui: doublePrecision("peer_q75_eui"),
    energyGapGj: doublePrecision("energy_gap_gj"),
    euiRobustZ: doublePrecision("eui_robust_z"),
    anomalyLabel: text("anomaly_label"),
    trendAnnualPct: doublePrecision("trend_annual_pct"),
    trendYears: integer("trend_years").array().notNull().default(sql`'{}'::integer[]`),
    opportunityScore: integer("opportunity_score"),
    /** High | Medium | Low; null when the score is suppressed. */
    scoreConfidence: text("score_confidence"),
    scoreReasons: text("score_reasons").array().notNull().default(sql`'{}'::text[]`),
    computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Postgres treats NULLs as distinct, so each index constrains only its own entity type.
    uniqueIndex("peer_metrics_school_year_key").on(t.schoolId, t.reportingYear),
    uniqueIndex("peer_metrics_facility_year_key").on(t.facilityId, t.reportingYear),
    index("peer_metrics_reporting_year_idx").on(t.reportingYear),
    check("peer_metrics_one_entity", sql`(${t.schoolId} is null) <> (${t.facilityId} is null)`),
    check("peer_metrics_score_range", sql`${t.opportunityScore} between 0 and 100`),
  ],
).enableRLS();

/** One row per pipeline run: what was read, what was accepted, and the source hashes. */
export const ingestionRuns = pgTable(
  "ingestion_runs",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    source: text("source").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    rowsProcessed: integer("rows_processed").notNull().default(0),
    accepted: integer("accepted").notNull().default(0),
    rejected: integer("rejected").notNull().default(0),
    warnings: jsonb("warnings"),
    sourceHash: text("source_hash"),
    summary: jsonb("summary"),
  },
  (t) => [index("ingestion_runs_started_at_idx").on(t.startedAt)],
).enableRLS();

export type PeerMetric = typeof peerMetrics.$inferSelect;
export type IngestionRun = typeof ingestionRuns.$inferSelect;
export type Board = typeof boards.$inferSelect;
export type School = typeof schools.$inferSelect;
export type Facility = typeof facilities.$inferSelect;
export type EnergyRecord = typeof energyRecords.$inferSelect;
