package schemas

import "github.com/shopspring/decimal"

// CurrencyRateSchema is one day's conversion factor between two currencies.
// Codes are lower case, as stored.
type CurrencyRateSchema struct {
	Date         string          `json:"date" example:"2026-09-12"`
	FromCurrency string          `json:"from" example:"usd"`
	ToCurrency   string          `json:"to" example:"uah"`
	Rate         decimal.Decimal `json:"rate" swaggertype:"string" example:"44.5256"`
}
