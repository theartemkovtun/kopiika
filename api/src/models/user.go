package models

// User holds the per-user configuration. The id is the Cognito sub, so there is
// no separate identity table.
type User struct {
	BaseModel
	Language   string  `gorm:"column:language;type:varchar(2);not null;default:en" json:"language"`
	Currency   string  `gorm:"column:currency;type:varchar(3);not null;default:UAH" json:"currency"`
	Name       string  `gorm:"column:name;type:varchar(255);not null" json:"name"`
	PictureUrl *string `gorm:"column:picture_url;type:varchar(255)" json:"pictureUrl"`
}
