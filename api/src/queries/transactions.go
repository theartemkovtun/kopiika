// Package queries holds the raw or hand-built SQL behind operations that are
// more than a service-level Find: complex reads, and writes that have to span
// several statements.
package queries

import (
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"

	"kopiika-api-go/src/models"
	"kopiika-api-go/src/schemas"
)

// transactionFilters builds the WHERE fragment that narrows a listing to one
// user's live rows, together with its arguments.
//
// Every path that lists transactions goes through here, so the page of days,
// the count of days and the rows themselves necessarily agree on what matches.
// The plpgsql function this replaces spelled the same filter list out twice and
// had to be kept in step by hand.
//
// The fragment names columns unqualified, so it reads the same whether it is
// applied to the transactions table directly or inside a CTE selecting from it.
func transactionFilters(userId uuid.UUID, filters schemas.ListTransactionsFilters) (string, []any) {
	conditions := []string{"user_id = ?", "deleted_at IS NULL"}
	args := []any{userId}

	if filters.Type != "" {
		conditions = append(conditions, "type = ?")
		args = append(args, filters.Type)
	}

	// An unescaped LIKE, as in Python: % and _ in the search term stay
	// wildcards rather than matching themselves.
	if filters.Search != "" {
		conditions = append(conditions, "lower(title) LIKE ?")
		args = append(args, "%"+strings.ToLower(filters.Search)+"%")
	}

	// A single date column is what makes these two plain comparisons. Python
	// stores the day in three integer parts, so every range filter there has to
	// rebuild the date with make_date() before it can compare it.
	if filters.FromDate != nil {
		conditions = append(conditions, "date >= ?")
		args = append(args, *filters.FromDate)
	}
	if filters.ToDate != nil {
		conditions = append(conditions, "date <= ?")
		args = append(args, *filters.ToDate)
	}

	if len(filters.CategoryIds) > 0 {
		conditions = append(conditions, "category_id IN ?")
		args = append(args, filters.CategoryIds)
	}
	if len(filters.AccountIds) > 0 {
		conditions = append(conditions, "account_id IN ?")
		args = append(args, filters.AccountIds)
	}

	return strings.Join(conditions, " AND "), args
}

// TransactionRow is one row of the list query: a transaction with its category
// and account joined in, the rate that localizes it, and the total day count
// every row repeats.
//
// The category and account columns are nullable because the transaction's own
// columns are. TargetCurrency is the same on every row; it travels per row
// because that is what lets the whole listing be one statement.
//
// TotalDays is the listing's day count, repeated on every row. The single
// transaction fetch does not select it and leaves it zero, which is why the
// listing reads it from a row rather than the other way round.
type TransactionRow struct {
	TotalDays      int64
	TargetCurrency string

	Id          *uuid.UUID
	Date        *time.Time
	Type        *string
	Title       *string
	Description *string
	Value       *decimal.Decimal
	Currency    *string

	// Rate converts Currency into TargetCurrency on this transaction's own
	// date. It is NULL when the two currencies are the same, and when no rate
	// has ever been recorded for the pair.
	Rate *decimal.Decimal

	CategoryId       *int
	CategoryName     *string
	CategoryIcon     *string
	CategoryHexColor *string

	AccountId          *uuid.UUID
	AccountName        *string
	AccountDescription *string
	AccountCurrency    *string
	AccountColorHex    *string
}

// Transaction rebuilds the model the row was flattened from.
func (row TransactionRow) Transaction() models.Transaction {
	transaction := models.Transaction{
		BaseModel: models.BaseModel{Id: *row.Id},
		Date:      *row.Date,
		Type:      *row.Type,
		Title:     *row.Title,
		Value:     *row.Value,
		Currency:  *row.Currency,

		Description: row.Description,
		CategoryId:  row.CategoryId,
		AccountId:   row.AccountId,
	}

	if row.CategoryId != nil {
		transaction.Category = &models.Category{
			Id:       *row.CategoryId,
			Name:     derefString(row.CategoryName),
			Icon:     derefString(row.CategoryIcon),
			HexColor: derefString(row.CategoryHexColor),
		}
	}

	if row.AccountId != nil {
		transaction.Account = &models.Account{
			BaseModel:   models.BaseModel{Id: *row.AccountId},
			Name:        derefString(row.AccountName),
			Description: row.AccountDescription,
			Currency:    derefString(row.AccountCurrency),
			ColorHex:    derefString(row.AccountColorHex),
		}
	}

	return transaction
}

