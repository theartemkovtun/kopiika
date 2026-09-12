package queries

import (
	"encoding/json"
	"time"

	"kopiika-api-go/src/models"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

// StatisticsTransaction is one transaction as the statistics query returns it:
// the transaction, its category and account, and its amount already converted
// into the user's currency at the rate for its own date.
//
// Only the four extremes come back in this shape. Everything else the endpoint
// reports is an aggregate, and aggregating in SQL is the point — Python loads
// the whole filtered range into memory and folds it there.
type StatisticsTransaction struct {
	Id          uuid.UUID       `json:"id"`
	Date        string          `json:"date"`
	Type        string          `json:"type"`
	Title       string          `json:"title"`
	Description *string         `json:"description"`
	Value       decimal.Decimal `json:"value"`
	Currency    string          `json:"currency"`
	// Amount is Value in the user's currency. It is never null in a row that
	// reaches the caller: the query leaves unconvertible transactions out of
	// the extremes, and counts them so the service can fail instead.
	Amount   decimal.Decimal  `json:"amount"`
	Category *models.Category `json:"category"`
	Account  *models.Account  `json:"account"`
}

// StatisticsExtremes is the smallest and largest single transaction in each
// direction. A direction with no transactions at all leaves both of its fields
// nil, which is the null Python answers with.
//
// The keys are what the query's json_object_agg builds them from — the
// transaction's own type joined to the edge it sits at.
type StatisticsExtremes struct {
	MinIncome  *StatisticsTransaction `json:"income_min"`
	MaxIncome  *StatisticsTransaction `json:"income_max"`
	MinOutcome *StatisticsTransaction `json:"outcome_min"`
	MaxOutcome *StatisticsTransaction `json:"outcome_max"`
}

// DayTotals is one day of the range with both directions totalled. Days with no
// transactions are present and zero: the day list comes from generate_series
// over the requested range, not from the transactions.
type DayTotals struct {
	Date    string          `json:"date"`
	Income  decimal.Decimal `json:"income"`
	Outcome decimal.Decimal `json:"outcome"`
}

// CategoryTotals is one category's share of the range's spending, both as an
// amount and as a count.
//
// Python builds these two breakdowns separately, from two folds over the same
// list. They necessarily hold the same categories — same source, same grouping
// key — so they are one grouping here, returned once and ordered twice.
type CategoryTotals struct {
	Id       int             `json:"id"`
	Name     string          `json:"name"`
	Icon     string          `json:"icon"`
	HexColor string          `json:"hexColor"`
	Amount   decimal.Decimal `json:"amount"`
	Total    int64           `json:"total"`
}

// AccountTotals is one account's share of the range's spending, both as an
// amount and as a count.
type AccountTotals struct {
	Id          uuid.UUID       `json:"id"`
	Name        string          `json:"name"`
	Description *string         `json:"description"`
	Currency    string          `json:"currency"`
	ColorHex    string          `json:"colorHex"`
	Amount      decimal.Decimal `json:"amount"`
	Total       int64           `json:"total"`
}

// Statistics is everything the statistics endpoint reports, as one query
// returns it. The service shapes it into the response and decides which half of
// it the request asked for.
type Statistics struct {
	// TargetCurrency is the user's own currency, which every amount here is in.
	TargetCurrency string

	Income  decimal.Decimal
	Outcome decimal.Decimal

	TotalTransactions   int64
	IncomeTransactions  int64
	OutcomeTransactions int64
	// ActiveDays is how many distinct days carried a transaction, which is not
	// the number of days in the range.
	ActiveDays int64
	// Unconvertible is how many transactions had no rate into the user's
	// currency on or before their own date. Any at all makes the whole response
	// wrong rather than slightly short, so the service refuses to answer.
	Unconvertible int64

	RangeStatistics  []DayTotals
	CategoryOutcomes []CategoryTotals
	AccountOutcomes  []AccountTotals
	Extremes         StatisticsExtremes
}

// statisticsTransactionJSON is one transaction built into a JSON object, for the
// four extremes. The keys are the model's own field names, as in the
// configuration query, so what arrives on the Go side is the model and the
// conversion to a DTO stays in the service.
const statisticsTransactionJSON = `
json_build_object(
	'id',          l.id,
	'date',        to_char(l.date, 'YYYY-MM-DD'),
	'type',        l.type,
	'title',       l.title,
	'description', l.description,
	'value',       l.value,
	'currency',    l.currency,
	'amount',      l.amount,
	'category',    CASE WHEN c.id IS NULL THEN NULL::json ELSE json_build_object(
		'id', c.id, 'name', c.name, 'icon', c.icon, 'hexColor', c.hex_color
	) END,
	'account',     CASE WHEN a.id IS NULL THEN NULL::json ELSE json_build_object(
		'id', a.id, 'name', a.name, 'description', a.description,
		'currency', a.currency, 'colorHex', a.color_hex
	) END
)`

// statisticsSQL is the whole endpoint in one statement.
//
// Read it as one scan and then six readings of it. localized is the range's
// transactions with each one's amount already in the user's currency, and it is
// MATERIALIZED because everything below reads it: computing it once is the
// difference between one pass over the range and six. Python's shape — load the
// range, fold it in the process — is one round trip too, but it carries every
// row across the wire to produce seventeen numbers.
//
// The rate is resolved per transaction, as in the listing: a transaction needs
// exactly one rate, its own currency into the user's on its own date, which is a
// single index descent. An amount is NULL only when that rate does not exist,
// which is what unconvertible counts.
//
// The day series is generated as a plain timestamp rather than a date. Two
// dates would resolve generate_series to its timestamptz overload, which makes
// the series — and so every day label in the response — depend on the server's
// TimeZone setting; a plain timestamp has no zone to shift under it.
//
// target is CROSS JOINed first, so an unknown user collapses the result to zero
// rows — the one signal that tells "no such user" from "a range with nothing in
// it", which every aggregate below would otherwise report identically.
const statisticsSQL = `
WITH target AS (
	SELECT currency FROM users WHERE id = ? AND deleted_at IS NULL
), localized AS MATERIALIZED (
	SELECT
		t.id, t.created_at, t.date, t.type, t.title, t.description,
		t.value, t.currency, t.category_id, t.account_id,
		round(t.value * CASE WHEN t.currency = target.currency THEN 1 ELSE rate.rate END, 2) AS amount
	FROM transactions t
	CROSS JOIN target
	LEFT JOIN LATERAL (
		SELECT r.rate
		FROM currency.currency_rates r
		WHERE r."to" = target.currency AND r."from" = t.currency AND r.date <= t.date
		ORDER BY r.date DESC
		LIMIT 1
	) rate ON t.currency IS DISTINCT FROM target.currency
	WHERE t.user_id = ? AND t.deleted_at IS NULL AND t.date >= ? AND t.date <= ?
), totals AS (
	SELECT
		coalesce(sum(amount) FILTER (WHERE type = 'income'), 0)  AS income,
		coalesce(sum(amount) FILTER (WHERE type = 'outcome'), 0) AS outcome,
		count(*)                                                 AS total_transactions,
		count(*) FILTER (WHERE type = 'income')                  AS income_transactions,
		count(*) FILTER (WHERE type = 'outcome')                 AS outcome_transactions,
		count(DISTINCT date)                                     AS active_days,
		count(*) FILTER (WHERE amount IS NULL)                   AS unconvertible
	FROM localized
), per_day AS (
	SELECT
		date,
		coalesce(sum(amount) FILTER (WHERE type = 'income'), 0)  AS income,
		coalesce(sum(amount) FILTER (WHERE type = 'outcome'), 0) AS outcome
	FROM localized
	GROUP BY date
), range_statistics AS (
	SELECT json_agg(json_build_object(
		'date',    to_char(day, 'YYYY-MM-DD'),
		'income',  coalesce(per_day.income, 0),
		'outcome', coalesce(per_day.outcome, 0)
	) ORDER BY day) AS value
	FROM generate_series(?::date::timestamp, ?::date::timestamp, interval '1 day') AS day
	LEFT JOIN per_day ON per_day.date = day::date
), category_outcomes AS (
	SELECT json_agg(json_build_object(
		'id', g.id, 'name', g.name, 'icon', g.icon, 'hexColor', g.hex_color,
		'amount', g.amount, 'total', g.total
	) ORDER BY g.amount DESC, g.id) AS value
	FROM (
		SELECT c.id, c.name, c.icon, c.hex_color,
			coalesce(sum(l.amount), 0) AS amount,
			count(*)                   AS total
		FROM localized l
		JOIN categories c ON c.id = l.category_id
		WHERE l.type = 'outcome'
		GROUP BY c.id, c.name, c.icon, c.hex_color
	) g
), account_outcomes AS (
	SELECT json_agg(json_build_object(
		'id', g.id, 'name', g.name, 'description', g.description,
		'currency', g.currency, 'colorHex', g.color_hex,
		'amount', g.amount, 'total', g.total
	) ORDER BY g.amount DESC, g.id) AS value
	FROM (
		SELECT a.id, a.name, a.description, a.currency, a.color_hex,
			coalesce(sum(l.amount), 0) AS amount,
			count(*)                   AS total
		FROM localized l
		JOIN accounts a ON a.id = l.account_id
		WHERE l.type = 'outcome'
		GROUP BY a.id, a.name, a.description, a.currency, a.color_hex
	) g
), extremes AS (
	SELECT
		l.type,
		(array_agg(l.id ORDER BY l.amount ASC,  l.created_at, l.id))[1] AS min_id,
		(array_agg(l.id ORDER BY l.amount DESC, l.created_at, l.id))[1] AS max_id
	FROM localized l
	WHERE l.amount IS NOT NULL
	GROUP BY l.type
), extreme_ids AS (
	SELECT type, 'min' AS edge, min_id AS id FROM extremes
	UNION ALL
	SELECT type, 'max' AS edge, max_id AS id FROM extremes
), extreme_transactions AS (
	SELECT json_object_agg(e.type || '_' || e.edge,` + statisticsTransactionJSON + `) AS value
	FROM extreme_ids e
	JOIN localized l ON l.id = e.id
	LEFT JOIN categories c ON c.id = l.category_id
	LEFT JOIN accounts a ON a.id = l.account_id
)
SELECT
	target.currency                                   AS target_currency,
	totals.income                                     AS income,
	totals.outcome                                    AS outcome,
	totals.total_transactions                         AS total_transactions,
	totals.income_transactions                        AS income_transactions,
	totals.outcome_transactions                       AS outcome_transactions,
	totals.active_days                                AS active_days,
	totals.unconvertible                              AS unconvertible,
	coalesce(range_statistics.value, '[]'::json)      AS range_statistics,
	coalesce(category_outcomes.value, '[]'::json)     AS category_outcomes,
	coalesce(account_outcomes.value, '[]'::json)      AS account_outcomes,
	coalesce(extreme_transactions.value, '{}'::json)  AS extremes
FROM target
CROSS JOIN totals
CROSS JOIN range_statistics
CROSS JOIN category_outcomes
CROSS JOIN account_outcomes
CROSS JOIN extreme_transactions`

// TransactionsStatistics folds the user's whole date range into one row, in one
// statement.
//
// A user id matching no live user yields no rows, and is reported as
// gorm.ErrRecordNotFound — the same error the separate user lookup it replaces
// used to raise, and what tells an unknown user from an empty range.
func TransactionsStatistics(
	db *gorm.DB,
	userId uuid.UUID,
	fromDate time.Time,
	toDate time.Time,
) (Statistics, error) {
	var row struct {
		TargetCurrency string
		Income         decimal.Decimal
		Outcome        decimal.Decimal

		TotalTransactions   int64
		IncomeTransactions  int64
		OutcomeTransactions int64
		ActiveDays          int64
		Unconvertible       int64

		RangeStatistics  []byte
		CategoryOutcomes []byte
		AccountOutcomes  []byte
		Extremes         []byte
	}

	const layout = "2006-01-02"
	from, to := fromDate.Format(layout), toDate.Format(layout)

	result := db.Raw(statisticsSQL, userId, userId, from, to, from, to).Scan(&row)
	if result.Error != nil {
		return Statistics{}, result.Error
	}
	if result.RowsAffected == 0 {
		return Statistics{}, gorm.ErrRecordNotFound
	}

	statistics := Statistics{
		TargetCurrency:      row.TargetCurrency,
		Income:              row.Income,
		Outcome:             row.Outcome,
		TotalTransactions:   row.TotalTransactions,
		IncomeTransactions:  row.IncomeTransactions,
		OutcomeTransactions: row.OutcomeTransactions,
		ActiveDays:          row.ActiveDays,
		Unconvertible:       row.Unconvertible,
	}

	for _, decode := range []struct {
		raw  []byte
		into any
	}{
		{row.RangeStatistics, &statistics.RangeStatistics},
		{row.CategoryOutcomes, &statistics.CategoryOutcomes},
		{row.AccountOutcomes, &statistics.AccountOutcomes},
		{row.Extremes, &statistics.Extremes},
	} {
		if err := json.Unmarshal(decode.raw, decode.into); err != nil {
			return Statistics{}, err
		}
	}

	return statistics, nil
}
