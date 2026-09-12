package services

import (
	"errors"

	"kopiika-api-go/src/core"
	"kopiika-api-go/src/models"
	"kopiika-api-go/src/schemas"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

func toCategorySchema(category models.Category) schemas.CategorySchema {
	return schemas.CategorySchema{
		Id:       category.Id,
		Name:     category.Name,
		Icon:     category.Icon,
		HexColor: category.HexColor,
	}
}

// ListCategories returns the user's own categories together with the global
// defaults, which are the rows with no owner. It is unpaginated, as the Python
// endpoint is.
func ListCategories(userId uuid.UUID) ([]schemas.CategorySchema, error) {
	var categories []models.Category

	if err := core.DB.
		Where("(user_id = ? OR user_id IS NULL) AND deleted_at IS NULL", userId).
		Order("id").
		Find(&categories).Error; err != nil {
		return nil, err
	}

	response := make([]schemas.CategorySchema, 0, len(categories))
	for _, category := range categories {
		response = append(response, toCategorySchema(category))
	}

	return response, nil
}

func CreateCategory(userId uuid.UUID, schema schemas.CreateCategorySchema) (schemas.CategorySchema, error) {
	category := models.Category{
		Name:     schema.Name,
		Icon:     schema.Icon,
		HexColor: schema.HexColor,
		UserId:   &userId,
	}

	if err := core.DB.Create(&category).Error; err != nil {
		return schemas.CategorySchema{}, err
	}

	return toCategorySchema(category), nil
}

// DeleteCategory soft deletes one of the user's own categories. It is
// idempotent, and it matches on the owner, so a global default is never
// deletable by anyone.
func DeleteCategory(userId uuid.UUID, categoryId int) error {
	var category models.Category

	err := core.DB.First(&category, "id = ? AND user_id = ? AND deleted_at IS NULL", categoryId, userId).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil
	}
	if err != nil {
		return err
	}

	return core.DB.Model(&category).Update("deleted_at", gorm.Expr("CURRENT_TIMESTAMP")).Error
}
