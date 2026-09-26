package services_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/hibiken/asynq"
	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"kopiika-api-go/src/core"
	"kopiika-api-go/src/models"
	"kopiika-api-go/src/services"
	"kopiika-api-go/tests/testutil"
)

// fetchedCurrencies mirrors the currencies FetchCurrencyRates records.
var fetchedCurrencies = []string{"usd", "uah", "eur", "gbp", "pln"}

// ratesFrom is a response holding one rate from a currency into each of the
// others, numbered so every stored pair can be told apart.
func ratesFrom(from string, skip ...string) map[string]decimal.Decimal {
	rates := map[string]decimal.Decimal{}
	for i, to := range fetchedCurrencies {
		if to != from && !contains(skip, to) {
			rates[to] = decimal.NewFromInt(int64(i + 1))
		}
	}
	return rates
}

func contains(values []string, value string) bool {
	for _, v := range values {
		if v == value {
			return true
		}
	}
	return false
}

func storedRates(t *testing.T, day string) map[string]string {
	t.Helper()
	var rows []models.CurrencyRate
	require.NoError(t, core.DB.Where("date = ?", day).Find(&rows).Error)

	stored := map[string]string{}
	for _, row := range rows {
		stored[row.FromCurrency+"->"+row.ToCurrency] = row.Rate.String()
	}
	return stored
}

func TestFetchCurrencyRates(t *testing.T) {
	testutil.UseDB(t)
	rates := testutil.UseRatesAPI(t)

	for _, from := range fetchedCurrencies {
		response := ratesFrom(from)
		if from == "usd" {
			// A pair missing from the response is skipped, not stored as zero.
			response = ratesFrom(from, "pln")
		}
		rates.On("HistoricalRates", mock.Anything, "2026-09-22", from, mock.Anything).
			Return(response, nil).Once()
	}

	require.NoError(t, services.FetchCurrencyRates(context.Background(), testutil.MustDate(t, "2026-09-22")))

	stored := storedRates(t, "2026-09-22")
	assert.Len(t, stored, 19, "every ordered pair but usd->pln")
	assert.Equal(t, "2", stored["usd->uah"])
	assert.Equal(t, "1", stored["uah->usd"])
	assert.NotContains(t, stored, "usd->pln")
}

func TestFetchCurrencyRatesAPIError(t *testing.T) {
	testutil.UseDB(t)
	rates := testutil.UseRatesAPI(t)

	rates.On("HistoricalRates", mock.Anything, "2026-09-22", "usd", mock.Anything).
		Return(nil, errors.New("rate limited")).Once()

	err := services.FetchCurrencyRates(context.Background(), testutil.MustDate(t, "2026-09-22"))
	require.ErrorContains(t, err, "rate limited")
	assert.Empty(t, storedRates(t, "2026-09-22"), "nothing is stored when a request fails")
}

func TestEnqueueCurrencyRatesFetch(t *testing.T) {
	queue := testutil.UseQueue(t)
	processAt := time.Date(2026, 9, 23, 12, 0, 0, 0, time.UTC)

	queue.On("EnqueueContext", mock.Anything, mock.MatchedBy(func(task *asynq.Task) bool {
		return task.Type() == "currency:fetch_rates" && string(task.Payload()) == `{"date":"2026-09-22"}`
	}), mock.Anything).
		Return(&asynq.TaskInfo{ID: "currency:fetch_rates:2026-09-22", NextProcessAt: processAt}, nil).Once()

	fetch, err := services.EnqueueCurrencyRatesFetch(context.Background(), testutil.MustDate(t, "2026-09-22"), &processAt)
	require.NoError(t, err)

	assert.Equal(t, "currency:fetch_rates:2026-09-22", fetch.TaskID)
	assert.Equal(t, "2026-09-22", fetch.Date)
	assert.Equal(t, processAt, fetch.ProcessAt)
}

func TestEnqueueCurrencyRatesFetchAlreadyQueued(t *testing.T) {
	queue := testutil.UseQueue(t)

	queue.On("EnqueueContext", mock.Anything, mock.Anything, mock.Anything).
		Return(nil, asynq.ErrTaskIDConflict).Once()

	_, err := services.EnqueueCurrencyRatesFetch(context.Background(), testutil.MustDate(t, "2026-09-22"), nil)
	assert.ErrorIs(t, err, services.ErrCurrencyRatesFetchQueued)
}

func TestEnqueueCurrencyRatesFetchInFuture(t *testing.T) {
	testutil.UseQueue(t) // no expectations: the queue must not be called

	tomorrow := time.Now().UTC().AddDate(0, 0, 1)
	_, err := services.EnqueueCurrencyRatesFetch(context.Background(), tomorrow, nil)
	assert.ErrorIs(t, err, services.ErrCurrencyRatesDateInFuture)
}
