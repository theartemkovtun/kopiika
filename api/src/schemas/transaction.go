package schemas

import (
	"time"

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

// DateTransactionsSchema is one day's transactions grouped under the day they
// share. The list endpoint pages over these rather than over transactions: a
// page is ten days of spending, not ten rows.
type DateTransactionsSchema struct {
	Date         string              `json:"date" example:"2026-09-12"`
	Transactions []TransactionSchema `json:"transactions"`
}

// TransactionsConfigurationSchema is everything a client needs to render the
// transaction form in one response.
type TransactionsConfigurationSchema struct {
	Categories []CategorySchema    `json:"categories"`
	Accounts   []AccountBaseSchema `json:"accounts"`
	// Tags is always empty: tags are not ported yet, and the key is kept so the
	// response shape stays the one the clients already read.
	Tags []string `json:"tags"`
}

// ListTransactionsQuery is the list endpoint's query string. Repeated
// parameters carry the id filters — categoryIds=1&categoryIds=2 — which is the
// shape the Python endpoint takes.
//
// Page and take are read separately, with the same defaults as the other
// paginated resources.
type ListTransactionsQuery struct {
	Type     string `form:"type" binding:"omitempty,oneof=income outcome" example:"outcome"`
	Search   string `form:"search" example:"groceries"`
	FromDate string `form:"fromDate" binding:"omitempty,datetime=2006-01-02" example:"2026-09-01"`
	ToDate   string `form:"toDate" binding:"omitempty,datetime=2006-01-02" example:"2026-09-30"`
	// CategoryIds and AccountIds filter to the named categories and accounts.
	// They are not checked for ownership: an id that is not the user's simply
	// matches none of their transactions.
	CategoryIds []int    `form:"categoryIds"`
	AccountIds  []string `form:"accountIds" binding:"omitempty,dive,uuid"`
}

// ListTransactionsFilters narrows a transaction listing. Every field is
// optional, and an unset one is not applied.
type ListTransactionsFilters struct {
	Type        string
	Search      string
	FromDate    *time.Time
	ToDate      *time.Time
	CategoryIds []int
	AccountIds  []uuid.UUID
}

// Filters turns the parsed query string into the filters the service applies.
// The binding tags have already rejected a malformed date or id, so the parse
// errors here are the ones a caller could only reach by bypassing binding.
func (query ListTransactionsQuery) Filters() (ListTransactionsFilters, error) {
	filters := ListTransactionsFilters{
		Type:        query.Type,
		Search:      query.Search,
		CategoryIds: query.CategoryIds,
	}

	if query.FromDate != "" {
		date, err := time.Parse(DateLayout, query.FromDate)
		if err != nil {
			return filters, err
		}
		filters.FromDate = &date
	}

	if query.ToDate != "" {
		date, err := time.Parse(DateLayout, query.ToDate)
		if err != nil {
			return filters, err
		}
		filters.ToDate = &date
	}

	for _, id := range query.AccountIds {
		accountId, err := uuid.Parse(id)
		if err != nil {
			return filters, err
		}
		filters.AccountIds = append(filters.AccountIds, accountId)
	}

	return filters, nil
}
