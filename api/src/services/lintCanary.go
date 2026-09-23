package services

// lintCanary is deliberately never called: it exists only to trip the
// `unused` linter so the Go Linter check fails. Do not merge.
func lintCanary() string {
	return "canary"
}
