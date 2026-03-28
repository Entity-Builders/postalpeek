-- 20260321161322_create_postalpeek_objects.sql

CREATE TABLE "public"."postalpeek_postcard_objects" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "postcard_id" uuid NOT NULL,
    "label" text NOT NULL,
    "type" text NOT NULL,
    "object_url" text NOT NULL,
    "position_x_pct" numeric,
    "position_y_pct" numeric,
    "width_pct" numeric,
    "height_pct" numeric,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "postalpeek_postcard_objects_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "postalpeek_postcard_objects_postcard_id_fkey" FOREIGN KEY ("postcard_id") REFERENCES "public"."postalpeek_postcards"("id") ON DELETE CASCADE
);

-- Row Level Security
ALTER TABLE "public"."postalpeek_postcard_objects" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON "public"."postalpeek_postcard_objects"
    FOR SELECT USING (true);

-- (Optionally) policy for service role inserts/updates is default allowed
