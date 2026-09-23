package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"slices"
	"strings"
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

const (
	// rapidAPIHost is the currency-converter5 API on RapidAPI. It is both the
	// URL's host and the x-rapidapi-host header, which have to agree.
	rapidAPIHost = "currency-converter5.p.rapidapi.com"

	// rapidAPIPause spaces the per-currency requests out, since the RapidAPI
	// plan is rate limited per second.
	rapidAPIPause = 2 * time.Second

	// rapidAPIAttempts is how many times one request is tried when RapidAPI
	// answers 429. Two fetches running at once, such as a backfill alongside
	// the daily run, trip the per-second limit between them.
	rapidAPIAttempts = 3
)

// rapidAPIBaseURL is a variable so a test can point it at a local server.
var rapidAPIBaseURL = "https://" + rapidAPIHost

var rapidAPIClient = &http.Client{Timeout: 30 * time.Second}

// historicalRatesResponse is the part of currency-converter5's
// /currency/historical response that is read. Codes arrive upper case and
// rates as decimal strings, e.g. {"rates": {"EUR": {"rate": "0.8700"}}}.
type historicalRatesResponse struct {
	Status           string `json:"status"`
	BaseCurrencyCode string `json:"base_currency_code"`
	Rates            map[string]struct {
		Rate decimal.Decimal `json:"rate"`
	} `json:"rates"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error"`
}

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

	for i, from := range fetchedCurrencies {
		if i > 0 {
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(rapidAPIPause):
			}
		}

		targets := slices.DeleteFunc(slices.Clone(fetchedCurrencies), func(c string) bool { return c == from })
		rates, err := fetchHistoricalRatesWithRetry(ctx, day, from, targets)
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

// errRateLimited marks a 429 from RapidAPI, the one failure worth retrying
// on the spot.
var errRateLimited = errors.New("rate limited")

// fetchHistoricalRatesWithRetry is fetchHistoricalRates, tried again after a
// pause while RapidAPI reports the per-second limit exceeded.
func fetchHistoricalRatesWithRetry(ctx context.Context, day, from string, targets []string) (map[string]decimal.Decimal, error) {
	for attempt := 1; ; attempt++ {
		rates, err := fetchHistoricalRates(ctx, day, from, targets)
		if !errors.Is(err, errRateLimited) || attempt == rapidAPIAttempts {
			return rates, err
		}

		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-time.After(rapidAPIPause):
		}
	}
}

// fetchHistoricalRates asks for one unit of from in each of targets on the
// given day, keyed by the lower case target code.
func fetchHistoricalRates(ctx context.Context, day, from string, targets []string) (map[string]decimal.Decimal, error) {
	query := url.Values{}
	query.Set("format", "json")
	query.Set("from", from)
	query.Set("to", strings.Join(targets, ","))
	query.Set("amount", "1")
	endpoint := rapidAPIBaseURL + "/currency/historical/" + day + "?" + query.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, http.NoBody)
	if err != nil {
		return nil, err
	}
	req.Header.Set("x-rapidapi-host", rapidAPIHost)
	req.Header.Set("x-rapidapi-key", core.Config.RapidAPIKey)

	resp, err := rapidAPIClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch %s rates for %s: %w", from, day, err)
	}
	defer func() { _ = resp.Body.Close() }()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return nil, fmt.Errorf("failed to read %s rates for %s: %w", from, day, err)
	}

	if resp.StatusCode == http.StatusTooManyRequests {
		return nil, fmt.Errorf("fetching %s rates for %s: %w: %s", from, day, errRateLimited, body)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("fetching %s rates for %s returned %s: %s", from, day, resp.Status, body)
	}

	var payload historicalRatesResponse
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, fmt.Errorf("failed to decode %s rates for %s: %w", from, day, err)
	}

	if payload.Status != "success" {
		message := payload.Status
		if payload.Error != nil {
			message = payload.Error.Message
		}
		return nil, fmt.Errorf("fetching %s rates for %s failed: %s", from, day, message)
	}

	if normalizeCurrency(payload.BaseCurrencyCode) != from {
		return nil, fmt.Errorf("asked for %s rates for %s, got %q", from, day, payload.BaseCurrencyCode)
	}

	if len(payload.Rates) == 0 {
		return nil, fmt.Errorf("fetching %s rates for %s returned no rates", from, day)
	}

	rates := make(map[string]decimal.Decimal, len(payload.Rates))
	for code, rate := range payload.Rates {
		rates[normalizeCurrency(code)] = rate.Rate
	}

	return rates, nil
}
