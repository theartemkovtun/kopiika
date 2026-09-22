package services

import (
	"errors"
	"fmt"
	"sort"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"

	"kopiika-api-go/src/core"
	"kopiika-api-go/src/models"
	"kopiika-api-go/src/schemas"
)

// ErrNegativeAccountValue is returned when an account would be opened with a
// negative starting balance.
var ErrNegativeAccountValue = errors.New("account value must not be negative")

// ErrRateUnavailable is returned when an account holds a currency that has no
// recorded rate into the user's own currency, so it cannot be localized.
var ErrRateUnavailable = errors.New("currency rate unavailable")

func toAccountSchema(account models.Account, converter CurrencyConverter) (schemas.AccountSchema, error) {
	localized, ok := converter.Convert(account.Value, account.Currency)
	if !ok {
		return schemas.AccountSchema{}, fmt.Errorf("%w: %s to %s", ErrRateUnavailable, account.Currency, converter.Target())
	}

	return schemas.AccountSchema{
		Id:          account.Id,
		Name:        account.Name,
		Description: account.Description,
		ColorHex:    account.ColorHex,
		Amount: schemas.AmountSchema{
			Value:    account.Value,
			Currency: account.Currency,
		},
		LocalizedAmount: schemas.AmountSchema{
			Value:    localized,
			Currency: converter.Target(),
		},
	}, nil
}

// toAccountBaseSchema is the account without its balance, for embedding in
// another resource's response.
func toAccountBaseSchema(account models.Account) schemas.AccountBaseSchema {
	return schemas.AccountBaseSchema{
		Id:          account.Id,
		Name:        account.Name,
		Description: account.Description,
		Currency:    account.Currency,
		ColorHex:    account.ColorHex,
	}
}

// sortByLocalizedAmountDesc orders accounts by what they are worth in the
// user's currency, richest first.
func sortByLocalizedAmountDesc(accounts []schemas.AccountSchema) {
	sort.SliceStable(accounts, func(i, j int) bool {
		return accounts[i].LocalizedAmount.Value.GreaterThan(accounts[j].LocalizedAmount.Value)
	})
}

func CreateAccount(userId uuid.UUID, schema schemas.CreateAccountSchema) (schemas.AccountSchema, error) {
	value := decimal.Zero
	if schema.DefaultValue != nil {
		value = *schema.DefaultValue
	}
	if value.IsNegative() {
		return schemas.AccountSchema{}, ErrNegativeAccountValue
	}

	converter, err := converterForUser(userId)
	if err != nil {
		return schemas.AccountSchema{}, err
	}

	account := models.Account{
		BaseModel:   models.BaseModel{Id: uuid.New()},
		Name:        schema.Name,
		Description: schema.Description,
		Value:       value,
		Currency:    normalizeCurrency(schema.Currency),
		ColorHex:    schema.ColorHex,
		UserId:      userId,
	}

	if err := core.DB.Create(&account).Error; err != nil {
		return schemas.AccountSchema{}, err
	}

	return toAccountSchema(account, converter)
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

	converter, err := converterForUser(userId)
	if err != nil {
		return response, err
	}

	for _, account := range accounts {
		schema, err := toAccountSchema(account, converter)
		if err != nil {
			return response, err
		}
		response.Items = append(response.Items, schema)
	}

	// Pagination is by created_at but the page itself is ordered by localized
	// amount, which is how the Python endpoint behaves. It means the ordering is
	// only consistent within a page; changing it would reshuffle what each page
	// contains, so it is left alone until the parity sweep.
	sortByLocalizedAmountDesc(response.Items)

	return response, nil
}

func GetAccountById(userId uuid.UUID, accountId uuid.UUID) (schemas.AccountSchema, error) {
	var account models.Account

	if err := core.DB.First(&account, "id = ? AND user_id = ? AND deleted_at IS NULL", accountId, userId).Error; err != nil {
		return schemas.AccountSchema{}, err
	}

	converter, err := converterForUser(userId)
	if err != nil {
		return schemas.AccountSchema{}, err
	}

	return toAccountSchema(account, converter)
}

// GetAccountsBalance returns every one of the user's accounts together with
// their combined worth in the user's own currency.
func GetAccountsBalance(userId uuid.UUID) (schemas.AccountsBalanceSchema, error) {
	converter, err := converterForUser(userId)
	if err != nil {
		return schemas.AccountsBalanceSchema{}, err
	}

	response := schemas.AccountsBalanceSchema{
		Total:    schemas.AmountSchema{Value: decimal.Zero, Currency: converter.Target()},
		Accounts: []schemas.AccountSchema{},
	}

	var accounts []models.Account
	if err := core.DB.Where("user_id = ? AND deleted_at IS NULL", userId).Find(&accounts).Error; err != nil {
		return schemas.AccountsBalanceSchema{}, err
	}

	for _, account := range accounts {
		schema, err := toAccountSchema(account, converter)
		if err != nil {
			return schemas.AccountsBalanceSchema{}, err
		}
		response.Accounts = append(response.Accounts, schema)
		response.Total.Value = response.Total.Value.Add(schema.LocalizedAmount.Value)
	}

	response.Total.Value = response.Total.Value.Round(amountScale)
	sortByLocalizedAmountDesc(response.Accounts)

	return response, nil
}

// UpdateAccount partially updates one of the user's accounts: only the fields
// present in the schema are changed.
func UpdateAccount(userId uuid.UUID, accountId uuid.UUID, schema schemas.UpdateAccountSchema) (schemas.AccountSchema, error) {
	var account models.Account
	if err := core.DB.First(&account, "id = ? AND user_id = ? AND deleted_at IS NULL", accountId, userId).Error; err != nil {
		return schemas.AccountSchema{}, err
	}

	updates := map[string]any{}
	if schema.Name != nil {
		updates["name"] = *schema.Name
	}
	if schema.Description != nil {
		updates["description"] = *schema.Description
	}
	if schema.ColorHex != nil {
		updates["color_hex"] = *schema.ColorHex
	}

	if len(updates) > 0 {
		if err := core.DB.Model(&account).Updates(updates).Error; err != nil {
			return schemas.AccountSchema{}, err
		}
	}

	converter, err := converterForUser(userId)
	if err != nil {
		return schemas.AccountSchema{}, err
	}

	return toAccountSchema(account, converter)
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
