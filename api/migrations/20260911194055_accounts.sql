-- Create "accounts" table
CREATE TABLE "public"."accounts" (
  "id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" timestamptz NULL,
  "name" character varying(64) NOT NULL,
  "description" character varying(256) NULL,
  "value" numeric(18,4) NOT NULL DEFAULT 0,
  "currency" character varying(3) NOT NULL,
  "color_hex" character varying(7) NOT NULL,
  "user_id" uuid NOT NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "fk_accounts_user" FOREIGN KEY ("user_id") REFERENCES "public"."users" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
-- Create index "idx_accounts_user_id" to table: "accounts"
CREATE INDEX "idx_accounts_user_id" ON "public"."accounts" ("user_id");
