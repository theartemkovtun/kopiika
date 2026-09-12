package controllers

import (
	"errors"
	"net/http"

	"kopiika-api-go/src/schemas"
	"kopiika-api-go/src/services"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// writeTransactionError answers the failures the create and update paths share.
// It reports whether it handled the error, so a caller can add its own cases.
func writeTransactionError(c *gin.Context, err error) bool {
	switch {
	case errors.Is(err, services.ErrInvalidTransactionDate):
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Transaction date is not a real date",
		})
	case errors.Is(err, services.ErrAccountNotFound):
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Account does not exist",
		})
	case errors.Is(err, services.ErrCategoryNotFound):
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Category does not exist",
		})
	case errors.Is(err, services.ErrAccountCurrencyMismatch):
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid currency for the selected account",
		})
	case errors.Is(err, services.ErrRateUnavailable):
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "No currency rate available to localize the transaction",
		})
	default:
		return false
	}

	return true
}

// CreateTransaction handles creating a new transaction
// @Summary Create transaction
// @Description Create a transaction for the authenticated user. When it names an account, the account's balance moves with it: income adds the value, outcome subtracts it, and the transaction currency must match the account's
// @Tags transactions
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param payload body schemas.CreateTransactionSchema true "Transaction to create"
// @Success 201 {object} schemas.TransactionSchema
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /v1/transactions [post]
func CreateTransaction(c *gin.Context) {
	userId, _ := c.Get("user_id")

	var payload schemas.CreateTransactionSchema
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request body",
		})
		return
	}

	transaction, err := services.CreateTransaction(userId.(uuid.UUID), payload)
	if err != nil {
		if writeTransactionError(c, err) {
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to create transaction",
		})
		return
	}

	c.JSON(http.StatusCreated, transaction)
}

// UpdateTransaction handles updating a transaction
// @Summary Update transaction
// @Description Update one of the authenticated user's transactions, identified by the id in the body. Every field is replaced, so an omitted description, category or account clears it. The date cannot be changed. Balances are rebalanced, including when the transaction moves between accounts
// @Tags transactions
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param payload body schemas.UpdateTransactionSchema true "Transaction to update"
// @Success 200 {object} schemas.TransactionSchema
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /v1/transactions [put]
func UpdateTransaction(c *gin.Context) {
	userId, _ := c.Get("user_id")

	var payload schemas.UpdateTransactionSchema
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request body",
		})
		return
	}

	transaction, err := services.UpdateTransaction(userId.(uuid.UUID), payload)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Transaction not found",
		})
		return
	}
	if err != nil {
		if writeTransactionError(c, err) {
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to update transaction",
		})
		return
	}

	c.JSON(http.StatusOK, transaction)
}

// DeleteTransaction handles soft deleting a transaction
// @Summary Delete transaction
// @Description Soft delete one of the authenticated user's transactions, taking its effect back off the account balance. Idempotent: a repeat delete does not move the balance again
// @Tags transactions
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param transactionId path string true "Transaction id"
// @Success 204
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /v1/transactions/{transactionId} [delete]
func DeleteTransaction(c *gin.Context) {
	userId, _ := c.Get("user_id")

	transactionId, err := uuid.Parse(c.Param("transactionId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid transaction id",
		})
		return
	}

	err = services.DeleteTransaction(userId.(uuid.UUID), transactionId)
	if errors.Is(err, services.ErrAccountNotFound) {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Account does not exist",
		})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to delete transaction",
		})
		return
	}

	c.Status(http.StatusNoContent)
}
