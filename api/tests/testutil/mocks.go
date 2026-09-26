package testutil

import (
	"context"
	"testing"

	"github.com/aws/aws-sdk-go-v2/service/cognitoidentityprovider"
	"github.com/hibiken/asynq"
	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/mock"

	"kopiika-api-go/src/core"
)

// Every third-party service the API calls sits behind an interface global in
// core. Each Use… helper below swaps one for a testify mock for the length of
// the test, and checks on cleanup that every expectation set with On was met.
// A service the test did not mock stays nil, so an unexpected call fails the
// test rather than reaching the real thing.

// MockQueue stands in for the Redis task queue.
type MockQueue struct{ mock.Mock }

func (m *MockQueue) EnqueueContext(ctx context.Context, task *asynq.Task, opts ...asynq.Option) (*asynq.TaskInfo, error) {
	args := m.Called(ctx, task, opts)
	info, _ := args.Get(0).(*asynq.TaskInfo)
	return info, args.Error(1)
}

func (m *MockQueue) Ping() error  { return m.Called().Error(0) }
func (m *MockQueue) Close() error { return m.Called().Error(0) }

// UseQueue points core.Queue at a mock for the length of the test.
func UseQueue(t *testing.T) *MockQueue {
	t.Helper()
	m := &MockQueue{}
	swap(t, &core.Queue, core.TaskQueue(m))
	t.Cleanup(func() { m.AssertExpectations(t) })
	return m
}

// MockCognito stands in for the Cognito user pool.
type MockCognito struct{ mock.Mock }

func (m *MockCognito) ListUsers(ctx context.Context, params *cognitoidentityprovider.ListUsersInput, _ ...func(*cognitoidentityprovider.Options)) (*cognitoidentityprovider.ListUsersOutput, error) {
	args := m.Called(ctx, params)
	out, _ := args.Get(0).(*cognitoidentityprovider.ListUsersOutput)
	return out, args.Error(1)
}

// UseCognito points core.Cognito at a mock for the length of the test.
func UseCognito(t *testing.T) *MockCognito {
	t.Helper()
	m := &MockCognito{}
	swap(t, &core.Cognito, core.CognitoUsers(m))
	t.Cleanup(func() { m.AssertExpectations(t) })
	return m
}

// MockRatesAPI stands in for RapidAPI.
type MockRatesAPI struct{ mock.Mock }

func (m *MockRatesAPI) HistoricalRates(ctx context.Context, day, from string, targets []string) (map[string]decimal.Decimal, error) {
	args := m.Called(ctx, day, from, targets)
	rates, _ := args.Get(0).(map[string]decimal.Decimal)
	return rates, args.Error(1)
}

// UseRatesAPI points core.RatesAPI at a mock for the length of the test.
func UseRatesAPI(t *testing.T) *MockRatesAPI {
	t.Helper()
	m := &MockRatesAPI{}
	swap(t, &core.RatesAPI, core.CurrencyRatesAPI(m))
	t.Cleanup(func() { m.AssertExpectations(t) })
	return m
}

// swap sets a global for the length of the test and restores it after.
func swap[T any](t *testing.T, global *T, value T) {
	t.Helper()
	previous := *global
	*global = value
	t.Cleanup(func() { *global = previous })
}
