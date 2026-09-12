package services

import (
	"strings"
	"time"

	"kopiika-api-go/src/core"
	"kopiika-api-go/src/models"
	"kopiika-api-go/src/schemas"

	"github.com/shopspring/decimal"
)

// dateLayout is the wire format for a currency rate's date.
const dateLayout = "2006-01-02"

// amountScale is the number of decimal places a localized amount is reported to.
const amountScale = 2

// normalizeCurrency puts a currency code into the canonical form the rates table
// uses. Codes are stored lower case, so a client sending "USD" and one sending
// "usd" have to resolve to the same rate.
func normalizeCurrency(code string) string {
	return strings.ToLower(strings.TrimSpace(code))
}

func toCurrencyRateSchema(rate models.CurrencyRate) schemas.CurrencyRateSchema {
	return schemas.CurrencyRateSchema{
		Date:         rate.Date.Format(dateLayout),
		FromCurrency: rate.FromCurrency,
		ToCurrency:   rate.ToCurrency,
		Rate:         rate.Rate,
	}
}

// GetCurrencyRatesForDates returns every rate recorded on the given dates,
// optionally narrowed to a single target currency. Passing an empty
// toCurrency returns the rates into every currency.
func GetCurrencyRatesForDates(dates []time.Time, toCurrency string) ([]schemas.CurrencyRateSchema, error) {
	result := []schemas.CurrencyRateSchema{}
	if len(dates) == 0 {
		return result, nil
	}

	days := make([]string, 0, len(dates))
	for _, date := range dates {
		days = append(days, date.Format(dateLayout))
	}

	query := core.DB.Model(&models.CurrencyRate{}).Where("date IN ?", days)
	if toCurrency != "" {
		query = query.Where(`"to" = ?`, normalizeCurrency(toCurrency))
	}

	var rates []models.CurrencyRate
	if err := query.Find(&rates).Error; err != nil {
		return result, err
	}

	for _, rate := range rates {
		result = append(result, toCurrencyRateSchema(rate))
	}

	return result, nil
}

// CurrencyConverter converts amounts denominated in any currency into one
// target currency, using a fixed set of rates resolved up front.
type CurrencyConverter struct {
	target string
	rates  map[string]decimal.Decimal
}

// Target is the currency every conversion produces.
func (c CurrencyConverter) Target() string {
	return c.target
}

// Convert returns the amount expressed in the target currency, rounded to two
// decimal places. The second return value is false when no rate is known for
// the source currency, which is the caller's cue that the amount cannot be
// localized rather than that it converts to zero.
func (c CurrencyConverter) Convert(amount decimal.Decimal, from string) (decimal.Decimal, bool) {
	from = normalizeCurrency(from)
	if from == c.target {
		return amount.Round(amountScale), true
	}

	rate, ok := c.rates[from]
	if !ok {
		return decimal.Zero, false
	}

	return amount.Mul(rate).Round(amountScale), true
}

// NewCurrencyConverter resolves the freshest rates into targetCurrency recorded
// on or before the given date, one per source currency.
//
// Python reads only the current day, which means an API request served before
// the fetcher has run leaves every foreign-currency amount unconvertible. Taking
// the most recent rate on or before the date produces the same numbers whenever
// the day's rates are present and degrades to yesterday's when they are not.
func NewCurrencyConverter(onOrBefore time.Time, targetCurrency string) (CurrencyConverter, error) {
	converter := CurrencyConverter{
		target: normalizeCurrency(targetCurrency),
		rates:  map[string]decimal.Decimal{},
	}

	var rates []models.CurrencyRate
	err := core.DB.Raw(`
		SELECT DISTINCT ON ("from") date, "from", "to", rate
		FROM currency.currency_rates
		WHERE "to" = ? AND date <= ?
		ORDER BY "from", date DESC`,
		converter.target, onOrBefore.Format(dateLayout),
	).Scan(&rates).Error
	if err != nil {
		return converter, err
	}

	for _, rate := range rates {
		converter.rates[rate.FromCurrency] = rate.Rate
	}

	return converter, nil
}
