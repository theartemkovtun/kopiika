package tasks

import (
	"context"
	"log/slog"

	"github.com/hibiken/asynq"
)

// TypeSystemPing is a no-op task that only logs. It exists to prove the
// queue, worker and scheduler are wired up; remove it once a real task lands.
const TypeSystemPing = "system:ping"

type SystemPingPayload struct {
	Message string `json:"message"`
}

func NewSystemPingTask(payload SystemPingPayload) (*asynq.Task, error) {
	return NewTask(TypeSystemPing, payload)
}

// SystemPingHandler takes no dependencies. A task that calls a service takes
// the service function as an argument instead, e.g.
// BudgetRolloverHandler(rollover func(context.Context) error), and
// worker.NewMux passes it in.
func SystemPingHandler() asynq.HandlerFunc {
	return func(ctx context.Context, t *asynq.Task) error {
		payload, err := Decode[SystemPingPayload](t)
		if err != nil {
			return err
		}

		slog.InfoContext(ctx, "pong", "message", payload.Message)
		return nil
	}
}
