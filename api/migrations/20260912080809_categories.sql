-- Create "categories" table
CREATE TABLE "categories" (
  "id" bigserial NOT NULL,
  "name" character varying(64) NOT NULL,
  "icon" character varying(64) NOT NULL,
  "hex_color" character varying(64) NOT NULL,
  "user_id" uuid NULL,
  "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" timestamptz NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "fk_categories_user" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION
);
-- Create index "idx_categories_user_id" to table: "categories"
CREATE INDEX "idx_categories_user_id" ON "categories" ("user_id");
