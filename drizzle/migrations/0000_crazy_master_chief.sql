CREATE TYPE "public"."match_method" AS ENUM('override', 'exact_name_board', 'address_board', 'name_city_board', 'fuzzy');--> statement-breakpoint
CREATE TYPE "public"."match_status" AS ENUM('matched', 'ambiguous', 'unmatched', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."school_level" AS ENUM('elementary', 'secondary', 'combined');--> statement-breakpoint
CREATE TABLE "boards" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "boards_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"board_number" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"board_type" text,
	"language" text,
	"region" text,
	"website" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "boards" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "energy_records" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "energy_records_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"facility_id" integer NOT NULL,
	"reporting_year" integer NOT NULL,
	"reporting_period_start" date,
	"reporting_period_end" date,
	"electricity_kwh" double precision,
	"electricity_gj" double precision,
	"natural_gas_m3" double precision,
	"natural_gas_gj" double precision,
	"fuel_oil_gj" double precision,
	"other_energy_gj" double precision,
	"total_site_energy_gj" double precision,
	"normalized_total_energy_gj" double precision,
	"ghg_kg_co2e" double precision,
	"normalized_ghg_kg_co2e" double precision,
	"floor_area_m2" double precision,
	"weekly_hours" double precision,
	"portable_count" integer,
	"operation_type" text,
	"raw_source_json" jsonb NOT NULL,
	"data_quality_flags" text[] DEFAULT '{}'::text[] NOT NULL,
	"source_dataset" text NOT NULL,
	"source_resource" text,
	"source_row_hash" text NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "energy_records_reporting_year_range" CHECK ("energy_records"."reporting_year" between 2000 and 2100)
);
--> statement-breakpoint
ALTER TABLE "energy_records" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "facilities" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "facilities_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"source_key" text NOT NULL,
	"source_facility_identifier" text,
	"facility_name" text NOT NULL,
	"organization_name" text NOT NULL,
	"operation_type" text,
	"street" text,
	"city" text,
	"postal_code" text,
	"school_id" integer,
	"board_id" integer,
	"match_status" "match_status" DEFAULT 'unmatched' NOT NULL,
	"match_method" "match_method",
	"match_confidence" real,
	"match_candidates" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "facilities_match_confidence_range" CHECK ("facilities"."match_confidence" between 0 and 1),
	CONSTRAINT "facilities_school_only_when_matched" CHECK (("facilities"."match_status" = 'matched') = ("facilities"."school_id" is not null))
);
--> statement-breakpoint
ALTER TABLE "facilities" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "schools" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "schools_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"school_number" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"board_id" integer NOT NULL,
	"school_level" "school_level",
	"school_type" text,
	"language" text,
	"grade_range" text,
	"region" text,
	"street" text,
	"city" text,
	"province" text,
	"postal_code" text,
	"website" text,
	"latitude" double precision,
	"longitude" double precision,
	"coordinates_source" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "schools_latitude_range" CHECK ("schools"."latitude" between -90 and 90),
	CONSTRAINT "schools_longitude_range" CHECK ("schools"."longitude" between -180 and 180)
);
--> statement-breakpoint
ALTER TABLE "schools" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "energy_records" ADD CONSTRAINT "energy_records_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facilities" ADD CONSTRAINT "facilities_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facilities" ADD CONSTRAINT "facilities_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schools" ADD CONSTRAINT "schools_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "boards_board_number_key" ON "boards" USING btree ("board_number");--> statement-breakpoint
CREATE UNIQUE INDEX "boards_slug_key" ON "boards" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "energy_records_facility_year_key" ON "energy_records" USING btree ("facility_id","reporting_year");--> statement-breakpoint
CREATE INDEX "energy_records_reporting_year_idx" ON "energy_records" USING btree ("reporting_year");--> statement-breakpoint
CREATE UNIQUE INDEX "facilities_source_key_key" ON "facilities" USING btree ("source_key");--> statement-breakpoint
CREATE INDEX "facilities_school_id_idx" ON "facilities" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "facilities_board_id_idx" ON "facilities" USING btree ("board_id");--> statement-breakpoint
CREATE INDEX "facilities_match_status_idx" ON "facilities" USING btree ("match_status");--> statement-breakpoint
CREATE UNIQUE INDEX "schools_school_number_key" ON "schools" USING btree ("school_number");--> statement-breakpoint
CREATE UNIQUE INDEX "schools_slug_key" ON "schools" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "schools_board_id_idx" ON "schools" USING btree ("board_id");--> statement-breakpoint
CREATE INDEX "schools_city_idx" ON "schools" USING btree ("city");