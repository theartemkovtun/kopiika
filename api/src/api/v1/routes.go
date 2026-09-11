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
	}
}
