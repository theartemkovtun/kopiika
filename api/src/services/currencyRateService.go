package services

import (
	"strings"
	"time"

	"kopiika-api-go/src/core"
	"kopiika-api-go/src/models"
	"kopiika-api-go/src/queries"
	"kopiika-api-go/src/schemas"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
)

// dateLayout is the wire format for a date, shared with the response schemas.
const dateLayout = schemas.DateLayout

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

// converterForRow builds a converter holding the one rate the row arrived with:
// its own currency into the user's, at the rate for its own date.
//
// The queries resolve a rate per transaction rather than a rate table per day,
// so every row comes back with exactly the one rate it needs. Wrapping it in a
// converter rather than multiplying it out on the spot keeps every localized
// amount in the API going through the same Convert — including its two edge
// cases, where the source currency is already the target and needs no rate at
// all, and where no rate exists and the amount must be reported as
// unconvertible rather than silently becoming zero.
func converterForRow(row queries.TransactionRow) CurrencyConverter {
	converter := CurrencyConverter{
		target: normalizeCurrency(row.TargetCurrency),
		rates:  map[string]decimal.Decimal{},
	}

	if row.Rate != nil {
		converter.rates[normalizeCurrency(*row.Currency)] = *row.Rate
	}

	return converter
}

// converterForUserOnDate resolves the rates into the user's own currency as they
// stood on the given date.
func converterForUserOnDate(userId uuid.UUID, onOrBefore time.Time) (CurrencyConverter, error) {
	var user models.User
	if err := core.DB.First(&user, "id = ? AND deleted_at IS NULL", userId).Error; err != nil {
		return CurrencyConverter{}, err
	}

	return NewCurrencyConverter(onOrBefore, user.Currency)
}

// converterForUser resolves today's rates into the user's own currency.
func converterForUser(userId uuid.UUID) (CurrencyConverter, error) {
	return converterForUserOnDate(userId, time.Now())
}
