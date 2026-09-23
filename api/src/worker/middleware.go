package worker

import (
	"context"
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

// telemetry wraps every task in a span and logs its outcome. A task may run
// hours after it was enqueued, so the enqueuing request is attached as a span
// link rather than a parent.
func telemetry(next asynq.Handler) asynq.Handler {
	return asynq.HandlerFunc(func(ctx context.Context, t *asynq.Task) error {
		taskID, _ := asynq.GetTaskID(ctx)
		queue, _ := asynq.GetQueueName(ctx)
		retry, _ := asynq.GetRetryCount(ctx)

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

		start := time.Now()
		err := next.ProcessTask(ctx, t)
		logAttrs := []any{
			"task_type", t.Type(),
			"task_id", taskID,
			"queue", queue,
			"retry", retry,
			"duration_ms", time.Since(start).Milliseconds(),
		}

		if err != nil {
			span.RecordError(err)
			span.SetStatus(codes.Error, err.Error())
			slog.ErrorContext(ctx, "task failed", append(logAttrs, "error", err)...)
			return err
		}

		slog.InfoContext(ctx, "task processed", logAttrs...)
		return nil
	})
}
