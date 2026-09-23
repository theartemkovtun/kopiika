package tasks

import (
	"context"
	"fmt"
	"time"

	"github.com/hibiken/asynq"
)

// TypeCurrencyFetchRates downloads a day's currency rates and stores them in
// currency.currency_rates. The cron runs it daily with an empty payload;
// enqueue it with a Date to backfill a missed day.
const TypeCurrencyFetchRates = "currency:fetch_rates"

type CurrencyFetchRatesPayload struct {
	// Date is the day to fetch, as YYYY-MM-DD. Empty means today in UTC,
	// worked out when the task runs rather than when it was enqueued.
	Date string `json:"date,omitempty"`
}

func NewCurrencyFetchRatesTask(payload CurrencyFetchRatesPayload) (*asynq.Task, error) {
	return NewTask(TypeCurrencyFetchRates, payload)
}

func CurrencyFetchRatesHandler(fetch func(context.Context, time.Time) error) asynq.HandlerFunc {
	return func(ctx context.Context, t *asynq.Task) error {
		payload, err := Decode[CurrencyFetchRatesPayload](t)
		if err != nil {
			return err
		}

		date := time.Now().UTC()
		if payload.Date != "" {
			date, err = time.Parse(time.DateOnly, payload.Date)
			if err != nil {
				return fmt.Errorf("invalid %s date %q: %w: %w", t.Type(), payload.Date, err, asynq.SkipRetry)
			}
		}

		return fetch(ctx, date)
	}
}
