package main

// @title Kopiika API
// @version 1.0
// @description Personal finance API for accounts, transactions and budgets

// @host localhost:8080
// @BasePath /
// @schemes http https

// @securityDefinitions.apikey BearerAuth
// @in header
// @name Authorization
// @description Enter your Bearer token in the format: Bearer {token}

import (
	"context"
	"log"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/hibiken/asynq"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
	"go.opentelemetry.io/contrib/instrumentation/github.com/gin-gonic/gin/otelgin"

	_ "kopiika-api-go/docs"
	"kopiika-api-go/src/api/health"
	routes "kopiika-api-go/src/api/v1"
	"kopiika-api-go/src/core"
	"kopiika-api-go/src/worker"
)

// shutdownBudget bounds the whole graceful shutdown: draining HTTP, letting
// in-flight tasks finish (worker.shutdownTimeout) and flushing telemetry.
// Render sends SIGKILL 30s after SIGTERM, so this stays under that.
const shutdownBudget = 25 * time.Second

// fatal logs a boot-time failure through the OTel-bridged logger, flushes
// telemetry, and exits. Unlike log.Fatal, which calls os.Exit directly and
// skips deferred cleanup, this ensures the failure itself is not silently
// dropped from the telemetry pipeline.
func fatal(ctx context.Context, shutdown func(context.Context) error, msg string, err error) {
	slog.ErrorContext(ctx, msg, "error", err)
	flushCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	_ = shutdown(flushCtx)
	cancel()
	os.Exit(1)
}

func main() {
	ctx := context.Background()

	if err := core.LoadConfig(); err != nil {
		log.Fatal(err)
	}

	shutdown, err := core.InitTelemetry(ctx)
	if err != nil {
		log.Fatal(err)
	}

	if err := core.InitDB(); err != nil {
		fatal(ctx, shutdown, "failed to initialize database", err)
	}

	if err := core.InitCognito(); err != nil {
		fatal(ctx, shutdown, "failed to initialize cognito", err)
	}

	if err := core.InitQueue(); err != nil {
		fatal(ctx, shutdown, "failed to initialize task queue", err)
	}

	role := core.Config.AppRole

	var srv *http.Server
	if role.ServesHTTP() {
		srv = &http.Server{
			Addr:    ":" + core.Config.Port,
			Handler: newRouter(),
		}

		go func() {
			if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
				fatal(ctx, shutdown, "server failed", err)
			}
		}()
	}

	var workerSrv *asynq.Server
	var scheduler *asynq.PeriodicTaskManager
	if role.RunsWorker() {
		core.InitRatesAPI()

		workerSrv = worker.NewServer()
		if err := workerSrv.Start(worker.NewMux()); err != nil {
			fatal(ctx, shutdown, "failed to start task worker", err)
		}

		scheduler, err = worker.NewScheduler()
		if err != nil {
			fatal(ctx, shutdown, "failed to build task scheduler", err)
		}
		if err := scheduler.Start(); err != nil {
			fatal(ctx, shutdown, "failed to start task scheduler", err)
		}
	}

	slog.InfoContext(ctx, "started", "role", role)

	stopCtx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	<-stopCtx.Done()

	shutdownCtx, cancel := context.WithTimeout(context.Background(), shutdownBudget)
	defer cancel()

	// HTTP goes first so no request enqueues work while the worker drains.
	if srv != nil {
		if err := srv.Shutdown(shutdownCtx); err != nil {
			slog.ErrorContext(shutdownCtx, "server shutdown failed", "error", err)
		}
	}

	if scheduler != nil {
		scheduler.Shutdown()
	}

	if workerSrv != nil {
		workerSrv.Shutdown()
	}

	if err := core.CloseQueue(); err != nil {
		slog.ErrorContext(shutdownCtx, "task queue close failed", "error", err)
	}

	if err := shutdown(shutdownCtx); err != nil {
		slog.ErrorContext(shutdownCtx, "telemetry shutdown failed", "error", err)
	}
}

func newRouter() *gin.Engine {
	engine := gin.Default()
	engine.Use(otelgin.Middleware(core.Config.OtelServiceName))

	allowedOrigins := []string{}
	if core.Config.CORSAllowedOrigins != "" {
		for _, origin := range strings.Split(core.Config.CORSAllowedOrigins, ",") {
			allowedOrigins = append(allowedOrigins, strings.TrimSpace(origin))
		}
	}

	// cors.New panics when no origin is allowed, so the middleware is only
	// mounted once an allow-list is configured.
	if len(allowedOrigins) > 0 {
		engine.Use(cors.New(cors.Config{
			AllowOrigins:     allowedOrigins,
			AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
			AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
			ExposeHeaders:    []string{"Content-Length"},
			AllowCredentials: true,
			MaxAge:           12 * time.Hour,
		}))
	}

	health.RegisterHealthRoutes(engine)

	engine.GET("/api/docs/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))

	routes.RegisterV1Routes(engine)

	return engine
}
