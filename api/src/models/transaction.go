package models

import (
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
)

// TransactionType is the direction a transaction moves money in.
type TransactionType string

const (
	TransactionTypeIncome  TransactionType = "income"
	TransactionTypeOutcome TransactionType = "outcome"
)

// Transaction is one movement of money, optionally posted against an account.
// When it carries an account, writing it also moves that account's value — the
// balance is stored, not derived, so every write has to keep the two in step.
//
// The date is a single date column. Python stores year, month and day as three
// separate integers, which forces a make_date() into every range filter and
// lets impossible dates (2026-02-31) reach the table. The wire format is
// unchanged: clients still send and receive the three parts on create, and the
// composed date is validated before it is stored.
type Transaction struct {
	BaseModel
	// Date is the day the money moved, which is not the day the row was created.
	Date        time.Time `gorm:"column:date;type:date;not null;index:idx_transactions_user_id_date,priority:2" json:"date"`
	Type        string    `gorm:"column:type;type:varchar(10);not null" json:"type"`
	Title       string    `gorm:"column:title;type:varchar(64);not null" json:"title"`
	Description *string   `gorm:"column:description;type:varchar(256)" json:"description"`
	// Value shares the account scale, so posting one into the other is exact.
	Value      decimal.Decimal `gorm:"column:value;type:numeric(18,4);not null" json:"value"`
	Currency   string          `gorm:"column:currency;type:varchar(3);not null" json:"currency"`
	CategoryId *int            `gorm:"column:category_id;index" json:"categoryId"`
	Category   *Category       `gorm:"foreignKey:CategoryId" json:"-"`
	AccountId  *uuid.UUID      `gorm:"column:account_id;type:uuid;index" json:"accountId"`
	Account    *Account        `gorm:"foreignKey:AccountId" json:"-"`
	// UserId leads the composite index with Date: every query is scoped to one
	// user and then cut by date range.
	UserId uuid.UUID `gorm:"column:user_id;type:uuid;not null;index:idx_transactions_user_id_date,priority:1" json:"userId"`
	User   *User     `gorm:"foreignKey:UserId;constraint:OnDelete:CASCADE" json:"-"`
}
