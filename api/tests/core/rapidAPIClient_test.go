package core_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"kopiika-api-go/src/core"
)

// serveRates stands up a local RapidAPI answering every request with the
// given status and body, and returns a client pointed at it along with the
// last request it saw.
func serveRates(t *testing.T, status int, body string) (*core.RapidAPIClient, *http.Request) {
	t.Helper()
	seen := &http.Request{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		*seen = *r
		w.WriteHeader(status)
		_, _ = w.Write([]byte(body))
	}))
	t.Cleanup(server.Close)

	return core.NewRapidAPIClient(server.URL, "test-key", 0), seen
}

func TestRapidAPIClientHistoricalRates(t *testing.T) {
	client, seen := serveRates(t, http.StatusOK, `{
		"base_currency_code": "USD",
		"rates": {
			"EUR": {"currency_name": "Euro", "rate": "0.8700"},
			"UAH": {"currency_name": "Ukrainian hryvnia", "rate": "44.7100"}
		},
		"status": "success"
	}`)

	rates, err := client.HistoricalRates(context.Background(), "2026-09-22", "usd", []string{"eur", "uah"})
	require.NoError(t, err)

	assert.Equal(t, "0.87", rates["eur"].String())
	assert.Equal(t, "44.71", rates["uah"].String())

	assert.Equal(t, "/currency/historical/2026-09-22", seen.URL.Path)
	query := seen.URL.Query()
	assert.Equal(t, "usd", query.Get("from"))
	assert.Equal(t, "eur,uah", query.Get("to"))
	assert.Equal(t, "1", query.Get("amount"))
	assert.Equal(t, "test-key", seen.Header.Get("x-rapidapi-key"))
	assert.Equal(t, "currency-converter5.p.rapidapi.com", seen.Header.Get("x-rapidapi-host"))
}

func TestRapidAPIClientHistoricalRatesFailures(t *testing.T) {
	cases := []struct {
		name    string
		status  int
		body    string
		wantErr string
	}{
		{
			name:    "http error",
			status:  http.StatusTooManyRequests,
			body:    `{"message":"You have exceeded the rate limit per second for your plan"}`,
			wantErr: "rate limited",
		},
		{
			name:    "server error",
			status:  http.StatusBadGateway,
			body:    `upstream unavailable`,
			wantErr: "502",
		},
		{
			name:    "api error",
			status:  http.StatusOK,
			body:    `{"status":"failed","error":{"code":404,"message":"Currency not found"}}`,
			wantErr: "Currency not found",
		},
		{
			name:    "wrong base currency",
			status:  http.StatusOK,
			body:    `{"status":"success","base_currency_code":"EUR","rates":{"UAH":{"rate":"48.1"}}}`,
			wantErr: `got "EUR"`,
		},
		{
			name:    "no rates",
			status:  http.StatusOK,
			body:    `{"status":"success","base_currency_code":"USD","rates":{}}`,
			wantErr: "no rates",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			client, _ := serveRates(t, tc.status, tc.body)

			_, err := client.HistoricalRates(context.Background(), "2026-09-22", "usd", []string{"uah"})
			assert.ErrorContains(t, err, tc.wantErr)
		})
	}
}
