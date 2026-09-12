-- Hand-written: the "currency" schema is owned by the kopiika-currency-fetch
-- service, not by the GORM models, so it is deliberately outside Atlas diffing.
-- Create "currency" schema
CREATE SCHEMA IF NOT EXISTS "currency";
-- Create "currency_rates" table
CREATE TABLE "currency"."currency_rates" (
  "date" date NOT NULL,
  "from" character varying(3) NOT NULL,
  "to" character varying(3) NOT NULL,
  "rate" numeric NOT NULL,
  PRIMARY KEY ("date", "from", "to")
);
-- Create "add_currency_rates" function, the entry point kopiika-currency-fetch calls.
-- Unlike the original in the "kopiika" database, the primary key excludes "rate",
-- so re-running the fetcher for a day updates that day's rate instead of appending
-- a second row for it. Codes are lower cased on the way in to keep the column
-- canonical regardless of what the caller sends.
CREATE OR REPLACE FUNCTION "currency"."add_currency_rates"(_request json)
RETURNS boolean
LANGUAGE plpgsql
AS $function$
begin

    insert into currency.currency_rates (date, "from", "to", rate)
    select distinct on (c.date, lower(c."from"), lower(c."to"))
           c.date, lower(c."from"), lower(c."to"), c.rate
    from json_to_recordset(_request) as c(date date, "from" varchar, "to" varchar, rate decimal)
    order by c.date, lower(c."from"), lower(c."to")
    on conflict (date, "from", "to") do update
    set rate = EXCLUDED.rate;

    return true;

end;
$function$;
