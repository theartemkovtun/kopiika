package worker

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/hibiken/asynq"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/trace"
)

var tracer = otel.Tracer("kopiika-worker")

// telemetry wraps every task in a span and logs when it starts and how it
// ended. Each message names the task type so a log line reads on its own; the
// same values are also attached as attributes for filtering. A task may run
// hours after it was enqueued, so the enqueuing request is attached as a span
// link rather than a parent.
func telemetry(next asynq.Handler) asynq.Handler {
	return asynq.HandlerFunc(func(ctx context.Context, t *asynq.Task) error {
		taskID, _ := asynq.GetTaskID(ctx)
		queue, _ := asynq.GetQueueName(ctx)
		retry, _ := asynq.GetRetryCount(ctx)
		maxRetry, _ := asynq.GetMaxRetry(ctx)

		attrs := []attribute.KeyValue{
			attribute.String("task.type", t.Type()),
			attribute.String("task.id", taskID),
			attribute.String("task.queue", queue),
			attribute.Int("task.retry", retry),
		}

		opts := []trace.SpanStartOption{
			trace.WithSpanKind(trace.SpanKindConsumer),
			trace.WithAttributes(attrs...),
		}
		carrier := propagation.MapCarrier(t.Headers())
		enqueuer := trace.SpanContextFromContext(otel.GetTextMapPropagator().Extract(context.Background(), carrier))
		if enqueuer.IsValid() {
			opts = append(opts, trace.WithLinks(trace.Link{SpanContext: enqueuer}))
		}

		ctx, span := tracer.Start(ctx, t.Type(), opts...)
		defer span.End()

		logAttrs := []any{
			"task_type", t.Type(),
			"task_id", taskID,
			"queue", queue,
			"retry", retry,
		}

		attempt := ""
		if retry > 0 {
			attempt = fmt.Sprintf(" (retry %d of %d)", retry, maxRetry)
		}
		slog.InfoContext(ctx, fmt.Sprintf("task %s started%s", t.Type(), attempt), logAttrs...)

		start := time.Now()
		err := next.ProcessTask(ctx, t)
		elapsed := time.Since(start)
		logAttrs = append(logAttrs, "duration_ms", elapsed.Milliseconds())
		took := elapsed.Round(time.Millisecond)

		if err != nil {
			span.RecordError(err)
			span.SetStatus(codes.Error, err.Error())

			outcome := "will be retried"
			if retry >= maxRetry || errors.Is(err, asynq.SkipRetry) {
				outcome = "giving up"
			}
			slog.ErrorContext(ctx, fmt.Sprintf("task %s failed after %s%s, %s: %v", t.Type(), took, attempt, outcome, err),
				append(logAttrs, "error", err)...)
			return err
		}

		slog.InfoContext(ctx, fmt.Sprintf("task %s completed in %s%s", t.Type(), took, attempt), logAttrs...)
		return nil
	})
}
