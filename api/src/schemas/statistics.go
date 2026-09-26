package schemas

import (
	"time"

	"github.com/shopspring/decimal"
)

// TransactionsStatisticsQuery is the statistics endpoint's query string. The
// range is required and inclusive at both ends.
//
// Full asks for the expensive half of the response. Python computes the totals,
// the counts, the extremes and the account breakdowns only when it is set, and
// answers with their zero values otherwise; the same fields are held back here.
type TransactionsStatisticsQuery struct {
	FromDate string `form:"fromDate" binding:"required,datetime=2006-01-02" example:"2026-09-01"`
	ToDate   string `form:"toDate" binding:"required,datetime=2006-01-02" example:"2026-09-30"`
	Full     bool   `form:"full" example:"true"`
}

// Range parses the query's two days. The binding tag has already rejected a
// malformed date, so an error here is only reachable by bypassing binding.
func (query TransactionsStatisticsQuery) Range() (time.Time, time.Time, error) {
	fromDate, err := time.Parse(DateLayout, query.FromDate)
	if err != nil {
		return time.Time{}, time.Time{}, err
	}

	toDate, err := time.Parse(DateLayout, query.ToDate)
	if err != nil {
		return time.Time{}, time.Time{}, err
	}

	return fromDate, toDate, nil
}

// DateStatisticsSchema is one day of the range: what came in and what went out,
// both in the user's own currency.
//
// Every day between fromDate and toDate appears, including the ones with no
// transactions, so a client can plot the series without filling gaps itself.
type DateStatisticsSchema struct {
	Date    string       `json:"date" example:"2026-09-12"`
	Income  AmountSchema `json:"income"`
	Outcome AmountSchema `json:"outcome"`
}

// CategoryStatisticsSchema is what one category accounts for across the range.
// The category's own fields are embedded, so the shape matches the category
// everywhere else in the API.
type CategoryStatisticsSchema struct {
	CategorySchema
	LocalizedAmount AmountSchema `json:"localizedAmount"`
}

// CategoryTransactionCountSchema is the same set of categories counted rather
// than totalled, ordered by how often they were used.
type CategoryTransactionCountSchema struct {
	CategorySchema
	TotalTransactions int64 `json:"totalTransactions" example:"12"`
}

// AccountStatisticsSchema is what one account accounts for across the range.
type AccountStatisticsSchema struct {
	AccountBaseSchema
	LocalizedAmount AmountSchema `json:"localizedAmount"`
}

// AccountTransactionCountSchema is the same set of accounts counted rather than
// totalled.
type AccountTransactionCountSchema struct {
	AccountBaseSchema
	TotalTransactions int64 `json:"totalTransactions" example:"12"`
}

// AmountWithPreviousPeriodDiffSchema is a monetary figure alongside how much
// it moved against the comparable period immediately before the requested
// range — see services.PreviousPeriodRange for what "comparable" means for a given
// range.
type AmountWithPreviousPeriodDiffSchema struct {
	AmountSchema
	// PreviousPeriodDiff is this figure minus the same figure over the
	// comparable previous period, in the same currency. Positive means it grew.
	PreviousPeriodDiff decimal.Decimal `json:"previousPeriodDiff" swaggertype:"string" example:"120.50"`
}

// TransactionsStatisticsSchema is the statistics response.
//
// Every monetary figure is in the user's own currency, and every transaction
// behind it was converted at the rate for its own date rather than today's.
//
// The fields below the always-computed block are populated only when the
// request asks for the full statistics; otherwise they hold the zero values
// Python answers with, which is what keeps the response shape constant.
type TransactionsStatisticsSchema struct {
	Income     AmountWithPreviousPeriodDiffSchema `json:"income"`
	Outcome    AmountWithPreviousPeriodDiffSchema `json:"outcome"`
	Difference AmountWithPreviousPeriodDiffSchema `json:"difference"`
	// RangeStatistics covers every day in the range, oldest first.
	RangeStatistics []DateStatisticsSchema `json:"rangeStatistics"`
	// CategoryOutcomeStatistics is spending per category, largest first.
	// Transactions with no category are left out rather than pooled.
	CategoryOutcomeStatistics []CategoryStatisticsSchema `json:"categoryOutcomeStatistics"`

	TotalTransactions   int64 `json:"totalTransactions" example:"42"`
	IncomeTransactions  int64 `json:"incomeTransactions" example:"8"`
	OutcomeTransactions int64 `json:"outcomeTransactions" example:"34"`
	// TransactionsPerDay is how many days of the range carried any activity,
	// divided by the number of days between its two ends. It is a rate, not a
	// count, and it is reported as a string like every other number here.
	TransactionsPerDay decimal.Decimal `json:"transactionsPerDay" swaggertype:"string" example:"0.73"`

	// MinIncome and MaxIncome are the smallest and largest single income of the
	// range, compared on the localized amount. They are null when the range
	// holds no income at all.
	MinIncome     *TransactionSchema `json:"minIncome"`
	MaxIncome     *TransactionSchema `json:"maxIncome"`
	AverageIncome AmountSchema       `json:"averageIncome"`

	MinOutcome     *TransactionSchema `json:"minOutcome"`
	MaxOutcome     *TransactionSchema `json:"maxOutcome"`
	AverageOutcome AmountSchema       `json:"averageOutcome"`

	CategoryOutcomeTransactions []CategoryTransactionCountSchema `json:"categoryOutcomeTransactions"`
	AccountOutcomeStatistics    []AccountStatisticsSchema        `json:"accountOutcomeStatistics"`
	AccountOutcomeTransactions  []AccountTransactionCountSchema  `json:"accountOutcomeTransactions"`
}
