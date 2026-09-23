package controllers

import (
	"errors"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"kopiika-api-go/src/schemas"
	"kopiika-api-go/src/services"
)

// FetchCurrencyRates handles queueing a fetch of one day's currency rates
// @Summary Fetch currency rates for a day
// @Description Queue a background fetch of the rates between every supported pair of currencies on the given day, replacing any already stored for it. Use it to backfill a day the daily fetch missed. The fetch runs at processAt, or as soon as a worker is free without it. A day may not be later than the day the fetch runs on, and only one fetch per day can be waiting at a time
// @Tags currencies
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param payload body schemas.FetchCurrencyRatesSchema true "Day to fetch, and optionally when"
// @Success 202 {object} schemas.CurrencyRatesFetchSchema
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Failure 409 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /v1/currencies/rates/fetch [post]
func FetchCurrencyRates(c *gin.Context) {
	var payload schemas.FetchCurrencyRatesSchema
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request body",
		})
		return
	}

	date, err := time.Parse(schemas.DateLayout, payload.Date)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request body",
		})
		return
	}

	fetch, err := services.EnqueueCurrencyRatesFetch(c.Request.Context(), date, payload.ProcessAt)
	if errors.Is(err, services.ErrCurrencyRatesDateInFuture) {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Date is later than the day the fetch would run",
		})
		return
	}
	if errors.Is(err, services.ErrCurrencyRatesFetchQueued) {
		c.JSON(http.StatusConflict, gin.H{
			"error": "A fetch for this date is already queued",
		})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to queue the currency rates fetch",
		})
		return
	}

	c.JSON(http.StatusAccepted, fetch)
}
