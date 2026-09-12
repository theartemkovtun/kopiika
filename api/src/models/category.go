package models

import (
	"time"

	"github.com/google/uuid"
)

// Category labels a transaction. It is the one model that does not embed
// BaseModel: the id is an autoincrement integer carried over from the Python
// schema, because category ids are already held by clients in the wild.
//
// A row with a NULL UserId is a global default shared by every user. Those are
// listed for everyone and cannot be deleted, which is why the foreign key is
// left without ON DELETE CASCADE — the owner column is optional, and a cascade
// or a SET NULL would either remove or silently promote rows that the delete
// was never meant to reach.
type Category struct {
	Id        int        `gorm:"primaryKey;autoIncrement" json:"id"`
	Name      string     `gorm:"column:name;type:varchar(64);not null" json:"name"`
	Icon      string     `gorm:"column:icon;type:varchar(64);not null" json:"icon"`
	HexColor  string     `gorm:"column:hex_color;type:varchar(64);not null" json:"hexColor"`
	UserId    *uuid.UUID `gorm:"column:user_id;type:uuid;index" json:"userId"`
	User      *User      `gorm:"foreignKey:UserId" json:"-"`
	CreatedAt time.Time  `gorm:"column:created_at;not null;default:CURRENT_TIMESTAMP" json:"createdAt,omitempty"`
	DeletedAt *time.Time `gorm:"column:deleted_at;" json:"-"`
}
