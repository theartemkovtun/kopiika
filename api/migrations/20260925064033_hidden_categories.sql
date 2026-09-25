-- Create "hidden_categories" table
CREATE TABLE "hidden_categories" (
  "user_id" uuid NOT NULL,
  "category_id" bigint NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("user_id", "category_id"),
  CONSTRAINT "fk_hidden_categories_category" FOREIGN KEY ("category_id") REFERENCES "categories" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "fk_hidden_categories_user" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
