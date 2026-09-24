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

// CreateTransactionTemplate handles creating a new transaction template
// @Summary Create transaction template
// @Description Create a new transaction template owned by the authenticated user. The value is stored as sent and never read by the API
// @Tags templates
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param payload body schemas.CreateTransactionTemplateSchema true "Template to create"
// @Success 201 {object} schemas.TransactionTemplateSchema
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /v1/templates [post]
func CreateTransactionTemplate(c *gin.Context) {
	userId, _ := c.Get("user_id")

	var payload schemas.CreateTransactionTemplateSchema
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request body",
		})
		return
	}

	template, err := services.CreateTransactionTemplate(userId.(uuid.UUID), payload)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to create template",
		})
		return
	}

	c.JSON(http.StatusCreated, template)
}

// ListTransactionTemplates handles listing the user's transaction templates
// @Summary List transaction templates
// @Description List the authenticated user's transaction templates, newest first. Unpaginated
// @Tags templates
// @Accept json
// @Produce json
// @Security BearerAuth
// @Success 200 {array} schemas.TransactionTemplateSchema
// @Failure 401 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /v1/templates [get]
func ListTransactionTemplates(c *gin.Context) {
	userId, _ := c.Get("user_id")

	templates, err := services.ListTransactionTemplates(userId.(uuid.UUID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to list templates",
		})
		return
	}

	c.JSON(http.StatusOK, templates)
}

// UpdateTransactionTemplate handles partially updating a transaction template
// @Summary Update transaction template
// @Description Update one of the authenticated user's transaction templates. The id travels in the body; only the other fields present in the payload are changed
// @Tags templates
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param payload body schemas.UpdateTransactionTemplateSchema true "Template id and fields to update"
// @Success 200 {object} schemas.TransactionTemplateSchema
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /v1/templates [put]
func UpdateTransactionTemplate(c *gin.Context) {
	userId, _ := c.Get("user_id")

	var payload schemas.UpdateTransactionTemplateSchema
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request body",
		})
		return
	}

	template, err := services.UpdateTransactionTemplate(userId.(uuid.UUID), payload)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Template not found",
		})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to update template",
		})
		return
	}

	c.JSON(http.StatusOK, template)
}

// DeleteTransactionTemplate handles soft deleting a transaction template
// @Summary Delete transaction template
// @Description Soft delete one of the authenticated user's transaction templates. Idempotent
// @Tags templates
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param templateId path string true "Template id"
// @Success 204
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /v1/templates/{templateId} [delete]
func DeleteTransactionTemplate(c *gin.Context) {
	userId, _ := c.Get("user_id")

	templateId, err := uuid.Parse(c.Param("templateId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid template id",
		})
		return
	}

	if err := services.DeleteTransactionTemplate(userId.(uuid.UUID), templateId); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to delete template",
		})
		return
	}

	c.Status(http.StatusNoContent)
}
