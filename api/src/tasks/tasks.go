// Package tasks defines background tasks. Each task has its own file holding
// its type name, payload, constructor and handler; this file holds what they
// share: Enqueue, the queue names and the NewTask / Decode helpers.
//
// Services import this package to enqueue work, so it must not import
// services itself. A handler that needs a service takes the service function
// as an argument, and worker.NewMux passes it in.
package tasks

import (
	"context"
	"encoding/json"
	"fmt"
	"maps"

	"github.com/hibiken/asynq"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/propagation"

	"kopiika-api-go/src/core"
)

// Queue names, highest priority first. The worker weights them in
// worker.NewServer; a task without asynq.Queue(...) goes to QueueDefault.
const (
	QueueCritical = "critical"
	QueueDefault  = "default"
	QueueLow      = "low"
)

// Enqueue schedules a task. Pass asynq.ProcessIn / asynq.ProcessAt to delay
// it, and asynq.Queue, asynq.MaxRetry, asynq.TaskID or asynq.Unique to tune
// routing, retries and de-duplication.
//
// The caller's trace context travels in the task headers, so the worker's
// span links back to the request that enqueued it.
func Enqueue(ctx context.Context, task *asynq.Task, opts ...asynq.Option) (*asynq.TaskInfo, error) {
	headers := make(map[string]string, len(task.Headers()))
	maps.Copy(headers, task.Headers())
	otel.GetTextMapPropagator().Inject(ctx, propagation.MapCarrier(headers))
	task = asynq.NewTaskWithHeaders(task.Type(), task.Payload(), headers)

	info, err := core.Queue.EnqueueContext(ctx, task, opts...)
	if err != nil {
		return nil, fmt.Errorf("failed to enqueue %s: %w", task.Type(), err)
	}
	return info, nil
}

// NewTask builds a task with its payload encoded as JSON. Each task wraps it
// in its own constructor.
func NewTask(taskType string, payload any) (*asynq.Task, error) {
	data, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to encode %s payload: %w", taskType, err)
	}
	return asynq.NewTask(taskType, data), nil
}

// Decode reads a task's JSON payload. A payload that does not decode will not
// decode on a retry either, so the error wraps asynq.SkipRetry.
func Decode[T any](t *asynq.Task) (T, error) {
	var payload T
	if err := json.Unmarshal(t.Payload(), &payload); err != nil {
		return payload, fmt.Errorf("invalid %s payload: %w: %w", t.Type(), err, asynq.SkipRetry)
	}
	return payload, nil
}
