package controllers

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"

	"kopiika-api-go/src/schemas"
	"kopiika-api-go/src/services"
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
// @Description List the authenticated user's own categories together with the global defaults, ordered by id, hidden defaults included and marked. Unpaginated
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

// UpdateCategory handles partially updating a category
// @Summary Update category
// @Description Update one of the authenticated user's own categories. Only the fields present in the payload are changed; global default categories are never updatable
// @Tags categories
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param categoryId path int true "Category id"
// @Param payload body schemas.UpdateCategorySchema true "Fields to update"
// @Success 200 {object} schemas.CategorySchema
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /v1/categories/{categoryId} [put]
func UpdateCategory(c *gin.Context) {
	userId, _ := c.Get("user_id")

	categoryId, err := strconv.Atoi(c.Param("categoryId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid category id",
		})
		return
	}

	var payload schemas.UpdateCategorySchema
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request body",
		})
		return
	}

	category, err := services.UpdateCategory(userId.(uuid.UUID), categoryId, payload)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Category not found",
		})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to update category",
		})
		return
	}

	c.JSON(http.StatusOK, category)
}

// SetCategoryHidden handles hiding or unhiding a default category
// @Summary Hide or unhide category
// @Description Hide or unhide a global default category for the authenticated user. A hidden category is still listed, and existing transactions keep it, but it is left out of the transactions configuration and cannot be given to a transaction. Idempotent. The user's own categories cannot be hidden
// @Tags categories
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param categoryId path int true "Category id"
// @Param payload body schemas.SetCategoryHiddenSchema true "Whether the category is hidden"
// @Success 200 {object} schemas.CategorySchema
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /v1/categories/{categoryId}/hidden [put]
func SetCategoryHidden(c *gin.Context) {
	userId, _ := c.Get("user_id")

	categoryId, err := strconv.Atoi(c.Param("categoryId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid category id",
		})
		return
	}

	var payload schemas.SetCategoryHiddenSchema
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request body",
		})
		return
	}

	category, err := services.SetCategoryHidden(userId.(uuid.UUID), categoryId, *payload.Hidden)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Category not found",
		})
		return
	}
	if errors.Is(err, services.ErrCategoryNotHideable) {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Only default categories can be hidden",
		})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to update category",
		})
		return
	}

	c.JSON(http.StatusOK, category)
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
