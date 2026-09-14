-- atlas:txmode none

-- Hand-written, like 20260912072851_currency_rates.sql: the "currency" schema is
-- owned by kopiika-currency-fetch, not by the GORM models, so it is deliberately
-- outside Atlas diffing.
--
-- The lateral that localizes a transaction looks a rate up by equality on "to"
-- and "from", taking the newest date at or before the transaction's own. The
-- primary key is (date, "from", "to"), which leads on the wrong column: the two
-- equality terms are non-leading, so the planner can only walk the index
-- backwards from the transaction's date and filter each entry. When the pair has
-- no rows at all it walks the entire index to prove it.
--
-- That miss is the common case, not the rare one. The fetcher never records a
-- currency against itself, so every transaction already denominated in the
-- user's own currency asks for a pair like uah -> uah and reads the whole index
-- to find nothing. The cost grows with the rate history, which gains a row per
-- pair per day, so the listing degrades on its own with no deploy behind it.
--
-- Leading on the two equality columns turns both the hit and the miss into a
-- single descent. DESC matches the ORDER BY so the newest qualifying row is the
-- first one read.
--
-- CONCURRENTLY keeps the build off the ACCESS EXCLUSIVE lock, since the fetcher
-- writes to this table daily; it is what the txmode directive above is for. Note
-- that a CONCURRENTLY build which fails partway leaves an INVALID index behind,
-- and IF NOT EXISTS would then skip rather than rebuild it — if this migration
-- errors, DROP the index before re-running.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_currency_rates_to_from_date"
  ON "currency"."currency_rates" ("to", "from", "date" DESC);
