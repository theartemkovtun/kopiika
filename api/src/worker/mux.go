package worker

import (
	"github.com/hibiken/asynq"

	"kopiika-api-go/src/services"
	"kopiika-api-go/src/tasks"
)

// NewMux maps each task type to its handler. Handlers are defined next to
// their task in src/tasks; this is where services are passed into the ones
// that need them, since src/tasks cannot import services:
//
//	mux.Handle(tasks.TypeCurrencyFetchRates, tasks.CurrencyFetchRatesHandler(services.FetchCurrencyRates))
func NewMux() *asynq.ServeMux {
	mux := asynq.NewServeMux()
	mux.Use(telemetry)

	mux.Handle(tasks.TypeCurrencyFetchRates, tasks.CurrencyFetchRatesHandler(services.FetchCurrencyRates))

	return mux
}
