package worker

import (
	"time"

	"github.com/hibiken/asynq"

	"kopiika-api-go/src/core"
	"kopiika-api-go/src/tasks"
)

// shutdownTimeout is how long Shutdown waits for in-flight tasks before
// handing them back to the queue for another worker to retry. It must fit
// inside main's overall shutdown budget.
const shutdownTimeout = 8 * time.Second

// NewServer builds the task processor. Queues are polled by weight, so
// critical tasks get roughly 6 of every 10 slots, not strict precedence.
func NewServer() *asynq.Server {
	return asynq.NewServer(core.RedisOpt, asynq.Config{
		Concurrency: core.Config.WorkerConcurrency,
		Queues: map[string]int{
			tasks.QueueCritical: 6,
			tasks.QueueDefault:  3,
			tasks.QueueLow:      1,
		},
		ShutdownTimeout: shutdownTimeout,
		Logger:          slogLogger{},
	})
}
