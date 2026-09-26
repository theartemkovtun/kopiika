// Package services_test tests src/services through its exported API, against
// the package's own Postgres container.
package services_test

import (
	"os"
	"testing"

	"kopiika-api-go/tests/testutil"
)

func TestMain(m *testing.M) {
	os.Exit(testutil.Run(m))
}
