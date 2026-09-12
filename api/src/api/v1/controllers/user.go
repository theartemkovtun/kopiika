package controllers

import (
	"errors"
	"io"
	"net/http"

	"kopiika-api-go/src/schemas"
	"kopiika-api-go/src/services"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// GetCurrentUser handles retrieving the current user
// @Summary Get current user
// @Description Get the currently authenticated user's configuration
// @Tags users
// @Accept json
// @Produce json
// @Security BearerAuth
// @Success 200 {object} schemas.UserSchema
// @Failure 401 {object} map[string]string
// @Router /v1/users/me [get]
func GetCurrentUser(c *gin.Context) {
	userId, _ := c.Get("user_id")

	user, err := services.GetUserById(userId.(uuid.UUID))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "User not found",
		})
		return
	}

	c.JSON(http.StatusOK, user)
}

// SetupUser handles creating the local user record
// @Summary Setup user
// @Description Create the local configuration for the authenticated Cognito user, deriving the starting language and currency from the country code. Idempotent.
// @Tags users
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param payload body schemas.ConfigureUserSchema false "Country the defaults are derived from"
// @Success 200 {object} schemas.UserSchema
// @Failure 400 {object} map[string]string
// @Router /v1/users [post]
func SetupUser(c *gin.Context) {
	userId, _ := c.Get("user_id")

	// The body is optional: clients that predate the country code send none, and
	// those users keep the defaults the API has always used. Only a body that is
	// present and malformed is rejected, which is what the io.EOF check leaves
	// through.
	var payload schemas.ConfigureUserSchema
	if err := c.ShouldBindJSON(&payload); err != nil && !errors.Is(err, io.EOF) {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request body",
		})
		return
	}

	user, err := services.SetupUser(userId.(uuid.UUID), payload)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Failed to create user",
		})
		return
	}

	c.JSON(http.StatusOK, user)
}

// UpdateCurrentUser handles updating the current user's configuration
// @Summary Update current user
// @Description Update the authenticated user's language and default currency
// @Tags users
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param payload body schemas.UpdateUserSchema true "User configuration"
// @Success 200 {object} schemas.UserSchema
// @Failure 400 {object} map[string]string
// @Router /v1/users/me [put]
func UpdateCurrentUser(c *gin.Context) {
	userId, _ := c.Get("user_id")

	var payload schemas.UpdateUserSchema
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request body",
		})
		return
	}

	user, err := services.UpdateUser(userId.(uuid.UUID), payload)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Failed to update user",
		})
		return
	}

	c.JSON(http.StatusOK, user)
}
