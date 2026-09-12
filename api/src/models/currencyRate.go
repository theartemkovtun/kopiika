package models

import (
	"time"

	"github.com/shopspring/decimal"
)

// CurrencyRate is one day's conversion factor from one currency to another.
//
// The table lives in the "currency" schema and is written by the
// kopiika-currency-fetch service, not by this API — here it is read-only.
// Because the writer owns the schema, the table is not managed by Atlas
// diffing: see migrations/*_currency_rates.sql for the hand-written DDL.
//
// Currency codes are stored lower case ("uah", "usd"), matching what the
// fetcher writes and what the clients send.
type CurrencyRate struct {
	Date         time.Time       `gorm:"column:date;type:date;primaryKey" json:"date"`
	FromCurrency string          `gorm:"column:from;type:varchar(3);primaryKey" json:"from"`
	ToCurrency   string          `gorm:"column:to;type:varchar(3);primaryKey" json:"to"`
	Rate         decimal.Decimal `gorm:"column:rate;type:numeric;not null" json:"rate"`
}

func (CurrencyRate) TableName() string {
	return "currency.currency_rates"
}
