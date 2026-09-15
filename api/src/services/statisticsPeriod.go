package services

import "time"

// startOfMonth is the first day of t's month, at midnight UTC.
func startOfMonth(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), 1, 0, 0, 0, 0, time.UTC)
}

// endOfMonth is the last day of t's month, at midnight UTC.
func endOfMonth(t time.Time) time.Time {
	return startOfMonth(t).AddDate(0, 1, -1)
}

// startOfYear is January 1st of t's year, at midnight UTC.
func startOfYear(t time.Time) time.Time {
	return time.Date(t.Year(), time.January, 1, 0, 0, 0, 0, time.UTC)
}

// endOfYear is December 31st of t's year, at midnight UTC.
func endOfYear(t time.Time) time.Time {
	return time.Date(t.Year(), time.December, 31, 0, 0, 0, 0, time.UTC)
}

// daysInMonth is how many days the given month has.
func daysInMonth(year int, month time.Month) int {
	return time.Date(year, month+1, 0, 0, 0, 0, 0, time.UTC).Day()
}

// addMonthsClamped shifts t by the given number of months, keeping t's day of
// month unless the target month is shorter, in which case it clamps to that
// month's last day rather than overflowing into the month after — which is
// what time.AddDate would do, e.g. Mar 31 minus one month landing on Mar 3
// instead of Feb 28.
func addMonthsClamped(t time.Time, months int) time.Time {
	year, month, day := t.Date()
	total := int(month) - 1 + months
	newYear := year + total/12
	newMonthIndex := total % 12
	if newMonthIndex < 0 {
		newMonthIndex += 12
		newYear--
	}
	newMonth := time.Month(newMonthIndex + 1)
	if last := daysInMonth(newYear, newMonth); day > last {
		day = last
	}
	return time.Date(newYear, newMonth, day, 0, 0, 0, 0, time.UTC)
}

// addYearsClamped shifts t by the given number of years, clamping Feb 29 to
// Feb 28 when the target year is not a leap year.
func addYearsClamped(t time.Time, years int) time.Time {
	year, month, day := t.Date()
	newYear := year + years
	if month == time.February && day == 29 {
		if last := daysInMonth(newYear, time.February); day > last {
			day = last
		}
	}
	return time.Date(newYear, month, day, 0, 0, 0, 0, time.UTC)
}

// previousPeriodRange is the comparable period immediately before
// [fromDate, toDate], for the previousPeriodDiff figures.
//
// A range that is exactly a calendar month or a calendar year compares
// against the same span of the previous month or year, with month/year
// length differences clamped rather than overflowed (e.g. Mar 31 lands on
// Feb 28, not Mar 3). A range that runs from the start of the current month
// or year up to today compares against the same start-to-date span one
// month or year back. Anything else compares against the immediately
// preceding block of the same number of days, ending the day before
// fromDate.
//
// The two whole-period cases are checked first: on the last day of a month
// (or year), a to-date range and a whole-period range describe the same
// days, and the whole-period comparison is the one that lines up length for
// length with the previous period — the to-date comparison would clamp to a
// shorter previous month/year and quietly compare a shorter span.
func previousPeriodRange(fromDate, toDate, today time.Time) (time.Time, time.Time) {
	switch {
	case fromDate.Equal(startOfYear(fromDate)) && toDate.Equal(endOfYear(fromDate)):
		return addYearsClamped(fromDate, -1), addYearsClamped(toDate, -1)

	case fromDate.Equal(startOfMonth(fromDate)) && toDate.Equal(endOfMonth(fromDate)):
		previousStart := addMonthsClamped(fromDate, -1)
		return previousStart, endOfMonth(previousStart)

	case fromDate.Equal(startOfYear(today)) && toDate.Equal(today):
		return addYearsClamped(fromDate, -1), addYearsClamped(toDate, -1)

	case fromDate.Equal(startOfMonth(today)) && toDate.Equal(today):
		return addMonthsClamped(fromDate, -1), addMonthsClamped(toDate, -1)

	default:
		length := toDate.Sub(fromDate)
		previousToDate := fromDate.AddDate(0, 0, -1)
		previousFromDate := previousToDate.Add(-length)
		return previousFromDate, previousToDate
	}
}
