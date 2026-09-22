package services

import (
	"errors"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"kopiika-api-go/src/core"
	"kopiika-api-go/src/models"
	"kopiika-api-go/src/schemas"
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
// endpoint is. Each category reports how many of the current user's own
// transactions reference it.
func ListCategories(userId uuid.UUID) ([]schemas.CategorySchema, error) {
	var categories []models.Category

	if err := core.DB.
		Where("(user_id = ? OR user_id IS NULL) AND deleted_at IS NULL", userId).
		Order("id").
		Find(&categories).Error; err != nil {
		return nil, err
	}

	var counts []struct {
		CategoryId int
		Total      int
	}
	if err := core.DB.Model(&models.Transaction{}).
		Select("category_id, count(*) as total").
		Where("user_id = ? AND category_id IS NOT NULL AND deleted_at IS NULL", userId).
		Group("category_id").
		Find(&counts).Error; err != nil {
		return nil, err
	}

	countByCategory := make(map[int]int, len(counts))
	for _, c := range counts {
		countByCategory[c.CategoryId] = c.Total
	}

	response := make([]schemas.CategorySchema, 0, len(categories))
	for _, category := range categories {
		schema := toCategorySchema(category)
		schema.Transactions = countByCategory[category.Id]
		response = append(response, schema)
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

// UpdateCategory partially updates one of the user's own categories. Only
// the fields present in the schema are changed; global default categories
// are never updatable by a user, the same as they are never deletable.
func UpdateCategory(userId uuid.UUID, categoryId int, schema schemas.UpdateCategorySchema) (schemas.CategorySchema, error) {
	var category models.Category
	if err := core.DB.First(&category, "id = ? AND user_id = ? AND deleted_at IS NULL", categoryId, userId).Error; err != nil {
		return schemas.CategorySchema{}, err
	}

	updates := map[string]any{}
	if schema.Name != nil {
		updates["name"] = *schema.Name
	}
	if schema.Icon != nil {
		updates["icon"] = *schema.Icon
	}
	if schema.HexColor != nil {
		updates["hex_color"] = *schema.HexColor
	}

	if len(updates) > 0 {
		if err := core.DB.Model(&category).Updates(updates).Error; err != nil {
			return schemas.CategorySchema{}, err
		}
	}

	var transactionsCount int64
	if err := core.DB.Model(&models.Transaction{}).
		Where("user_id = ? AND category_id = ? AND deleted_at IS NULL", userId, category.Id).
		Count(&transactionsCount).Error; err != nil {
		return schemas.CategorySchema{}, err
	}

	result := toCategorySchema(category)
	result.Transactions = int(transactionsCount)

	return result, nil
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
