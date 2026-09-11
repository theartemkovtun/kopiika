package main

// @title Kopiika API
// @version 1.0
// @description Personal finance API for accounts, transactions and budgets

// @host localhost:8080
// @BasePath /v1
// @schemes http https

// @securityDefinitions.apikey BearerAuth
// @in header
// @name Authorization
// @description Enter your Bearer token in the format: Bearer {token}

import (
	"log"
	"net/http"
	"strings"
	"time"

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

	engine.Use(cors.New(cors.Config{
		AllowOrigins:     allowedOrigins,
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	engine.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status": "ok",
		})
	})

	engine.GET("/api/docs/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))

	routes.RegisterV1Routes(engine)

	if err := engine.Run(":8080"); err != nil {
		log.Fatal(err)
	}
}
