package core

import (
	"errors"
	"fmt"
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

type config struct {
	Port               string
	DatabaseUrl        string
	CORSAllowedOrigins string
	CognitoRegion      string
	CognitoUserPoolID  string
	RedisUrl           string

	AppRole           AppRole
	WorkerConcurrency int

	OtelSDKDisabled          bool
	OtelServiceName          string
	OtelExporterOTLPEndpoint string
	DeploymentEnvironment    string
}

// defaultPort is used when PORT is unset. Container platforms inject their own
// value and expect the process to honour it.
const defaultPort = "8080"

const (
	defaultOtelServiceName          = "kopiika-api"
	defaultOtelExporterOTLPEndpoint = "http://localhost:4318"
	defaultDeploymentEnvironment    = "development"
)

// AppRole selects which parts of the process run. The same binary serves
// HTTP, processes background tasks and runs the cron scheduler, so the two
// halves can be split into separate deployments without a code change.
type AppRole string

const (
	AppRoleAll    AppRole = "all"
	AppRoleAPI    AppRole = "api"
	AppRoleWorker AppRole = "worker"
)

// ServesHTTP reports whether this role runs the HTTP server.
func (r AppRole) ServesHTTP() bool { return r == AppRoleAll || r == AppRoleAPI }

// RunsWorker reports whether this role processes tasks and runs the scheduler.
func (r AppRole) RunsWorker() bool { return r == AppRoleAll || r == AppRoleWorker }

const defaultWorkerConcurrency = 10

var Config = &config{}

func LoadConfig() error {
	// .env is a local-dev convenience; deployed environments inject the vars directly
	_ = godotenv.Load()

	Config.Port = os.Getenv("PORT")
	if Config.Port == "" {
		Config.Port = defaultPort
	}

	Config.DatabaseUrl = os.Getenv("DATABASE_URL")
	Config.CORSAllowedOrigins = os.Getenv("CORS_ALLOWED_ORIGINS")
	Config.CognitoRegion = os.Getenv("COGNITO_REGION")
	Config.CognitoUserPoolID = os.Getenv("COGNITO_USER_POOL_ID")
	Config.RedisUrl = os.Getenv("REDIS_URL")

	Config.AppRole = AppRole(os.Getenv("APP_ROLE"))
	if Config.AppRole == "" {
		Config.AppRole = AppRoleAll
	}

	Config.WorkerConcurrency = defaultWorkerConcurrency
	if raw := os.Getenv("WORKER_CONCURRENCY"); raw != "" {
		n, err := strconv.Atoi(raw)
		if err != nil || n < 1 {
			return fmt.Errorf("WORKER_CONCURRENCY must be a positive integer, got %q", raw)
		}
		Config.WorkerConcurrency = n
	}

	// OTEL_SDK_DISABLED is the OpenTelemetry spec's own name for the
	// kill-switch; reused here rather than inventing a project-specific var.
	Config.OtelSDKDisabled = os.Getenv("OTEL_SDK_DISABLED") == "true"

	Config.OtelServiceName = os.Getenv("OTEL_SERVICE_NAME")
	if Config.OtelServiceName == "" {
		Config.OtelServiceName = defaultOtelServiceName
	}

	Config.OtelExporterOTLPEndpoint = os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT")
	if Config.OtelExporterOTLPEndpoint == "" {
		Config.OtelExporterOTLPEndpoint = defaultOtelExporterOTLPEndpoint
	}

	Config.DeploymentEnvironment = os.Getenv("DEPLOYMENT_ENVIRONMENT")
	if Config.DeploymentEnvironment == "" {
		Config.DeploymentEnvironment = defaultDeploymentEnvironment
	}

	if Config.DatabaseUrl == "" {
		return errors.New("DATABASE_URL environment variable is not set")
	}

	if Config.CognitoRegion == "" {
		return errors.New("COGNITO_REGION environment variable is not set")
	}

	if Config.CognitoUserPoolID == "" {
		return errors.New("COGNITO_USER_POOL_ID environment variable is not set")
	}

	if Config.RedisUrl == "" {
		return errors.New("REDIS_URL environment variable is not set")
	}

	switch Config.AppRole {
	case AppRoleAll, AppRoleAPI, AppRoleWorker:
	default:
		return fmt.Errorf("APP_ROLE must be one of all, api, worker, got %q", Config.AppRole)
	}

	return nil
}
