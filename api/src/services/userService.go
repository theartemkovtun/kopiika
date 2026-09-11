package services

import (
	"fmt"

	"kopiika-api-go/src/core"
	"kopiika-api-go/src/models"
	"kopiika-api-go/src/schemas"

	"github.com/google/uuid"
)

const (
	defaultLanguage = "en"
	defaultCurrency = "UAH"
)

func toUserSchema(user models.User) schemas.UserSchema {
	return schemas.UserSchema{
		Id:         user.Id,
		Language:   user.Language,
		Currency:   user.Currency,
		Name:       user.Name,
		PictureUrl: user.PictureUrl,
	}
}

func GetUserById(id uuid.UUID) (schemas.UserSchema, error) {
	var user models.User

	if err := core.DB.First(&user, "id = ? AND deleted_at IS NULL", id).Error; err != nil {
		return schemas.UserSchema{}, err
	}

	return toUserSchema(user), nil
}

// SetupUser creates the local user row for an authenticated Cognito user,
// seeding name and picture from the user pool. It is idempotent.
func SetupUser(userId uuid.UUID) (schemas.UserSchema, error) {
	var existing models.User
	if err := core.DB.First(&existing, "id = ?", userId).Error; err == nil {
		return toUserSchema(existing), nil
	}

	cognitoDetails, err := core.GetCognitoUserDetails(userId)
	if err != nil {
		return schemas.UserSchema{}, fmt.Errorf("failed to fetch user details from Cognito: %w", err)
	}

	user := models.User{
		BaseModel: models.BaseModel{
			Id: userId,
		},
		Language:   defaultLanguage,
		Currency:   defaultCurrency,
		Name:       cognitoDetails.Name,
		PictureUrl: cognitoDetails.PictureURL,
	}
	if err := core.DB.Create(&user).Error; err != nil {
		return schemas.UserSchema{}, err
	}
	return toUserSchema(user), nil
}

func UpdateUser(userId uuid.UUID, schema schemas.UpdateUserSchema) (schemas.UserSchema, error) {
	var user models.User
	if err := core.DB.First(&user, "id = ? AND deleted_at IS NULL", userId).Error; err != nil {
		return schemas.UserSchema{}, err
	}

	updates := map[string]any{}
	if schema.Language != nil {
		updates["language"] = *schema.Language
	}
	if schema.Currency != nil {
		updates["currency"] = *schema.Currency
	}

	if len(updates) > 0 {
		if err := core.DB.Model(&user).Updates(updates).Error; err != nil {
			return schemas.UserSchema{}, err
		}
	}

	return toUserSchema(user), nil
}
