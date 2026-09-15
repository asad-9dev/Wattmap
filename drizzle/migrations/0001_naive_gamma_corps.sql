CREATE TABLE "ingestion_runs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ingestion_runs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"source" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"rows_processed" integer DEFAULT 0 NOT NULL,
	"accepted" integer DEFAULT 0 NOT NULL,
	"rejected" integer DEFAULT 0 NOT NULL,
	"warnings" jsonb,
	"source_hash" text,
	"summary" jsonb
);
--> statement-breakpoint
ALTER TABLE "ingestion_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "peer_metrics" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "peer_metrics_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"school_id" integer,
	"facility_id" integer,
	"reporting_year" integer NOT NULL,
	"facility_count" integer DEFAULT 1 NOT NULL,
	"operation_category" text NOT NULL,
	"school_level" "school_level",
	"eui_gj_m2" double precision,
	"ghg_intensity_kg_m2" double precision,
	"electricity_intensity_kwh_m2" double precision,
	"peer_stage" text,
	"peer_criteria" text[] DEFAULT '{}'::text[] NOT NULL,
	"peer_count" integer DEFAULT 0 NOT NULL,
	"peer_euis" double precision[] DEFAULT '{}'::double precision[] NOT NULL,
	"eui_percentile" double precision,
	"ghg_percentile" double precision,
	"peer_median_eui" double precision,
	"peer_q25_eui" double precision,
	"peer_q75_eui" double precision,
	"energy_gap_gj" double precision,
	"eui_robust_z" double precision,
	"anomaly_label" text,
	"trend_annual_pct" double precision,
	"trend_years" integer[] DEFAULT '{}'::integer[] NOT NULL,
	"opportunity_score" integer,
	"score_confidence" text,
	"score_reasons" text[] DEFAULT '{}'::text[] NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "peer_metrics_one_entity" CHECK (("peer_metrics"."school_id" is null) <> ("peer_metrics"."facility_id" is null)),
	CONSTRAINT "peer_metrics_score_range" CHECK ("peer_metrics"."opportunity_score" between 0 and 100)
);
--> statement-breakpoint
ALTER TABLE "peer_metrics" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "peer_metrics" ADD CONSTRAINT "peer_metrics_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "peer_metrics" ADD CONSTRAINT "peer_metrics_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ingestion_runs_started_at_idx" ON "ingestion_runs" USING btree ("started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "peer_metrics_school_year_key" ON "peer_metrics" USING btree ("school_id","reporting_year");--> statement-breakpoint
CREATE UNIQUE INDEX "peer_metrics_facility_year_key" ON "peer_metrics" USING btree ("facility_id","reporting_year");--> statement-breakpoint
CREATE INDEX "peer_metrics_reporting_year_idx" ON "peer_metrics" USING btree ("reporting_year");