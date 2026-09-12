package controllers

import (
	"net/http"
	"strconv"

	"kopiika-api-go/src/schemas"
	"kopiika-api-go/src/services"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// CreateCategory handles creating a new category
// @Summary Create category
// @Description Create a new category owned by the authenticated user
// @Tags categories
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param payload body schemas.CreateCategorySchema true "Category to create"
// @Success 201 {object} schemas.CategorySchema
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /v1/categories [post]
func CreateCategory(c *gin.Context) {
	userId, _ := c.Get("user_id")

	var payload schemas.CreateCategorySchema
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request body",
		})
		return
	}

	category, err := services.CreateCategory(userId.(uuid.UUID), payload)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to create category",
		})
		return
	}

	c.JSON(http.StatusCreated, category)
}

// ListCategories handles listing the categories available to the user
// @Summary List categories
// @Description List the authenticated user's own categories together with the global defaults, ordered by id. Unpaginated
// @Tags categories
// @Accept json
// @Produce json
// @Security BearerAuth
// @Success 200 {array} schemas.CategorySchema
// @Failure 401 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /v1/categories [get]
func ListCategories(c *gin.Context) {
	userId, _ := c.Get("user_id")

	categories, err := services.ListCategories(userId.(uuid.UUID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to list categories",
		})
		return
	}

	c.JSON(http.StatusOK, categories)
}

// DeleteCategory handles soft deleting a category
// @Summary Delete category
// @Description Soft delete one of the authenticated user's own categories. Idempotent, and global default categories are never deletable
// @Tags categories
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param categoryId path int true "Category id"
// @Success 204
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /v1/categories/{categoryId} [delete]
func DeleteCategory(c *gin.Context) {
	userId, _ := c.Get("user_id")

	categoryId, err := strconv.Atoi(c.Param("categoryId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid category id",
		})
		return
	}

	if err := services.DeleteCategory(userId.(uuid.UUID), categoryId); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to delete category",
		})
		return
	}

	c.Status(http.StatusNoContent)
}
