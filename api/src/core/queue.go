package core

import (
	"context"
	"errors"
	"fmt"

	"github.com/hibiken/asynq"
)

// RedisOpt is the parsed REDIS_URL, shared by the task client, the worker
// server and the scheduler so all three talk to the same Redis.
var RedisOpt asynq.RedisConnOpt

// Queue enqueues background tasks. Code outside core goes through
// tasks.Enqueue rather than calling it directly.
var Queue *asynq.Client

func InitQueue() error {
	opt, err := asynq.ParseRedisURI(Config.RedisUrl)
	if err != nil {
		return fmt.Errorf("failed to parse REDIS_URL: %w", err)
	}

	RedisOpt = opt
	Queue = asynq.NewClient(opt)

	if err := Queue.Ping(); err != nil {
		return fmt.Errorf("failed to connect to redis: %w", err)
	}

	return nil
}

// PingQueue verifies the Redis connection behind the task queue is usable.
func PingQueue(ctx context.Context) error {
	if Queue == nil {
		return errors.New("queue not initialized")
	}

	// asynq's Ping takes no context, so the deadline is enforced here.
	done := make(chan error, 1)
	go func() { done <- Queue.Ping() }()

	select {
	case err := <-done:
		if err != nil {
			return fmt.Errorf("redis ping failed: %w", err)
		}
		return nil
	case <-ctx.Done():
		return fmt.Errorf("redis ping failed: %w", ctx.Err())
	}
}

func CloseQueue() error {
	if Queue == nil {
		return nil
	}
	return Queue.Close()
}
