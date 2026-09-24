package models

import (
	"github.com/google/uuid"
)

// TransactionTemplate is a saved shortcut for a transaction the user enters
// often. Value is opaque to the API: it is whatever the client serialized from
// its transaction form, stored and returned as is.
type TransactionTemplate struct {
	BaseModel
	Title  string    `gorm:"column:title;type:varchar(64);not null" json:"title"`
	Value  string    `gorm:"column:value;type:text;not null" json:"value"`
	UserId uuid.UUID `gorm:"column:user_id;type:uuid;not null;index" json:"userId"`
	User   *User     `gorm:"foreignKey:UserId;constraint:OnDelete:CASCADE" json:"-"`
}
