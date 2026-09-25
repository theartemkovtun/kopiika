package services

import (
	"errors"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"kopiika-api-go/src/core"
	"kopiika-api-go/src/models"
	"kopiika-api-go/src/schemas"
)

// ErrCategoryNotHideable is returned when a user tries to hide one of their own
// categories. Only the global defaults can be hidden; a user's own category is
// deleted instead.
var ErrCategoryNotHideable = errors.New("only default categories can be hidden")

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
// transactions reference it, and whether the user has hidden it.
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

	var hiddenIds []int
	if err := core.DB.Model(&models.HiddenCategory{}).
		Where("user_id = ?", userId).
		Pluck("category_id", &hiddenIds).Error; err != nil {
		return nil, err
	}

	hidden := make(map[int]bool, len(hiddenIds))
	for _, id := range hiddenIds {
		hidden[id] = true
	}

	response := make([]schemas.CategorySchema, 0, len(categories))
	for _, category := range categories {
		schema := toCategorySchema(category)
		schema.Transactions = countByCategory[category.Id]
		schema.Hidden = hidden[category.Id]
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

	transactionsCount, err := countCategoryTransactions(userId, category.Id)
	if err != nil {
		return schemas.CategorySchema{}, err
	}

	result := toCategorySchema(category)
	result.Transactions = transactionsCount

	return result, nil
}

// SetCategoryHidden hides or unhides a global default category for the user.
// A hidden category is still listed, and the transactions already labelled with
// it are untouched; it only stops being offered, and accepted, for new ones.
// Both directions are idempotent.
func SetCategoryHidden(userId uuid.UUID, categoryId int, hidden bool) (schemas.CategorySchema, error) {
	var category models.Category
	if err := core.DB.First(&category, "id = ? AND (user_id = ? OR user_id IS NULL) AND deleted_at IS NULL", categoryId, userId).Error; err != nil {
		return schemas.CategorySchema{}, err
	}

	if category.UserId != nil {
		return schemas.CategorySchema{}, ErrCategoryNotHideable
	}

	if hidden {
		row := models.HiddenCategory{UserId: userId, CategoryId: category.Id}
		if err := core.DB.Clauses(clause.OnConflict{DoNothing: true}).Create(&row).Error; err != nil {
			return schemas.CategorySchema{}, err
		}
	} else {
		if err := core.DB.
			Where("user_id = ? AND category_id = ?", userId, category.Id).
			Delete(&models.HiddenCategory{}).Error; err != nil {
			return schemas.CategorySchema{}, err
		}
	}

	transactionsCount, err := countCategoryTransactions(userId, category.Id)
	if err != nil {
		return schemas.CategorySchema{}, err
	}

	result := toCategorySchema(category)
	result.Transactions = transactionsCount
	result.Hidden = hidden

	return result, nil
}

// countCategoryTransactions is how many of the user's own transactions are
// labelled with the category.
func countCategoryTransactions(userId uuid.UUID, categoryId int) (int, error) {
	var count int64
	if err := core.DB.Model(&models.Transaction{}).
		Where("user_id = ? AND category_id = ? AND deleted_at IS NULL", userId, categoryId).
		Count(&count).Error; err != nil {
		return 0, err
	}

	return int(count), nil
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
