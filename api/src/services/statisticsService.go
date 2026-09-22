package services

import (
	"errors"
	"fmt"
	"sort"
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"

	"kopiika-api-go/src/core"
	"kopiika-api-go/src/queries"
	"kopiika-api-go/src/schemas"
)

// maxStatisticsRangeDays caps how long a range may be.
//
// The response carries one entry per day, so the range length is the response
// length and it is a client-supplied number. Python has no cap, which makes
// fromDate=0001-01-01 a request for three and a half million days. Ten years is
// well past anything the clients plot.
const maxStatisticsRangeDays = 3660

// ErrStatisticsRangeTooLarge is returned when the requested range is longer than
// the endpoint will report on day by day.
var ErrStatisticsRangeTooLarge = errors.New("statistics range is too long")

// toStatisticsTransactionSchema rebuilds one of the extremes as the transaction
// schema the rest of the API answers with.
//
// It does not go through CurrencyConverter, which is the one place localization
// happens elsewhere. The query has already converted the amount at the rate for
// the transaction's own date, and the missing-rate case that the converter
// exists to catch is caught once for the whole range, before this is reached.
func toStatisticsTransactionSchema(transaction *queries.StatisticsTransaction, currency string) *schemas.TransactionSchema {
	if transaction == nil {
		return nil
	}

	schema := schemas.TransactionSchema{
		Id:          transaction.Id,
		Date:        transaction.Date,
		Type:        transaction.Type,
		Title:       transaction.Title,
		Description: transaction.Description,
		Amount: schemas.AmountSchema{
			Value:    transaction.Value,
			Currency: transaction.Currency,
		},
		LocalizedAmount: schemas.AmountSchema{
			Value:    transaction.Amount,
			Currency: currency,
		},
		Tags: []string{},
	}

	if transaction.Category != nil {
		category := toCategorySchema(*transaction.Category)
		schema.Category = &category
	}

	if transaction.Account != nil {
		account := toAccountBaseSchema(*transaction.Account)
		schema.Account = &account
	}

	return &schema
}

