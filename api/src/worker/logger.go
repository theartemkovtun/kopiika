package worker

import (
	"context"
	"fmt"
	"log/slog"
	"os"
)

// slogLogger routes asynq's own logging through slog, so it reaches the same
// stdout and OTel pipelines as the rest of the application.
type slogLogger struct{}

func (slogLogger) Debug(args ...any) { logAt(slog.LevelDebug, args) }
func (slogLogger) Info(args ...any)  { logAt(slog.LevelInfo, args) }
func (slogLogger) Warn(args ...any)  { logAt(slog.LevelWarn, args) }
func (slogLogger) Error(args ...any) { logAt(slog.LevelError, args) }

// Fatal is only called by asynq on unrecoverable startup errors, and its
// contract is that the process exits.
func (slogLogger) Fatal(args ...any) {
	logAt(slog.LevelError, args)
	os.Exit(1)
}

func logAt(level slog.Level, args []any) {
	slog.Default().Log(context.Background(), level, fmt.Sprint(args...), "component", "asynq")
}
