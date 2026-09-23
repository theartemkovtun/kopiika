package worker

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"

	"github.com/hibiken/asynq"

	"kopiika-api-go/src/tasks"
)

// NewMux maps each task type to its handler. Handlers are thin, like
// controllers: decode the payload, call a service, return its error. Return
// an error wrapping asynq.SkipRetry when retrying cannot help, e.g. a payload
// that does not decode.
func NewMux() *asynq.ServeMux {
	mux := asynq.NewServeMux()
	mux.Use(telemetry)

	mux.HandleFunc(tasks.TypeSystemPing, handleSystemPing)

	return mux
}

func handleSystemPing(ctx context.Context, t *asynq.Task) error {
	var payload tasks.SystemPingPayload
	if err := json.Unmarshal(t.Payload(), &payload); err != nil {
		return fmt.Errorf("invalid %s payload: %w: %w", t.Type(), err, asynq.SkipRetry)
	}

	slog.InfoContext(ctx, "pong", "message", payload.Message)
	return nil
}