func derefString(value *string) string {
	if value == nil {
		return ""
	}

	return *value
}

// transactionColumns is the projection every read of a transaction shares: the
// transaction itself, the category and account joined onto it, the currency it
// is being localized into, and the rate that does it.
//
// It is one string rather than two copies because the columns have to line up
// with TransactionRow's fields, and a projection that drifts from the struct
// fails by silently scanning a zero rather than by not compiling.
const transactionColumns = `
	target.currency                 AS target_currency,
	t.id                            AS id,
	t.date                          AS date,
	t.type                          AS type,
	t.title                         AS title,
	t.description                   AS description,
	t.value                         AS value,
	t.currency                      AS currency,
	rate.rate                       AS rate,
	c.id                            AS category_id,
	c.name                          AS category_name,
	c.icon                          AS category_icon,
	c.hex_color                     AS category_hex_color,
	a.id                            AS account_id,
	a.name                          AS account_name,
	a.description                   AS account_description,
	a.currency                      AS account_currency,
	a.color_hex                     AS account_color_hex`

// transactionJoins attaches the category, the account and the rate to a
// transaction already in scope as t, with the user's currency as target.
//
// The rate is resolved per transaction rather than per day: a transaction needs
// exactly one rate — its own currency into the user's, on its own date — which
// is a single index descent against idx_currency_rates_to_from_date. Resolving
// a whole day's rate table instead reads every currency the fetcher has ever
// recorded, nearly all of which the response never mentions.
//
// The currency guard sits inside the subquery rather than in the lateral's ON
// clause. A LEFT JOIN LATERAL runs its subquery for every outer row and only
// then applies ON, so a guard there filters the result without preventing the
// work: a transaction already denominated in the user's own currency would ask
// for a pair like uah -> uah, which the fetcher never records, and proving that
// absence reads the whole rate history. Inside the WHERE it becomes a one-time
// filter and the scan is never executed. Either way rate.rate comes back NULL
// for those rows, which is what the caller expects.
const transactionJoins = `
LEFT JOIN categories c ON c.id = t.category_id
LEFT JOIN accounts a ON a.id = t.account_id
LEFT JOIN LATERAL (
	SELECT r.rate
	FROM currency.currency_rates r
	WHERE t.currency IS DISTINCT FROM target.currency
	  AND r."to" = target.currency AND r."from" = t.currency AND r.date <= t.date
	ORDER BY r.date DESC
	LIMIT 1
) rate ON true`

// listTransactionsSQL is the whole listing in one statement.
//
// Read from the bottom up: total is a one-row CTE, so the outer FROM always
// produces at least one row and the day count survives a page past the end of
// the data — where there are no transactions to carry it. Everything below days
// is therefore a LEFT JOIN, and a row with a NULL id means "no transactions
// here", not "no such user".
//
// target is CROSS JOINed rather than left joined on purpose: an unknown user id
// collapses the result to zero rows, which is the one signal the caller needs
// that it is not looking at an empty page.
const listTransactionsSQL = `
WITH matched AS (
	SELECT * FROM transactions WHERE %s
), distinct_days AS (
	SELECT DISTINCT date FROM matched
), total AS (
	SELECT count(*) AS total_days FROM distinct_days
), days AS (
	SELECT date FROM distinct_days ORDER BY date DESC LIMIT ? OFFSET ?
), target AS (
	SELECT currency FROM users WHERE id = ? AND deleted_at IS NULL
)
SELECT
	total.total_days                AS total_days,` + transactionColumns + `
FROM total
CROSS JOIN target
LEFT JOIN days d ON true
LEFT JOIN matched t ON t.date = d.date` + transactionJoins + `
ORDER BY t.date DESC, t.created_at DESC, t.id DESC`

// getTransactionSQL is one transaction with everything the response needs.
//
// Same shape as the listing without the paging: the transaction, its category
// and account, and the rate for its own date — a transaction is worth what it
// was worth on the day it happened, not what it would be worth today.
//
// Both a transaction that is not the user's and a user that does not exist
// produce no rows, which is the same gorm.ErrRecordNotFound the separate lookups
// they replace each raised, and the same 404 the controller already answers.
const getTransactionSQL = `
WITH target AS (
	SELECT currency FROM users WHERE id = ? AND deleted_at IS NULL
)
SELECT` + transactionColumns + `
FROM transactions t
CROSS JOIN target` + transactionJoins + `
WHERE t.id = ? AND t.user_id = ? AND t.deleted_at IS NULL`

