package controllers

import (
	"errors"
	"net/http"
	"strconv"

	"kopiika-api-go/src/schemas"
	"kopiika-api-go/src/services"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

const (
	defaultPage = 1
	defaultTake = 10
	maxTake     = 100
)

// paginationParams reads the page/take query parameters, falling back to the
// defaults when they are absent or not usable.
func paginationParams(c *gin.Context) (int, int) {
	page, err := strconv.Atoi(c.Query("page"))
	if err != nil || page < 1 {
		page = defaultPage
	}

	take, err := strconv.Atoi(c.Query("take"))
	if err != nil || take < 1 {
		take = defaultTake
	}
	if take > maxTake {
		take = maxTake
	}

	return page, take
}

// CreateAccount handles creating a new account
// @Summary Create account
// @Description Create a new account for the authenticated user
// @Tags accounts
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param payload body schemas.CreateAccountSchema true "Account to create"
// @Success 201 {object} schemas.AccountSchema
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /v1/accounts [post]
func CreateAccount(c *gin.Context) {
	userId, _ := c.Get("user_id")

	var payload schemas.CreateAccountSchema
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request body",
		})
		return
	}

	account, err := services.CreateAccount(userId.(uuid.UUID), payload)
	if errors.Is(err, services.ErrNegativeAccountValue) {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Account value must not be negative",
		})
		return
	}
	if errors.Is(err, services.ErrRateUnavailable) {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "No currency rate available to localize the account",
		})
		return
	}
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Failed to create account",
		})
		return
	}

	c.JSON(http.StatusCreated, account)
}

// ListAccounts handles listing the user's accounts
// @Summary List accounts
// @Description List the authenticated user's accounts. Pages are cut by creation order; within a page accounts are ordered by their localized amount, richest first
// @Tags accounts
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param page query int false "Page number, 1-indexed" default(1)
// @Param take query int false "Items per page" default(10)
// @Success 200 {object} schemas.PaginatedResponse[schemas.AccountSchema]
// @Failure 401 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /v1/accounts [get]
func ListAccounts(c *gin.Context) {
	userId, _ := c.Get("user_id")

	page, take := paginationParams(c)

	accounts, err := services.ListAccounts(userId.(uuid.UUID), page, take)
	if errors.Is(err, services.ErrRateUnavailable) {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "No currency rate available to localize every account",
		})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to list accounts",
		})
		return
	}

	c.JSON(http.StatusOK, accounts)
}

// GetAccountsBalance handles the user's combined account balance
// @Summary Get accounts balance
// @Description Every account the authenticated user holds plus their combined worth in the user's own currency, richest first
// @Tags accounts
// @Accept json
// @Produce json
// @Security BearerAuth
// @Success 200 {object} schemas.AccountsBalanceSchema
// @Failure 401 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /v1/accounts/balance [get]
func GetAccountsBalance(c *gin.Context) {
	userId, _ := c.Get("user_id")

	balance, err := services.GetAccountsBalance(userId.(uuid.UUID))
	if errors.Is(err, services.ErrRateUnavailable) {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "No currency rate available to localize every account",
		})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get accounts balance",
		})
		return
	}

	c.JSON(http.StatusOK, balance)
}

// GetAccount handles retrieving a single account
// @Summary Get account
// @Description Get one of the authenticated user's accounts by id
// @Tags accounts
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param accountId path string true "Account id"
// @Success 200 {object} schemas.AccountSchema
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Router /v1/accounts/{accountId} [get]
func GetAccount(c *gin.Context) {
	userId, _ := c.Get("user_id")

	accountId, err := uuid.Parse(c.Param("accountId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid account id",
		})
		return
	}

	account, err := services.GetAccountById(userId.(uuid.UUID), accountId)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Account not found",
		})
		return
	}
	if errors.Is(err, services.ErrRateUnavailable) {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "No currency rate available to localize the account",
		})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get account",
		})
		return
	}

	c.JSON(http.StatusOK, account)
}

// UpdateAccount handles partially updating an account
// @Summary Update account
// @Description Update one of the authenticated user's accounts. Only the fields present in the payload are changed; currency and balance cannot be set this way
// @Tags accounts
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param accountId path string true "Account id"
// @Param payload body schemas.UpdateAccountSchema true "Fields to update"
// @Success 200 {object} schemas.AccountSchema
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /v1/accounts/{accountId} [put]
func UpdateAccount(c *gin.Context) {
	userId, _ := c.Get("user_id")

	accountId, err := uuid.Parse(c.Param("accountId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid account id",
		})
		return
	}

	var payload schemas.UpdateAccountSchema
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request body",
		})
		return
	}

	account, err := services.UpdateAccount(userId.(uuid.UUID), accountId, payload)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Account not found",
		})
		return
	}
	if errors.Is(err, services.ErrRateUnavailable) {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "No currency rate available to localize the account",
		})
		return
	}
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Failed to update account",
		})
		return
	}

	c.JSON(http.StatusOK, account)
}

// DeleteAccount handles soft deleting an account
// @Summary Delete account
// @Description Soft delete one of the authenticated user's accounts. Idempotent.
// @Tags accounts
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param accountId path string true "Account id"
// @Success 204
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Router /v1/accounts/{accountId} [delete]
func DeleteAccount(c *gin.Context) {
	userId, _ := c.Get("user_id")

	accountId, err := uuid.Parse(c.Param("accountId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid account id",
		})
		return
	}

	if err := services.DeleteAccount(userId.(uuid.UUID), accountId); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to delete account",
		})
		return
	}

	c.Status(http.StatusNoContent)
}
