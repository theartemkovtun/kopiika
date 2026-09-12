data "external_schema" "gorm" {
  program = [
    "go",
    "run",
    "-mod=mod",
    "./cmd/atlas-loader",
  ]
}

variable "DATABASE_URL" {
  type = string
}

env "dev" {
  src = data.external_schema.gorm.url
  url = var.DATABASE_URL
  # Scoped to "public": that is the only schema generated from the GORM models.
  # The "currency" schema is owned by kopiika-currency-fetch and is created by a
  # hand-written migration, so it must stay out of the diff — unscoped, Atlas
  # sees it in the replayed state, not in the desired state, and emits a
  # DROP SCHEMA "currency" CASCADE.
  dev = "docker://postgres/16/dev?search_path=public"

  migration {
    dir = "file://migrations"
  }
}
