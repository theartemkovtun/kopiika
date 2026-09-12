package services

import (
	"strings"
	"time"

	"kopiika-api-go/src/core"
	"kopiika-api-go/src/models"
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

// NewCurrencyConvertersForDates resolves one converter per date, each holding
// the freshest rates into targetCurrency recorded on or before its own date.
//
// It is one query for the whole set rather than one per date. The list and
// statistics endpoints convert every transaction at the rate for the day it
// happened on, so a page showing a month of spending would otherwise issue a
// query per day on screen.
//
// The returned map is keyed by the date in DateLayout form and has an entry for
// every date asked for, even one with no rates at all — a converter with no
// rates reports that it cannot convert, which is what the caller needs to hear.
func NewCurrencyConvertersForDates(dates []time.Time, targetCurrency string) (map[string]CurrencyConverter, error) {
	target := normalizeCurrency(targetCurrency)
	converters := map[string]CurrencyConverter{}

	days := make([]string, 0, len(dates))
	for _, date := range dates {
		day := date.Format(dateLayout)
		if _, seen := converters[day]; seen {
			continue
		}

		converters[day] = CurrencyConverter{target: target, rates: map[string]decimal.Decimal{}}
		days = append(days, day)
	}

	if len(days) == 0 {
		return converters, nil
	}

	var rows []struct {
		Day          time.Time
		FromCurrency string
		Rate         decimal.Decimal
	}

	// DISTINCT ON picks the newest rate at or before each day, per source
	// currency — the same rule NewCurrencyConverter applies to a single date,
	// spread across the whole set in one pass.
	err := core.DB.Raw(`
		SELECT DISTINCT ON (d.day, r."from")
			d.day AS day,
			r."from" AS from_currency,
			r.rate AS rate
		FROM (SELECT day::date AS day FROM string_to_table(?, ',') AS day) d
		JOIN currency.currency_rates r ON r."to" = ? AND r.date <= d.day
		ORDER BY d.day, r."from", r.date DESC`,
		strings.Join(days, ","), target,
	).Scan(&rows).Error
	if err != nil {
		return converters, err
	}

	for _, row := range rows {
		if converter, ok := converters[row.Day.Format(dateLayout)]; ok {
			converter.rates[row.FromCurrency] = row.Rate
		}
	}

	return converters, nil
}

// convertersForUserOnDates resolves the rates into the user's own currency as
// they stood on each of the given dates.
func convertersForUserOnDates(userId uuid.UUID, dates []time.Time) (map[string]CurrencyConverter, error) {
	var user models.User
	if err := core.DB.First(&user, "id = ? AND deleted_at IS NULL", userId).Error; err != nil {
		return nil, err
	}

	return NewCurrencyConvertersForDates(dates, user.Currency)
}
