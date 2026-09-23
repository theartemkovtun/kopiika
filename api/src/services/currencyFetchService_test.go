package services

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"kopiika-api-go/src/core"
)

// serveRates points the RapidAPI client at a local server answering every
// request with the given status and body, and records the last request.
func serveRates(t *testing.T, status int, body string) *http.Request {
	t.Helper()
	seen := &http.Request{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		*seen = *r
		w.WriteHeader(status)
		_, _ = w.Write([]byte(body))
	}))
	t.Cleanup(server.Close)

	previous := rapidAPIBaseURL
	rapidAPIBaseURL = server.URL
	t.Cleanup(func() { rapidAPIBaseURL = previous })

	return seen
}

func TestFetchHistoricalRates(t *testing.T) {
	core.Config.RapidAPIKey = "test-key"
	seen := serveRates(t, http.StatusOK, `{
		"base_currency_code": "USD",
		"rates": {
			"EUR": {"currency_name": "Euro", "rate": "0.8700"},
			"UAH": {"currency_name": "Ukrainian hryvnia", "rate": "44.7100"}
		},
		"status": "success"
	}`)

	rates, err := fetchHistoricalRates(context.Background(), "2026-09-22", "usd", []string{"eur", "uah"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if got := rates["eur"].String(); got != "0.87" {
		t.Errorf("eur rate = %s, want 0.87", got)
	}
	if got := rates["uah"].String(); got != "44.71" {
		t.Errorf("uah rate = %s, want 44.71", got)
	}

	if seen.URL.Path != "/currency/historical/2026-09-22" {
		t.Errorf("path = %s", seen.URL.Path)
	}
	if q := seen.URL.Query(); q.Get("from") != "usd" || q.Get("to") != "eur,uah" || q.Get("amount") != "1" {
		t.Errorf("query = %s", seen.URL.RawQuery)
	}
	if seen.Header.Get("x-rapidapi-key") != "test-key" || seen.Header.Get("x-rapidapi-host") != rapidAPIHost {
		t.Errorf("headers = %v", seen.Header)
	}
}

func TestFetchHistoricalRatesFailures(t *testing.T) {
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
			serveRates(t, tc.status, tc.body)

			_, err := fetchHistoricalRates(context.Background(), "2026-09-22", "usd", []string{"uah"})
			if err == nil || !strings.Contains(err.Error(), tc.wantErr) {
				t.Fatalf("error = %v, want it to contain %q", err, tc.wantErr)
			}
		})
	}
}
