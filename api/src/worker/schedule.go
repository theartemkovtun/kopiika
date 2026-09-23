package worker

import (
	"fmt"
	"time"

	"github.com/hibiken/asynq"

	"kopiika-api-go/src/core"
)

// periodicTask is one cron entry. Cronspec is a standard five-field
// expression evaluated in UTC ("0 3 * * *" is 03:00 UTC daily), or a
// descriptor such as "@every 30m" or "@daily".
type periodicTask struct {
	Cronspec string
	New      func() (*asynq.Task, error)

	// UniqueFor stops a second copy of the task being enqueued while the first
	// is still pending, e.g. if two scheduler instances run by mistake. Set it
	// a little below the schedule's interval.
	UniqueFor time.Duration

	Opts []asynq.Option
}

// periodicTasks is the cron registry. Each entry's task type also needs a
// handler in NewMux. For example:
//
//	{
//		Cronspec:  "0 3 * * *",
//		New:       func() (*asynq.Task, error) { return tasks.NewSystemPingTask(tasks.SystemPingPayload{Message: "nightly"}) },
//		UniqueFor: 23 * time.Hour,
//		Opts:      []asynq.Option{asynq.Queue(tasks.QueueLow)},
//	},
var periodicTasks = []periodicTask{}

// syncInterval is how often the manager re-reads the registry. The registry
// is static, so this only matters for recovering registrations in Redis.
const syncInterval = time.Minute

// staticProvider serves the registry, built once at boot. Asynq identifies an
// entry by a hash of its spec, type, payload and options, so rebuilding the
// tasks on every sync would be wasted work at best.
type staticProvider struct {
	configs []*asynq.PeriodicTaskConfig
}

func (p staticProvider) GetConfigs() ([]*asynq.PeriodicTaskConfig, error) {
	return p.configs, nil
}

// NewScheduler builds the cron scheduler from periodicTasks. Run it on
// exactly one instance: each running scheduler enqueues every entry.
func NewScheduler() (*asynq.PeriodicTaskManager, error) {
	configs := make([]*asynq.PeriodicTaskConfig, 0, len(periodicTasks))
	for _, p := range periodicTasks {
		task, err := p.New()
		if err != nil {
			return nil, fmt.Errorf("failed to build periodic task %q: %w", p.Cronspec, err)
		}

		opts := p.Opts
		if p.UniqueFor > 0 {
			opts = append(opts[:len(opts):len(opts)], asynq.Unique(p.UniqueFor))
		}

		configs = append(configs, &asynq.PeriodicTaskConfig{
			Cronspec: p.Cronspec,
			Task:     task,
			Opts:     opts,
		})
	}

	return asynq.NewPeriodicTaskManager(asynq.PeriodicTaskManagerOpts{
		RedisConnOpt:               core.RedisOpt,
		PeriodicTaskConfigProvider: staticProvider{configs: configs},
		SyncInterval:               syncInterval,
		SchedulerOpts: &asynq.SchedulerOpts{
			Location: time.UTC,
			Logger:   slogLogger{},
		},
	})
}
