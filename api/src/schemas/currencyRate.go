package schemas

import (
	"time"

	"github.com/shopspring/decimal"
)

// CurrencyRateSchema is one day's conversion factor between two currencies.
// Codes are lower case, as stored.
type CurrencyRateSchema struct {
	Date         string          `json:"date" example:"2026-09-12"`
	FromCurrency string          `json:"from" example:"usd"`
	ToCurrency   string          `json:"to" example:"uah"`
	Rate         decimal.Decimal `json:"rate" swaggertype:"string" example:"44.5256"`
}

// FetchCurrencyRatesSchema asks for one day's rates to be fetched in the
// background. Without processAt the fetch runs as soon as a worker is free.
type FetchCurrencyRatesSchema struct {
	Date      string     `json:"date" binding:"required,datetime=2006-01-02" example:"2026-09-12"`
	ProcessAt *time.Time `json:"processAt" example:"2026-09-23T12:00:00Z"`
}

// CurrencyRatesFetchSchema is a fetch that has been queued: the task that will
// run it and when it is due to.
type CurrencyRatesFetchSchema struct {
	TaskID    string    `json:"taskId" example:"currency:fetch_rates:2026-09-12"`
	Date      string    `json:"date" example:"2026-09-12"`
	ProcessAt time.Time `json:"processAt" example:"2026-09-23T12:00:00Z"`
}
