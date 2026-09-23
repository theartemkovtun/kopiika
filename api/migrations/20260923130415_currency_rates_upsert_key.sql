-- Hand-written, like 20260912072851_currency_rates.sql: the "currency" schema is
-- outside Atlas diffing.
--
-- Restores add_currency_rates to the definition 20260912072851 created. The
-- deployed database was found running the original function from the old
-- "kopiika" database instead, whose conflict target is (date, "from", "to", rate)
-- — the primary key that database had. This table's primary key excludes
-- rate, so no constraint matches that target and every call fails with
-- SQLSTATE 42P10. CREATE OR REPLACE makes this safe to run whichever version a
-- database holds.
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
