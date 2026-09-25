package routes

import (
	"github.com/gin-gonic/gin"

	"kopiika-api-go/src/api/v1/controllers"
	"kopiika-api-go/src/middleware"
)

func RegisterV1Routes(router *gin.Engine) {
	v1 := router.Group("/v1")
	{
		userRoutes := v1.Group("/users")
		{
			userRoutes.GET("/me", middleware.RequireAuth(), controllers.GetCurrentUser)
			userRoutes.PUT("/me", middleware.RequireAuth(), controllers.UpdateCurrentUser)
			userRoutes.POST("", middleware.RequireAuth(), controllers.SetupUser)
		}

		accountRoutes := v1.Group("/accounts")
		{
			accountRoutes.POST("", middleware.RequireAuth(), controllers.CreateAccount)
			accountRoutes.GET("", middleware.RequireAuth(), controllers.ListAccounts)
			accountRoutes.GET("/balance", middleware.RequireAuth(), controllers.GetAccountsBalance)
			accountRoutes.GET("/:accountId", middleware.RequireAuth(), controllers.GetAccount)
			accountRoutes.PUT("/:accountId", middleware.RequireAuth(), controllers.UpdateAccount)
			accountRoutes.DELETE("/:accountId", middleware.RequireAuth(), controllers.DeleteAccount)
		}

		categoryRoutes := v1.Group("/categories")
		{
			categoryRoutes.POST("", middleware.RequireAuth(), controllers.CreateCategory)
			categoryRoutes.GET("", middleware.RequireAuth(), controllers.ListCategories)
			categoryRoutes.PUT("/:categoryId", middleware.RequireAuth(), controllers.UpdateCategory)
			categoryRoutes.PUT("/:categoryId/hidden", middleware.RequireAuth(), controllers.SetCategoryHidden)
			categoryRoutes.DELETE("/:categoryId", middleware.RequireAuth(), controllers.DeleteCategory)
		}

		transactionRoutes := v1.Group("/transactions")
		{
			transactionRoutes.POST("", middleware.RequireAuth(), controllers.CreateTransaction)
			transactionRoutes.PUT("", middleware.RequireAuth(), controllers.UpdateTransaction)
			transactionRoutes.GET("", middleware.RequireAuth(), controllers.ListTransactions)
			// The fixed paths are registered before /:transactionId. FastAPI
			// matched routes in declaration order and tolerated them coming
			// last; Gin routes on a prefix tree, so a wildcard sibling that is
			// in place first would claim /latest as an id.
			transactionRoutes.GET("/latest", middleware.RequireAuth(), controllers.GetLatestTransactions)
			transactionRoutes.GET("/configuration", middleware.RequireAuth(), controllers.GetTransactionsConfiguration)
			transactionRoutes.GET("/statistics", middleware.RequireAuth(), controllers.GetTransactionsStatistics)
			transactionRoutes.GET("/date/:date", middleware.RequireAuth(), controllers.GetTransactionsByDate)
			transactionRoutes.GET("/:transactionId", middleware.RequireAuth(), controllers.GetTransaction)
			transactionRoutes.DELETE("/:transactionId", middleware.RequireAuth(), controllers.DeleteTransaction)
		}

		templateRoutes := v1.Group("/templates")
		{
			templateRoutes.POST("", middleware.RequireAuth(), controllers.CreateTransactionTemplate)
			templateRoutes.GET("", middleware.RequireAuth(), controllers.ListTransactionTemplates)
			templateRoutes.PUT("", middleware.RequireAuth(), controllers.UpdateTransactionTemplate)
			templateRoutes.DELETE("/:templateId", middleware.RequireAuth(), controllers.DeleteTransactionTemplate)
		}

		currencyRoutes := v1.Group("/currencies")
		{
			currencyRoutes.POST("/rates/fetch", middleware.RequireAuth(), controllers.FetchCurrencyRates)
		}
	}
}
