package controllers

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"

	"kopiika-api-go/src/schemas"
	"kopiika-api-go/src/services"
)

// GetTransactionsStatistics handles the statistics for a date range
// @Summary Get transaction statistics
// @Description Report on everything the authenticated user recorded between two days, inclusive, in their own currency. Every transaction is converted at the rate for its own date rather than today's. Without full, only the income, outcome and difference totals, the per-day series and the category spending breakdown are populated; the remaining fields hold their zero values so the response shape does not change
// @Tags transactions
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param fromDate query string true "First day of the range (YYYY-MM-DD)"
// @Param toDate query string true "Last day of the range (YYYY-MM-DD)"
// @Param full query bool false "Also report the counts, averages, extremes and account breakdowns" default(false)
// @Success 200 {object} schemas.TransactionsStatisticsSchema
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /v1/transactions/statistics [get]
func GetTransactionsStatistics(c *gin.Context) {
	userId, _ := c.Get("user_id")

	var query schemas.TransactionsStatisticsQuery
	if err := c.ShouldBindQuery(&query); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid query parameters",
		})
		return
	}

	fromDate, toDate, err := query.Range()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid query parameters",
		})
		return
	}

	statistics, err := services.GetTransactionsStatistics(userId.(uuid.UUID), fromDate, toDate, query.Full)
	if errors.Is(err, services.ErrStatisticsRangeTooLarge) {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Date range is too long",
		})
		return
	}
	if errors.Is(err, gorm.ErrRecordNotFound) {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "User not found",
		})
		return
	}
	if err != nil {
		if errors.Is(err, services.ErrRateUnavailable) {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "No currency rate available to localize the transactions",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get transaction statistics",
		})
		return
	}

	c.JSON(http.StatusOK, statistics)
}
