-- Create "users" table
CREATE TABLE "public"."users" (
  "id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" timestamptz NULL,
  "language" character varying(2) NOT NULL DEFAULT 'en',
  "currency" character varying(3) NOT NULL DEFAULT 'UAH',
  "name" character varying(255) NOT NULL,
  "picture_url" character varying(255) NULL,
  PRIMARY KEY ("id")
);
