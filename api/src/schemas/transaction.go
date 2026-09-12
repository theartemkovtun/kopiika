package schemas

import (
	"github.com/google/uuid"
	"github.com/shopspring/decimal"
)

// CreateTransactionSchema is the create payload. The date arrives as three
// separate parts, which is what the existing clients send; it is composed and
// validated into a single date before it is stored.
type CreateTransactionSchema struct {
	Type  string `json:"type" binding:"required,oneof=income outcome" example:"outcome"`
	Title string `json:"title" binding:"required,max=64" example:"Groceries"`
	// Value is a pointer so that a missing value is rejected while an explicit
	// zero is still accepted, as in Python.
	Value       *decimal.Decimal `json:"value" binding:"required" swaggertype:"string" example:"125.40"`
	Currency    string           `json:"currency" binding:"required,len=3" example:"uah"`
	Description *string          `json:"description" binding:"omitempty,max=256" example:"Weekly shop"`
	CategoryId  *int             `json:"categoryId" example:"1"`
	AccountId   *uuid.UUID       `json:"accountId" example:"123e4567-e89b-12d3-a456-426614174000"`
	Year        int              `json:"year" binding:"required,min=1900,max=2200" example:"2026"`
	Month       int              `json:"month" binding:"required,min=1,max=12" example:"9"`
	Day         int              `json:"day" binding:"required,min=1,max=31" example:"12"`
}

// UpdateTransactionSchema is the update payload. The id travels in the body
// rather than the path, which is how the Python endpoint is shaped.
//
// Every field is replaced, so an omitted description, category or account
// clears the stored one. The date is deliberately absent: an update cannot move
// a transaction to another day.
type UpdateTransactionSchema struct {
	Id          uuid.UUID        `json:"id" binding:"required" example:"123e4567-e89b-12d3-a456-426614174000"`
	Type        string           `json:"type" binding:"required,oneof=income outcome" example:"outcome"`
	Title       string           `json:"title" binding:"required,max=64" example:"Groceries"`
	Value       *decimal.Decimal `json:"value" binding:"required" swaggertype:"string" example:"125.40"`
	Currency    string           `json:"currency" binding:"required,len=3" example:"uah"`
	Description *string          `json:"description" binding:"omitempty,max=256" example:"Weekly shop"`
	CategoryId  *int             `json:"categoryId" example:"1"`
	AccountId   *uuid.UUID       `json:"accountId" example:"123e4567-e89b-12d3-a456-426614174000"`
}

type TransactionSchema struct {
	Id   uuid.UUID `json:"id" example:"123e4567-e89b-12d3-a456-426614174000"`
	Date string    `json:"date" example:"2026-09-12"`
	Type string    `json:"type" example:"outcome"`
	// Title and Description are what the user typed, not a derived label.
	Title       string       `json:"title" example:"Groceries"`
	Description *string      `json:"description" example:"Weekly shop"`
	Amount      AmountSchema `json:"amount"`
	// LocalizedAmount is Amount converted into the user's own currency at the
	// rate for the transaction's own date, not today's.
	LocalizedAmount AmountSchema       `json:"localizedAmount"`
	Category        *CategorySchema    `json:"category"`
	Account         *AccountBaseSchema `json:"account"`
	// Tags is always empty: tags are not ported yet, and the key is kept so the
	// response shape stays the one the clients already read.
	Tags []string `json:"tags"`
}
