package controllers

import (
	"errors"
	"io"
	"log/slog"
	"net/http"

	"kopiika-api-go/src/schemas"
	"kopiika-api-go/src/services"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// GetCurrentUser handles retrieving the current user
// @Summary Get current user
// @Description Get the currently authenticated user's configuration, optionally with the identity provider's profile attached
// @Tags users
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param profile query bool false "Attach the identity provider's profile block. Costs one call to the user pool"
// @Success 200 {object} schemas.UserSchema
// @Failure 401 {object} map[string]string
// @Failure 502 {object} map[string]string
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

	// The profile is opt-in because it is a call out to the identity provider,
	// and this endpoint is read on every page load. A failure there is the
	// provider's, not the caller's, so it is reported apart from the 401 a
	// missing local row gives.
	if c.Query("profile") == "true" {
		profile, err := services.GetUserProfile(userId.(uuid.UUID))
		if err != nil {
			// The client only gets a generic 502; the underlying AWS/Cognito error
			// (credentials, IAM, pool id, timeout) is only visible here.
			slog.ErrorContext(c.Request.Context(), "GetUserProfile failed", "user_id", userId.(uuid.UUID), "error", err)
			c.JSON(http.StatusBadGateway, gin.H{
				"error": "Failed to fetch the user profile from the identity provider",
			})
			return
		}
		user.Profile = &profile
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
