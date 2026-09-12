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
	"log"
	"strings"
	"time"

	"kopiika-api-go/src/api/health"
	routes "kopiika-api-go/src/api/v1"
	"kopiika-api-go/src/core"

	_ "kopiika-api-go/docs"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
)

func main() {

	if err := core.LoadConfig(); err != nil {
		log.Fatal(err)
	}

	if err := core.InitDB(); err != nil {
		log.Fatal(err)
	}

	if err := core.InitCognito(); err != nil {
		log.Fatal(err)
	}

	engine := gin.Default()

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

	if err := engine.Run(":" + core.Config.Port); err != nil {
		log.Fatal(err)
	}
}
