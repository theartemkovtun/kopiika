package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"slices"
	"time"

	"github.com/hibiken/asynq"
	"github.com/shopspring/decimal"

	"kopiika-api-go/src/core"
	"kopiika-api-go/src/schemas"
	"kopiika-api-go/src/tasks"
)

// fetchedCurrencies are the currencies rates are recorded between: every
// ordered pair of them, once a day.
var fetchedCurrencies = []string{"usd", "uah", "eur", "gbp", "pln"}

// currencyRateRecord is one element of the JSON array
// currency.add_currency_rates takes.
type currencyRateRecord struct {
	Date string          `json:"date"`
	From string          `json:"from"`
	To   string          `json:"to"`
	Rate decimal.Decimal `json:"rate"`
}

// FetchCurrencyRates downloads the rates between every pair of
// fetchedCurrencies for the given day and stores them. Storing is an upsert
// on (date, from, to), so running it again for the same day, as a retry does,
// replaces that day's rates rather than duplicating them.
func FetchCurrencyRates(ctx context.Context, date time.Time) error {
	day := date.Format(dateLayout)
	records := make([]currencyRateRecord, 0, len(fetchedCurrencies)*(len(fetchedCurrencies)-1))

	for _, from := range fetchedCurrencies {
		targets := slices.DeleteFunc(slices.Clone(fetchedCurrencies), func(c string) bool { return c == from })
		rates, err := core.RatesAPI.HistoricalRates(ctx, day, from, targets)
		if err != nil {
			return err
		}

		for _, to := range targets {
			rate, ok := rates[to]
			if !ok {
				slog.WarnContext(ctx, "currency rate missing from response", "date", day, "from", from, "to", to)
				continue
			}
			records = append(records, currencyRateRecord{Date: day, From: from, To: to, Rate: rate})
		}
	}

	request, err := json.Marshal(records)
	if err != nil {
		return fmt.Errorf("failed to encode currency rates: %w", err)
	}

	if err := core.DB.WithContext(ctx).Exec("SELECT currency.add_currency_rates(?::json)", string(request)).Error; err != nil {
		return fmt.Errorf("failed to store currency rates for %s: %w", day, err)
	}

	slog.InfoContext(ctx, "currency rates stored", "date", day, "count", len(records))
	return nil
}

// ErrCurrencyRatesDateInFuture is a fetch asked for a day that has not
// started yet by the time it would run, so there are no rates to fetch.
var ErrCurrencyRatesDateInFuture = errors.New("currency rates date is in the future")

// ErrCurrencyRatesFetchQueued is a fetch asked for a day that already has one
// waiting to run or being retried.
var ErrCurrencyRatesFetchQueued = errors.New("currency rates fetch already queued")

// EnqueueCurrencyRatesFetch queues FetchCurrencyRates for the given day, to
// run at processAt or, when it is nil, as soon as a worker is free.
//
// The task id is derived from the day, so a second request for a day whose
// fetch has not finished yet is refused rather than queued alongside it; once
// it has finished, the day can be fetched again.
func EnqueueCurrencyRatesFetch(ctx context.Context, date time.Time, processAt *time.Time) (schemas.CurrencyRatesFetchSchema, error) {
	day := date.Format(dateLayout)

	runAt := time.Now()
	if processAt != nil {
		runAt = *processAt
	}
	if day > runAt.UTC().Format(dateLayout) {
		return schemas.CurrencyRatesFetchSchema{}, ErrCurrencyRatesDateInFuture
	}

	task, err := tasks.NewCurrencyFetchRatesTask(tasks.CurrencyFetchRatesPayload{Date: day})
	if err != nil {
		return schemas.CurrencyRatesFetchSchema{}, err
	}

	opts := append(tasks.CurrencyFetchRatesOptions(), asynq.TaskID(tasks.TypeCurrencyFetchRates+":"+day))
	if processAt != nil {
		opts = append(opts, asynq.ProcessAt(*processAt))
	}

	info, err := tasks.Enqueue(ctx, task, opts...)
	if errors.Is(err, asynq.ErrTaskIDConflict) {
		return schemas.CurrencyRatesFetchSchema{}, ErrCurrencyRatesFetchQueued
	}
	if err != nil {
		return schemas.CurrencyRatesFetchSchema{}, err
	}

	return schemas.CurrencyRatesFetchSchema{
		TaskID:    info.ID,
		Date:      day,
		ProcessAt: info.NextProcessAt.UTC(),
	}, nil
}
