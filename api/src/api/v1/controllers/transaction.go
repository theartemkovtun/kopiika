package controllers

import (
	"errors"
	"net/http"
	"strconv"
	"time"

	"kopiika-api-go/src/schemas"
	"kopiika-api-go/src/services"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// defaultLatestLimit is how many transactions /latest returns when the client
// does not say.
const defaultLatestLimit = 5

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

// ListTransactions handles listing transactions grouped by day
// @Summary List transactions
// @Description List the authenticated user's transactions grouped by the day they happened on, newest day first. The page is cut by day rather than by transaction, so total counts days and one page can hold any number of transactions
// @Tags transactions
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param page query int false "Page number, 1-indexed" default(1)
// @Param take query int false "Days per page" default(10)
// @Param type query string false "Only income or only outcome" Enums(income, outcome)
// @Param search query string false "Matches anywhere in the title, case-insensitively"
// @Param fromDate query string false "Earliest day to include (YYYY-MM-DD)"
// @Param toDate query string false "Latest day to include (YYYY-MM-DD)"
// @Param categoryIds query []int false "Only these categories" collectionFormat(multi)
// @Param accountIds query []string false "Only these accounts" collectionFormat(multi)
// @Success 200 {object} schemas.PaginatedResponse[schemas.DateTransactionsSchema]
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /v1/transactions [get]
func ListTransactions(c *gin.Context) {
	userId, _ := c.Get("user_id")
	page, take := paginationParams(c)

	var query schemas.ListTransactionsQuery
	if err := c.ShouldBindQuery(&query); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid query parameters",
		})
		return
	}

	filters, err := query.Filters()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid query parameters",
		})
		return
	}

	transactions, err := services.ListTransactions(userId.(uuid.UUID), filters, page, take)
	if err != nil {
		if errors.Is(err, services.ErrRateUnavailable) {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "No currency rate available to localize the transactions",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to list transactions",
		})
		return
	}

	c.JSON(http.StatusOK, transactions)
}

// GetTransaction handles fetching a single transaction
// @Summary Get transaction
// @Description Get one of the authenticated user's transactions, with its category and account attached
// @Tags transactions
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param transactionId path string true "Transaction id"
// @Success 200 {object} schemas.TransactionSchema
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /v1/transactions/{transactionId} [get]
func GetTransaction(c *gin.Context) {
	userId, _ := c.Get("user_id")

	transactionId, err := uuid.Parse(c.Param("transactionId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid transaction id",
		})
		return
	}

	transaction, err := services.GetTransactionById(userId.(uuid.UUID), transactionId)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Transaction not found",
		})
		return
	}
	if err != nil {
		if errors.Is(err, services.ErrRateUnavailable) {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "No currency rate available to localize the transaction",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get transaction",
		})
		return
	}

	c.JSON(http.StatusOK, transaction)
}

// GetTransactionsByDate handles fetching one day's transactions
// @Summary Get transactions for a date
// @Description Get everything the authenticated user spent or earned on one day. Answers null for a day with no transactions
// @Tags transactions
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param date path string true "Day to fetch (YYYY-MM-DD)"
// @Success 200 {object} schemas.DateTransactionsSchema
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /v1/transactions/date/{date} [get]
func GetTransactionsByDate(c *gin.Context) {
	userId, _ := c.Get("user_id")

	date, err := time.Parse(schemas.DateLayout, c.Param("date"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid date",
		})
		return
	}

	transactions, err := services.GetTransactionsByDate(userId.(uuid.UUID), date)
	if err != nil {
		if errors.Is(err, services.ErrRateUnavailable) {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "No currency rate available to localize the transactions",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get transactions",
		})
		return
	}

	c.JSON(http.StatusOK, transactions)
}

// GetLatestTransactions handles fetching the most recent transactions
// @Summary Get latest transactions
// @Description Get the authenticated user's most recent transactions, newest first by the day the money moved
// @Tags transactions
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param limit query int false "How many to return" default(5)
// @Success 200 {array} schemas.TransactionSchema
// @Failure 401 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /v1/transactions/latest [get]
func GetLatestTransactions(c *gin.Context) {
	userId, _ := c.Get("user_id")

	// The parameter is limit rather than take: this is a top-N, not a page, and
	// limit is what the clients already send.
	limit, err := strconv.Atoi(c.Query("limit"))
	if err != nil || limit < 1 {
		limit = defaultLatestLimit
	}
	if limit > maxTake {
		limit = maxTake
	}

	transactions, err := services.GetLatestTransactions(userId.(uuid.UUID), limit)
	if err != nil {
		if errors.Is(err, services.ErrRateUnavailable) {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "No currency rate available to localize the transactions",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get latest transactions",
		})
		return
	}

	c.JSON(http.StatusOK, transactions)
}

// GetTransactionsConfiguration handles fetching the transaction form options
// @Summary Get transactions configuration
// @Description Get the categories the authenticated user may label a transaction with and the accounts they may post it to, in one response. Tags are not ported and come back as an empty array
// @Tags transactions
// @Accept json
// @Produce json
// @Security BearerAuth
// @Success 200 {object} schemas.TransactionsConfigurationSchema
// @Failure 401 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /v1/transactions/configuration [get]
func GetTransactionsConfiguration(c *gin.Context) {
	userId, _ := c.Get("user_id")

	configuration, err := services.GetTransactionsConfiguration(userId.(uuid.UUID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get transactions configuration",
		})
		return
	}

	c.JSON(http.StatusOK, configuration)
}
