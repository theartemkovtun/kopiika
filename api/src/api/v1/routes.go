package routes

import (
	"kopiika-api-go/src/api/v1/controllers"
	"kopiika-api-go/src/middleware"

	"github.com/gin-gonic/gin"
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
			accountRoutes.DELETE("/:accountId", middleware.RequireAuth(), controllers.DeleteAccount)
		}

		categoryRoutes := v1.Group("/categories")
		{
			categoryRoutes.POST("", middleware.RequireAuth(), controllers.CreateCategory)
			categoryRoutes.GET("", middleware.RequireAuth(), controllers.ListCategories)
			categoryRoutes.DELETE("/:categoryId", middleware.RequireAuth(), controllers.DeleteCategory)
		}

		transactionRoutes := v1.Group("/transactions")
		{
			transactionRoutes.POST("", middleware.RequireAuth(), controllers.CreateTransaction)
			transactionRoutes.PUT("", middleware.RequireAuth(), controllers.UpdateTransaction)
			transactionRoutes.DELETE("/:transactionId", middleware.RequireAuth(), controllers.DeleteTransaction)
		}
	}
}
