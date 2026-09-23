package tasks

import "github.com/hibiken/asynq"

// TypeSystemPing is a no-op task that only logs. It exists to prove the
// queue, worker and scheduler are wired up; remove it once a real task lands.
const TypeSystemPing = "system:ping"

type SystemPingPayload struct {
	Message string `json:"message"`
}

func NewSystemPingTask(payload SystemPingPayload) (*asynq.Task, error) {
	return newTask(TypeSystemPing, payload)
}
