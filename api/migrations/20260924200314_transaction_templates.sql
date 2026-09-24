-- Create "transaction_templates" table
CREATE TABLE "transaction_templates" (
  "id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" timestamptz NULL,
  "title" character varying(64) NOT NULL,
  "value" text NOT NULL,
  "user_id" uuid NOT NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "fk_transaction_templates_user" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
-- Create index "idx_transaction_templates_user_id" to table: "transaction_templates"
CREATE INDEX "idx_transaction_templates_user_id" ON "transaction_templates" ("user_id");
