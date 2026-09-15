package services

import (
	"testing"
	"time"
)

func mustDate(t *testing.T, value string) time.Time {
	t.Helper()
	parsed, err := time.Parse("2006-01-02", value)
	if err != nil {
		t.Fatalf("invalid date %q: %v", value, err)
	}
	return parsed
}

func TestPreviousPeriodRange(t *testing.T) {
	cases := []struct {
		name                     string
		fromDate, toDate, today  string
		wantFromDate, wantToDate string
	}{
		{
			name:         "fallback: immediately preceding block of the same length",
			fromDate:     "2026-09-05",
			toDate:       "2026-09-15",
			today:        "2026-09-15",
			wantFromDate: "2026-08-25",
			wantToDate:   "2026-09-04",
		},
		{
			name:         "full calendar month",
			fromDate:     "2026-09-01",
			toDate:       "2026-09-30",
			today:        "2026-09-30",
			wantFromDate: "2026-08-01",
			wantToDate:   "2026-08-31",
		},
		{
			name:         "full calendar month, previous month shorter",
			fromDate:     "2026-03-01",
			toDate:       "2026-03-31",
			today:        "2026-03-31",
			wantFromDate: "2026-02-01",
			wantToDate:   "2026-02-28",
		},
		{
			name:         "full calendar year",
			fromDate:     "2026-01-01",
			toDate:       "2026-12-31",
			today:        "2026-12-31",
			wantFromDate: "2025-01-01",
			wantToDate:   "2025-12-31",
		},
		{
			name:         "current month to date",
			fromDate:     "2026-09-01",
			toDate:       "2026-09-15",
			today:        "2026-09-15",
			wantFromDate: "2026-08-01",
			wantToDate:   "2026-08-15",
		},
		{
			name:         "current month to date, day clamped in shorter previous month",
			fromDate:     "2026-03-01",
			toDate:       "2026-03-30",
			today:        "2026-03-30",
			wantFromDate: "2026-02-01",
			wantToDate:   "2026-02-28",
		},
		{
			name:         "last day of month prefers the full-month comparison over the clamped to-date one",
			fromDate:     "2026-05-01",
			toDate:       "2026-05-31",
			today:        "2026-05-31",
			wantFromDate: "2026-04-01",
			wantToDate:   "2026-04-30",
		},
		{
			name:         "current year to date",
			fromDate:     "2026-01-01",
			toDate:       "2026-09-15",
			today:        "2026-09-15",
			wantFromDate: "2025-01-01",
			wantToDate:   "2025-09-15",
		},
		{
			name:         "current year to date, Feb 29 clamped in non-leap previous year",
			fromDate:     "2028-01-01",
			toDate:       "2028-02-29",
			today:        "2028-02-29",
			wantFromDate: "2027-01-01",
			wantToDate:   "2027-02-28",
		},
		{
			name:         "fallback: single day range",
			fromDate:     "2026-09-15",
			toDate:       "2026-09-15",
			today:        "2026-09-15",
			wantFromDate: "2026-09-14",
			wantToDate:   "2026-09-14",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			fromDate := mustDate(t, tc.fromDate)
			toDate := mustDate(t, tc.toDate)
			today := mustDate(t, tc.today)

			gotFromDate, gotToDate := previousPeriodRange(fromDate, toDate, today)

			wantFromDate := mustDate(t, tc.wantFromDate)
			wantToDate := mustDate(t, tc.wantToDate)

			if !gotFromDate.Equal(wantFromDate) {
				t.Errorf("fromDate = %s, want %s", gotFromDate.Format("2006-01-02"), wantFromDate.Format("2006-01-02"))
			}
			if !gotToDate.Equal(wantToDate) {
				t.Errorf("toDate = %s, want %s", gotToDate.Format("2006-01-02"), wantToDate.Format("2006-01-02"))
			}
		})
	}
}
