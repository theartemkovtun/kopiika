package services

import (
	"fmt"
	"strings"

	"github.com/google/uuid"

	"kopiika-api-go/src/core"
	"kopiika-api-go/src/models"
	"kopiika-api-go/src/schemas"
)

const (
	defaultLanguage = "en"
	defaultCurrency = "uah"

	ukraineCountryCode = "ua"
	ukrainianLanguage  = "uk"
	ukrainianCurrency  = "uah"
	// foreignCurrency is what a user outside Ukraine starts with.
	foreignCurrency = "usd"
)

// defaultsForCountry picks the language and currency a new user starts with:
// Ukraine gets Ukrainian and hryvnia, anywhere else gets English and dollars.
//
// A request that names no country keeps the defaults the API used before the
// country code existed, rather than guessing at dollars for a client that has
// simply not been updated yet.
func defaultsForCountry(countryCode string) (string, string) {
	switch strings.ToLower(strings.TrimSpace(countryCode)) {
	case "":
		return defaultLanguage, defaultCurrency
	case ukraineCountryCode:
		return ukrainianLanguage, ukrainianCurrency
	default:
		return defaultLanguage, foreignCurrency
	}
}

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
// seeding name and picture from the user pool and the starting language and
// currency from the country the client reports. It is idempotent: a user who
// already exists is returned as they are and the payload is ignored.
func SetupUser(userId uuid.UUID, schema schemas.ConfigureUserSchema) (schemas.UserSchema, error) {
	var existing models.User
	if err := core.DB.First(&existing, "id = ?", userId).Error; err == nil {
		return toUserSchema(existing), nil
	}

	cognitoDetails, err := core.GetCognitoUserDetails(userId)
	if err != nil {
		return schemas.UserSchema{}, fmt.Errorf("failed to fetch user details from Cognito: %w", err)
	}

	language, currency := defaultsForCountry(schema.CountryCode)

	user := models.User{
		BaseModel: models.BaseModel{
			Id: userId,
		},
		Language:   language,
		Currency:   currency,
		Name:       cognitoDetails.Name,
		PictureUrl: cognitoDetails.PictureURL,
	}
	if err := core.DB.Create(&user).Error; err != nil {
		return schemas.UserSchema{}, err
	}
	return toUserSchema(user), nil
}

// optionalString reports an absent value as null rather than as an empty string,
// which is how the profile the Python API served is shaped.
func optionalString(value string) *string {
	if value == "" {
		return nil
	}
	return &value
}

// GetUserProfile is the identity provider's view of the user. It is a separate
// call from GetUserById because it costs a round trip to the user pool, and the
// plain read is on the path of every page load.
func GetUserProfile(userId uuid.UUID) (schemas.UserProfileSchema, error) {
	details, err := core.GetCognitoUserDetails(userId)
	if err != nil {
		return schemas.UserProfileSchema{}, fmt.Errorf("failed to fetch user details from Cognito: %w", err)
	}

	return schemas.UserProfileSchema{
		Email:            details.Email,
		Name:             optionalString(details.Name),
		Picture:          details.PictureURL,
		ExternalProvider: optionalString(details.ExternalProvider),
	}, nil
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
		updates["currency"] = normalizeCurrency(*schema.Currency)
	}

	if len(updates) > 0 {
		if err := core.DB.Model(&user).Updates(updates).Error; err != nil {
			return schemas.UserSchema{}, err
		}
	}

	return toUserSchema(user), nil
}