// GetTransactionsStatistics reports on everything the user recorded between two
// days, inclusive, in their own currency.
//
// It is one database round trip. Python reads the whole range into the process
// — every transaction with its account, category and tags joined on — resolves a
// rate table per day, and folds the result in Python to produce seventeen
// numbers. Here the fold is the query: one pass over the range materializes the
// localized amounts, and the totals, the per-day series, the category and
// account breakdowns and the four extremes are all read off that one pass.
//
// full asks for the expensive half of the response. It costs nothing here —
// every figure comes from the same pass whether or not it is reported — so the
// flag only decides what is returned, which is what keeps the response shape
// constant for the clients that do not set it.
func GetTransactionsStatistics(
	userId uuid.UUID,
	fromDate time.Time,
	toDate time.Time,
	full bool,
) (schemas.TransactionsStatisticsSchema, error) {
	// Whole days, so the difference is exact rather than a rounded duration.
	rangeDays := int64(toDate.Sub(fromDate).Hours() / 24)
	if rangeDays > maxStatisticsRangeDays {
		return schemas.TransactionsStatisticsSchema{}, fmt.Errorf("%w: %d days", ErrStatisticsRangeTooLarge, rangeDays)
	}

	statistics, err := queries.TransactionsStatistics(core.DB, userId, fromDate, toDate)
	if err != nil {
		return schemas.TransactionsStatisticsSchema{}, err
	}

	currency := statistics.TargetCurrency

	// A transaction that cannot be localized would otherwise be counted as
	// nothing, which does not show up as a gap — it shows up as a total that is
	// quietly too small. Every other localized figure in the API fails loudly
	// instead, and so does this one.
	if statistics.Unconvertible > 0 {
		return schemas.TransactionsStatisticsSchema{}, fmt.Errorf(
			"%w: %d transactions in the range have no rate into %s",
			ErrRateUnavailable, statistics.Unconvertible, currency,
		)
	}

	now := time.Now().UTC()
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	previousFromDate, previousToDate := previousPeriodRange(fromDate, toDate, today)

	previousStatistics, err := queries.TransactionsStatistics(core.DB, userId, previousFromDate, previousToDate)
	if err != nil {
		return schemas.TransactionsStatisticsSchema{}, err
	}
	if previousStatistics.Unconvertible > 0 {
		return schemas.TransactionsStatisticsSchema{}, fmt.Errorf(
			"%w: %d transactions in the comparable previous period have no rate into %s",
			ErrRateUnavailable, previousStatistics.Unconvertible, currency,
		)
	}

	amount := func(value decimal.Decimal) schemas.AmountSchema {
		return schemas.AmountSchema{Value: value, Currency: currency}
	}

	// withPreviousPeriodDiff pairs a figure with itself minus the same figure
	// over previousStatistics's range.
	withPreviousPeriodDiff := func(value, previousValue decimal.Decimal) schemas.AmountWithPreviousPeriodDiffSchema {
		return schemas.AmountWithPreviousPeriodDiffSchema{
			AmountSchema:       amount(value),
			PreviousPeriodDiff: value.Sub(previousValue),
		}
	}

	difference := statistics.Income.Sub(statistics.Outcome)
	previousDifference := previousStatistics.Income.Sub(previousStatistics.Outcome)

	response := schemas.TransactionsStatisticsSchema{
		Income:     withPreviousPeriodDiff(statistics.Income, previousStatistics.Income),
		Outcome:    withPreviousPeriodDiff(statistics.Outcome, previousStatistics.Outcome),
		Difference: withPreviousPeriodDiff(difference, previousDifference),

		RangeStatistics:           make([]schemas.DateStatisticsSchema, 0, len(statistics.RangeStatistics)),
		CategoryOutcomeStatistics: make([]schemas.CategoryStatisticsSchema, 0, len(statistics.CategoryOutcomes)),

		// The full-only fields hold the values Python answers with when the
		// request does not ask for them.
		TransactionsPerDay:          decimal.Zero,
		AverageIncome:               amount(decimal.Zero),
		AverageOutcome:              amount(decimal.Zero),
		CategoryOutcomeTransactions: []schemas.CategoryTransactionCountSchema{},
		AccountOutcomeStatistics:    []schemas.AccountStatisticsSchema{},
		AccountOutcomeTransactions:  []schemas.AccountTransactionCountSchema{},
	}

	for _, day := range statistics.RangeStatistics {
		response.RangeStatistics = append(response.RangeStatistics, schemas.DateStatisticsSchema{
			Date:    day.Date,
			Income:  amount(day.Income),
			Outcome: amount(day.Outcome),
		})
	}

	for _, category := range statistics.CategoryOutcomes {
		response.CategoryOutcomeStatistics = append(response.CategoryOutcomeStatistics, schemas.CategoryStatisticsSchema{
			CategorySchema: schemas.CategorySchema{
				Id:       category.Id,
				Name:     category.Name,
				Icon:     category.Icon,
				HexColor: category.HexColor,
			},
			LocalizedAmount: amount(category.Amount),
		})
	}

	if !full {
		return response, nil
	}

	response.TotalTransactions = statistics.TotalTransactions
	response.IncomeTransactions = statistics.IncomeTransactions
	response.OutcomeTransactions = statistics.OutcomeTransactions

	// Days that carried anything over the length of the range. The two ends are
	// both included in the range itself but the divisor is the distance between
	// them, which is what Python divides by; a single-day range divides by zero
	// and is reported as zero rather than as an error.
	if rangeDays > 0 {
		response.TransactionsPerDay = decimal.NewFromInt(statistics.ActiveDays).
			DivRound(decimal.NewFromInt(rangeDays), amountScale)
	}

	if statistics.IncomeTransactions > 0 {
		response.AverageIncome = amount(statistics.Income.DivRound(decimal.NewFromInt(statistics.IncomeTransactions), amountScale))
	}
	if statistics.OutcomeTransactions > 0 {
		response.AverageOutcome = amount(statistics.Outcome.DivRound(decimal.NewFromInt(statistics.OutcomeTransactions), amountScale))
	}

	response.MinIncome = toStatisticsTransactionSchema(statistics.Extremes.MinIncome, currency)
	response.MaxIncome = toStatisticsTransactionSchema(statistics.Extremes.MaxIncome, currency)
	response.MinOutcome = toStatisticsTransactionSchema(statistics.Extremes.MinOutcome, currency)
	response.MaxOutcome = toStatisticsTransactionSchema(statistics.Extremes.MaxOutcome, currency)

	// The counted breakdowns hold the same categories and accounts as the
	// totalled ones — same transactions, same grouping — so they are the same
	// rows put in a different order rather than a second trip to the database.
	// The id breaks ties, which Python leaves to the arbitrary order its query
	// happened to return.
	categoryCounts := append([]queries.CategoryTotals(nil), statistics.CategoryOutcomes...)
	sort.Slice(categoryCounts, func(i, j int) bool {
		if categoryCounts[i].Total != categoryCounts[j].Total {
			return categoryCounts[i].Total > categoryCounts[j].Total
		}
		return categoryCounts[i].Id < categoryCounts[j].Id
	})

	response.CategoryOutcomeTransactions = make([]schemas.CategoryTransactionCountSchema, 0, len(categoryCounts))
	for _, category := range categoryCounts {
		response.CategoryOutcomeTransactions = append(response.CategoryOutcomeTransactions, schemas.CategoryTransactionCountSchema{
			CategorySchema: schemas.CategorySchema{
				Id:       category.Id,
				Name:     category.Name,
				Icon:     category.Icon,
				HexColor: category.HexColor,
			},
			TotalTransactions: category.Total,
		})
	}

	response.AccountOutcomeStatistics = make([]schemas.AccountStatisticsSchema, 0, len(statistics.AccountOutcomes))
	for _, account := range statistics.AccountOutcomes {
		response.AccountOutcomeStatistics = append(response.AccountOutcomeStatistics, schemas.AccountStatisticsSchema{
			AccountBaseSchema: schemas.AccountBaseSchema{
				Id:          account.Id,
				Name:        account.Name,
				Description: account.Description,
				Currency:    account.Currency,
				ColorHex:    account.ColorHex,
			},
			LocalizedAmount: amount(account.Amount),
		})
	}

	accountCounts := append([]queries.AccountTotals(nil), statistics.AccountOutcomes...)
	sort.Slice(accountCounts, func(i, j int) bool {
		if accountCounts[i].Total != accountCounts[j].Total {
			return accountCounts[i].Total > accountCounts[j].Total
		}
		return accountCounts[i].Id.String() < accountCounts[j].Id.String()
	})

	response.AccountOutcomeTransactions = make([]schemas.AccountTransactionCountSchema, 0, len(accountCounts))
	for _, account := range accountCounts {
		response.AccountOutcomeTransactions = append(response.AccountOutcomeTransactions, schemas.AccountTransactionCountSchema{
			AccountBaseSchema: schemas.AccountBaseSchema{
				Id:          account.Id,
				Name:        account.Name,
				Description: account.Description,
				Currency:    account.Currency,
				ColorHex:    account.ColorHex,
			},
			TotalTransactions: account.Total,
		})
	}

	return response, nil
}
