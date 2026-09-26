package testutil

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"kopiika-api-go/src/schemas"
)

// MustDate parses a date in the API's wire format, failing the test on a typo.
func MustDate(t *testing.T, value string) time.Time {
	t.Helper()
	parsed, err := time.Parse(schemas.DateLayout, value)
	require.NoError(t, err, "invalid date %q", value)
	return parsed
}
