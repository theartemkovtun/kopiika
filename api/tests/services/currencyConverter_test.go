package services_test

import (
	"encoding/json"
	"testing"

	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"kopiika-api-go/src/core"
	"kopiika-api-go/src/services"
	"kopiika-api-go/tests/testutil"
)

type seededRate struct {
	Date string `json:"date"`
	From string `json:"from"`
	To   string `json:"to"`
	Rate string `json:"rate"`
}

// seedRates writes rates through currency.add_currency_rates, the same
// function the daily fetch stores them with.
func seedRates(t *testing.T, rates ...seededRate) {
	t.Helper()
	request, err := json.Marshal(rates)
	require.NoError(t, err)
	require.NoError(t, core.DB.Exec("SELECT currency.add_currency_rates(?::json)", string(request)).Error)
}

func TestNewCurrencyConverter(t *testing.T) {
	testutil.UseDB(t)
	seedRates(t,
		seededRate{Date: "2026-09-20", From: "usd", To: "uah", Rate: "41.00"},
		seededRate{Date: "2026-09-22", From: "usd", To: "uah", Rate: "41.50"},
		seededRate{Date: "2026-09-23", From: "usd", To: "uah", Rate: "99.00"},
		seededRate{Date: "2026-09-20", From: "eur", To: "uah", Rate: "48.25"},
	)

	converter, err := services.NewCurrencyConverter(testutil.MustDate(t, "2026-09-22"), "UAH")
	require.NoError(t, err)
	assert.Equal(t, "uah", converter.Target())

	cases := []struct {
		name   string
		amount string
		from   string
		want   string
		wantOK bool
	}{
		{name: "rate on the day, later rates ignored", amount: "10", from: "usd", want: "415", wantOK: true},
		{name: "latest earlier rate when the day has none", amount: "2", from: "eur", want: "96.5", wantOK: true},
		{name: "rounded to two places", amount: "0.333", from: "usd", want: "13.82", wantOK: true},
		{name: "target converts to itself without a rate", amount: "12.345", from: " UAH ", want: "12.35", wantOK: true},
		{name: "unknown currency is unconvertible, not zero", amount: "10", from: "gbp", want: "0", wantOK: false},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, ok := converter.Convert(decimal.RequireFromString(tc.amount), tc.from)
			assert.Equal(t, tc.wantOK, ok)
			assert.Equal(t, tc.want, got.String())
		})
	}
}
