package schemas

import (
	"github.com/google/uuid"
)

type UpdateUserSchema struct {
	Language *string `json:"language" example:"uk"`
	Currency *string `json:"currency" example:"UAH"`
}

type UserSchema struct {
	Id         uuid.UUID `json:"id" example:"123e4567-e89b-12d3-a456-426614174000"`
	Language   string    `json:"language" example:"uk"`
	Currency   string    `json:"currency" example:"UAH"`
	Name       string    `json:"name" example:"John Doe"`
	PictureUrl *string   `json:"pictureUrl" example:"https://example.com/picture.png"`
}
