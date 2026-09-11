package services

import (
	"errors"

	"kopiika-api-go/src/core"
	"kopiika-api-go/src/models"
	"kopiika-api-go/src/schemas"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

// ErrNegativeAccountValue is returned when an account would be opened with a
// negative starting balance.
var ErrNegativeAccountValue = errors.New("account value must not be negative")

func toAccountSchema(account models.Account) schemas.AccountSchema {
	return schemas.AccountSchema{
		Id:          account.Id,
		Name:        account.Name,
		Description: account.Description,
		ColorHex:    account.ColorHex,
		Amount: schemas.AmountSchema{
			Value:    account.Value,
			Currency: account.Currency,
		},
	}
}

func CreateAccount(userId uuid.UUID, schema schemas.CreateAccountSchema) (schemas.AccountSchema, error) {
	value := decimal.Zero
	if schema.DefaultValue != nil {
		value = *schema.DefaultValue
	}
	if value.IsNegative() {
		return schemas.AccountSchema{}, ErrNegativeAccountValue
	}

	account := models.Account{
		BaseModel:   models.BaseModel{Id: uuid.New()},
		Name:        schema.Name,
		Description: schema.Description,
		Value:       value,
		Currency:    schema.Currency,
		ColorHex:    schema.ColorHex,
		UserId:      userId,
	}

	if err := core.DB.Create(&account).Error; err != nil {
		return schemas.AccountSchema{}, err
	}

	return toAccountSchema(account), nil
}

func ListAccounts(userId uuid.UUID, page int, take int) (schemas.PaginatedResponse[schemas.AccountSchema], error) {
	response := schemas.PaginatedResponse[schemas.AccountSchema]{
		Page:  page,
		Take:  take,
		Items: []schemas.AccountSchema{},
	}

	query := core.DB.Model(&models.Account{}).Where("user_id = ? AND deleted_at IS NULL", userId)

	if err := query.Count(&response.Total).Error; err != nil {
		return response, err
	}
	if response.Total == 0 {
		return response, nil
	}

	var accounts []models.Account
	if err := query.Order("created_at").Limit(take).Offset((page - 1) * take).Find(&accounts).Error; err != nil {
		return response, err
	}

	for _, account := range accounts {
		response.Items = append(response.Items, toAccountSchema(account))
	}

	return response, nil
}

func GetAccountById(userId uuid.UUID, accountId uuid.UUID) (schemas.AccountSchema, error) {
	var account models.Account

	if err := core.DB.First(&account, "id = ? AND user_id = ? AND deleted_at IS NULL", accountId, userId).Error; err != nil {
		return schemas.AccountSchema{}, err
	}

	return toAccountSchema(account), nil
}

// DeleteAccount soft deletes the account. It is idempotent: deleting an account
// that is already gone is not an error.
func DeleteAccount(userId uuid.UUID, accountId uuid.UUID) error {
	var account models.Account

	err := core.DB.First(&account, "id = ? AND user_id = ? AND deleted_at IS NULL", accountId, userId).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil
	}
	if err != nil {
		return err
	}

	return core.DB.Model(&account).Update("deleted_at", gorm.Expr("CURRENT_TIMESTAMP")).Error
}
