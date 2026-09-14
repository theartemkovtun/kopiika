package schemas

import (
	"github.com/google/uuid"
	"github.com/shopspring/decimal"
)

// AmountSchema is a monetary value paired with the currency it is denominated in.
type AmountSchema struct {
	Value    decimal.Decimal `json:"value" swaggertype:"string" example:"1250.50"`
	Currency string          `json:"currency" example:"uah"`
}

type CreateAccountSchema struct {
	Name         string           `json:"name" binding:"required,max=64" example:"Monobank card"`
	Description  *string          `json:"description" binding:"omitempty,max=256" example:"Main salary card"`
	ColorHex     string           `json:"colorHex" binding:"required,max=7" example:"#1E88E5"`
	Currency     string           `json:"currency" binding:"required,len=3" example:"uah"`
	DefaultValue *decimal.Decimal `json:"defaultValue" swaggertype:"string" example:"1250.50"`
}

// UpdateAccountSchema is the partial update payload: only the fields present
// are changed. Currency and value are absent on purpose — currency is an
// invariant every posted transaction relies on, and value only ever moves
// through transaction posting, never a direct write.
type UpdateAccountSchema struct {
	Name        *string `json:"name" binding:"omitempty,max=64" example:"Monobank card"`
	Description *string `json:"description" binding:"omitempty,max=256" example:"Main salary card"`
	ColorHex    *string `json:"colorHex" binding:"omitempty,max=7" example:"#1E88E5"`
}

type AccountSchema struct {
	Id          uuid.UUID    `json:"id" example:"123e4567-e89b-12d3-a456-426614174000"`
	Name        string       `json:"name" example:"Monobank card"`
	Description *string      `json:"description" example:"Main salary card"`
	ColorHex    string       `json:"colorHex" example:"#1E88E5"`
	Amount      AmountSchema `json:"amount"`
	// LocalizedAmount is Amount converted into the user's own currency, so a
	// client can total accounts that are denominated differently.
	LocalizedAmount AmountSchema `json:"localizedAmount"`
}

// AccountBaseSchema is an account without its balance, for embedding in another
// resource's response.
type AccountBaseSchema struct {
	Id          uuid.UUID `json:"id" example:"123e4567-e89b-12d3-a456-426614174000"`
	Name        string    `json:"name" example:"Monobank card"`
	Description *string   `json:"description" example:"Main salary card"`
	Currency    string    `json:"currency" example:"uah"`
	ColorHex    string    `json:"colorHex" example:"#1E88E5"`
}

// AccountsBalanceSchema is every account the user holds plus their combined
// worth in the user's own currency.
type AccountsBalanceSchema struct {
	Total    AmountSchema    `json:"total"`
	Accounts []AccountSchema `json:"accounts"`
}
