package schemas

import (
	"github.com/google/uuid"
)

// ConfigureUserSchema is the optional body of the create call. The country code
// picks the defaults the new user starts with; a request that carries no body
// keeps the ones the API has always used.
type ConfigureUserSchema struct {
	CountryCode string `json:"countryCode" binding:"omitempty,max=2" example:"ua"`
}

type UpdateUserSchema struct {
	Language *string `json:"language" binding:"omitempty,len=2" example:"uk"`
	Currency *string `json:"currency" binding:"omitempty,len=3" example:"uah"`
}

type UserSchema struct {
	Id         uuid.UUID `json:"id" example:"123e4567-e89b-12d3-a456-426614174000"`
	Language   string    `json:"language" example:"uk"`
	Currency   string    `json:"currency" example:"uah"`
	Name       string    `json:"name" example:"John Doe"`
	PictureUrl *string   `json:"pictureUrl" example:"https://example.com/picture.png"`
}
