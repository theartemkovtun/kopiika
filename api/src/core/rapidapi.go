package core

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/shopspring/decimal"
	"golang.org/x/time/rate"
)

const (
	// rapidAPIHost is the currency-converter5 API on RapidAPI. It is both the
	// URL's host and the x-rapidapi-host header, which have to agree.
	rapidAPIHost = "currency-converter5.p.rapidapi.com"

	// rapidAPIInterval spaces requests out, since the RapidAPI plan is rate
	// limited per second.
	rapidAPIInterval = 2 * time.Second

	// rapidAPIAttempts is how many times one request is tried when RapidAPI
	// answers 429. Two fetches running at once, such as a backfill alongside
	// the daily run, trip the per-second limit between them.
	rapidAPIAttempts = 3
)

// CurrencyRatesAPI is the source of daily currency rates, so a test can stand
// in for RapidAPI.
type CurrencyRatesAPI interface {
	// HistoricalRates returns one unit of from in each of targets on the
	// given day, keyed by the lower case target code.
	HistoricalRates(ctx context.Context, day, from string, targets []string) (map[string]decimal.Decimal, error)
}

// RatesAPI fetches currency rates. InitRatesAPI sets it to RapidAPI.
var RatesAPI CurrencyRatesAPI

// InitRatesAPI points RatesAPI at RapidAPI. Only the worker fetches rates.
func InitRatesAPI() {
	RatesAPI = NewRapidAPIClient("https://"+rapidAPIHost, Config.RapidAPIKey, rapidAPIInterval)
}

// RapidAPIClient reads currency-converter5 on RapidAPI.
type RapidAPIClient struct {
	baseURL string
	key     string
	http    *http.Client
	limiter *rate.Limiter
}

// NewRapidAPIClient builds a client that sends at most one request per
// interval, retries included. An interval of zero does not limit at all.
func NewRapidAPIClient(baseURL, key string, interval time.Duration) *RapidAPIClient {
	return &RapidAPIClient{
		baseURL: baseURL,
		key:     key,
		http:    &http.Client{Timeout: 30 * time.Second},
		limiter: rate.NewLimiter(rate.Every(interval), 1),
	}
}

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

// errRateLimited marks a 429 from RapidAPI, the one failure worth retrying
// on the spot.
var errRateLimited = errors.New("rate limited")

// HistoricalRates asks for the day's rates, tried again while RapidAPI
// reports the per-second limit exceeded.
func (c *RapidAPIClient) HistoricalRates(ctx context.Context, day, from string, targets []string) (map[string]decimal.Decimal, error) {
	for attempt := 1; ; attempt++ {
		if err := c.limiter.Wait(ctx); err != nil {
			return nil, err
		}

		rates, err := c.historicalRates(ctx, day, from, targets)
		if !errors.Is(err, errRateLimited) || attempt == rapidAPIAttempts {
			return rates, err
		}
	}
}

func (c *RapidAPIClient) historicalRates(ctx context.Context, day, from string, targets []string) (map[string]decimal.Decimal, error) {
	query := url.Values{}
	query.Set("format", "json")
	query.Set("from", from)
	query.Set("to", strings.Join(targets, ","))
	query.Set("amount", "1")
	endpoint := c.baseURL + "/currency/historical/" + day + "?" + query.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, http.NoBody)
	if err != nil {
		return nil, err
	}
	req.Header.Set("x-rapidapi-host", rapidAPIHost)
	req.Header.Set("x-rapidapi-key", c.key)

	resp, err := c.http.Do(req)
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

	if currencyCode(payload.BaseCurrencyCode) != from {
		return nil, fmt.Errorf("asked for %s rates for %s, got %q", from, day, payload.BaseCurrencyCode)
	}

	if len(payload.Rates) == 0 {
		return nil, fmt.Errorf("fetching %s rates for %s returned no rates", from, day)
	}

	rates := make(map[string]decimal.Decimal, len(payload.Rates))
	for code, entry := range payload.Rates {
		rates[currencyCode(code)] = entry.Rate
	}

	return rates, nil
}

// currencyCode puts a code RapidAPI sends ("EUR") into the lower case form
// the rest of the API uses.
func currencyCode(code string) string {
	return strings.ToLower(strings.TrimSpace(code))
}