// transactionsOnDateSQL is one day's transactions, in the order the day is
// rendered: most recently recorded first.
//
// A day the user has nothing on, and a user that does not exist, both produce no
// rows. The caller answers the same way to either, which is what it already did
// — a missing user has no transactions to find.
const transactionsOnDateSQL = `
WITH target AS (
	SELECT currency FROM users WHERE id = ? AND deleted_at IS NULL
)
SELECT` + transactionColumns + `
FROM transactions t
CROSS JOIN target` + transactionJoins + `
WHERE t.user_id = ? AND t.date = ? AND t.deleted_at IS NULL
ORDER BY t.created_at DESC, t.id DESC`

// TransactionsOnDate returns everything the user recorded on one day, localized,
// in a single statement.
func TransactionsOnDate(db *gorm.DB, userId uuid.UUID, date time.Time) ([]TransactionRow, error) {
	var rows []TransactionRow

	err := db.Raw(transactionsOnDateSQL, userId, userId, date).Scan(&rows).Error

	return rows, err
}

// latestTransactionsSQL is the user's most recent transactions, newest first by
// the day the money moved rather than the day the row was written.
const latestTransactionsSQL = `
WITH target AS (
	SELECT currency FROM users WHERE id = ? AND deleted_at IS NULL
)
SELECT` + transactionColumns + `
FROM transactions t
CROSS JOIN target` + transactionJoins + `
WHERE t.user_id = ? AND t.deleted_at IS NULL
ORDER BY t.date DESC, t.created_at DESC, t.id DESC
LIMIT ?`

// LatestTransactions returns the user's most recent transactions, localized, in
// a single statement.
func LatestTransactions(db *gorm.DB, userId uuid.UUID, limit int) ([]TransactionRow, error) {
	var rows []TransactionRow

	err := db.Raw(latestTransactionsSQL, userId, userId, limit).Scan(&rows).Error

	return rows, err
}

// GetTransaction returns one of the user's transactions, localized, in a single
// statement. It replaces a fetch, two preloads, a user lookup and a rate query —
// five round trips for one row.
//
// The write endpoints answer with it, so create and update pay this cost too.
func GetTransaction(db *gorm.DB, userId uuid.UUID, transactionId uuid.UUID) (TransactionRow, error) {
	var rows []TransactionRow

	err := db.Raw(getTransactionSQL, userId, transactionId, userId).Scan(&rows).Error
	if err != nil {
		return TransactionRow{}, err
	}

	if len(rows) == 0 {
		return TransactionRow{}, gorm.ErrRecordNotFound
	}

	return rows[0], nil
}

// ListTransactions returns one page of the user's transactions, newest day
// first and, within a day, most recently recorded first.
//
// Pagination is by day rather than by row, which is what the clients render and
// what the plpgsql list_transactions function did with a temp table of distinct
// dates. The total it returns is therefore a count of days, not of rows.
//
// It is a single statement. The listing used to be six: count the days, page
// the days, fetch the rows, preload the categories, preload the accounts, read
// the user's currency, then resolve the rates. Every one of those is a round
// trip to the database, which is the whole cost of the endpoint whenever the
// database is not next to the process asking.
//
// A user id matching no live user yields no rows at all, and is reported as
// gorm.ErrRecordNotFound — the error the separate user lookup used to raise.
func ListTransactions(
	db *gorm.DB,
	userId uuid.UUID,
	filters schemas.ListTransactionsFilters,
	page int,
	take int,
) ([]TransactionRow, int64, error) {
	where, args := transactionFilters(userId, filters)
	args = append(args, take, (page-1)*take, userId)

	var rows []TransactionRow
	err := db.Raw(strings.Replace(listTransactionsSQL, "%s", where, 1), args...).Scan(&rows).Error
	if err != nil {
		return nil, 0, err
	}

	if len(rows) == 0 {
		return nil, 0, gorm.ErrRecordNotFound
	}

	total := rows[0].TotalDays

	// The single row a page past the end of the data carries the count and
	// nothing else.
	transactions := make([]TransactionRow, 0, len(rows))
	for _, row := range rows {
		if row.Id != nil {
			transactions = append(transactions, row)
		}
	}

	return transactions, total, nil
}
