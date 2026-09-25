package models

import (
	"time"

	"github.com/google/uuid"
)

// HiddenCategory records that a user has hidden one of the global default
// categories. A row's presence is the whole flag, so there is no deleted_at:
// unhiding deletes the row, and the composite key keeps hiding idempotent.
//
// Hiding only takes the category out of what the user may label new
// transactions with; transactions already labelled with it are left as they are.
type HiddenCategory struct {
	UserId     uuid.UUID `gorm:"column:user_id;type:uuid;primaryKey" json:"userId"`
	User       *User     `gorm:"foreignKey:UserId;constraint:OnDelete:CASCADE" json:"-"`
	CategoryId int       `gorm:"column:category_id;primaryKey;autoIncrement:false" json:"categoryId"`
	Category   *Category `gorm:"foreignKey:CategoryId;constraint:OnDelete:CASCADE" json:"-"`
	CreatedAt  time.Time `gorm:"column:created_at;not null;default:CURRENT_TIMESTAMP" json:"createdAt,omitempty"`
}
