package models

import (
	"github.com/google/uuid"
	"github.com/shopspring/decimal"
)

// Account is a balance holder owned by a user (a card, a cash wallet, a jar).
// Transactions posted against an account move its value.
type Account struct {
	BaseModel
	Name        string          `gorm:"column:name;type:varchar(64);not null" json:"name"`
	Description *string         `gorm:"column:description;type:varchar(256)" json:"description"`
	Value       decimal.Decimal `gorm:"column:value;type:numeric(18,4);not null;default:0" json:"value"`
	Currency    string          `gorm:"column:currency;type:varchar(3);not null" json:"currency"`
	ColorHex    string          `gorm:"column:color_hex;type:varchar(7);not null" json:"colorHex"`
	UserId      uuid.UUID       `gorm:"column:user_id;type:uuid;not null;index" json:"userId"`
	User        *User           `gorm:"foreignKey:UserId;constraint:OnDelete:CASCADE" json:"-"`
}
