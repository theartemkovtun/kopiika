package services

import (
	"errors"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"kopiika-api-go/src/core"
	"kopiika-api-go/src/models"
	"kopiika-api-go/src/schemas"
)

func toTransactionTemplateSchema(template models.TransactionTemplate) schemas.TransactionTemplateSchema {
	return schemas.TransactionTemplateSchema{
		Id:    template.Id,
		Title: template.Title,
		Value: template.Value,
	}
}

// ListTransactionTemplates returns the user's templates, newest first. It is
// unpaginated, as the Python endpoint is.
func ListTransactionTemplates(userId uuid.UUID) ([]schemas.TransactionTemplateSchema, error) {
	var templates []models.TransactionTemplate

	if err := core.DB.
		Where("user_id = ? AND deleted_at IS NULL", userId).
		Order("created_at DESC").
		Find(&templates).Error; err != nil {
		return nil, err
	}

	response := make([]schemas.TransactionTemplateSchema, 0, len(templates))
	for _, template := range templates {
		response = append(response, toTransactionTemplateSchema(template))
	}

	return response, nil
}

func CreateTransactionTemplate(userId uuid.UUID, schema schemas.CreateTransactionTemplateSchema) (schemas.TransactionTemplateSchema, error) {
	template := models.TransactionTemplate{
		BaseModel: models.BaseModel{Id: uuid.New()},
		Title:     schema.Title,
		Value:     schema.Value,
		UserId:    userId,
	}

	if err := core.DB.Create(&template).Error; err != nil {
		return schemas.TransactionTemplateSchema{}, err
	}

	return toTransactionTemplateSchema(template), nil
}

// UpdateTransactionTemplate partially updates one of the user's templates.
// Only the fields present in the schema are changed.
func UpdateTransactionTemplate(userId uuid.UUID, schema schemas.UpdateTransactionTemplateSchema) (schemas.TransactionTemplateSchema, error) {
	var template models.TransactionTemplate
	if err := core.DB.First(&template, "id = ? AND user_id = ? AND deleted_at IS NULL", schema.Id, userId).Error; err != nil {
		return schemas.TransactionTemplateSchema{}, err
	}

	updates := map[string]any{}
	if schema.Title != nil {
		updates["title"] = *schema.Title
	}
	if schema.Value != nil {
		updates["value"] = *schema.Value
	}

	if len(updates) > 0 {
		if err := core.DB.Model(&template).Updates(updates).Error; err != nil {
			return schemas.TransactionTemplateSchema{}, err
		}
	}

	return toTransactionTemplateSchema(template), nil
}

// DeleteTransactionTemplate soft deletes one of the user's templates. It is
// idempotent: a missing or already deleted template is not an error.
func DeleteTransactionTemplate(userId uuid.UUID, templateId uuid.UUID) error {
	var template models.TransactionTemplate

	err := core.DB.First(&template, "id = ? AND user_id = ? AND deleted_at IS NULL", templateId, userId).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil
	}
	if err != nil {
		return err
	}

	return core.DB.Model(&template).Update("deleted_at", gorm.Expr("CURRENT_TIMESTAMP")).Error
}
