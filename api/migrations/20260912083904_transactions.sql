-- Create "transactions" table
CREATE TABLE "transactions" (
  "id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" timestamptz NULL,
  "date" date NOT NULL,
  "type" character varying(10) NOT NULL,
  "title" character varying(64) NOT NULL,
  "description" character varying(256) NULL,
  "value" numeric(18,4) NOT NULL,
  "currency" character varying(3) NOT NULL,
  "category_id" bigint NULL,
  "account_id" uuid NULL,
  "user_id" uuid NOT NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "fk_transactions_account" FOREIGN KEY ("account_id") REFERENCES "accounts" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION,
  CONSTRAINT "fk_transactions_category" FOREIGN KEY ("category_id") REFERENCES "categories" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION,
  CONSTRAINT "fk_transactions_user" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
-- Create index "idx_transactions_account_id" to table: "transactions"
CREATE INDEX "idx_transactions_account_id" ON "transactions" ("account_id");
-- Create index "idx_transactions_category_id" to table: "transactions"
CREATE INDEX "idx_transactions_category_id" ON "transactions" ("category_id");
-- Create index "idx_transactions_user_id_date" to table: "transactions"
CREATE INDEX "idx_transactions_user_id_date" ON "transactions" ("user_id", "date");
