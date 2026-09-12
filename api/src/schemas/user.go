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

// UserProfileSchema is the identity provider's view of the user. It is not
// stored: the user pool owns these fields and the API only relays them, so a
// value the pool does not hold is reported as null rather than as an empty
// string.
type UserProfileSchema struct {
	Email   string  `json:"email" example:"john@example.com"`
	Name    *string `json:"name" example:"John Doe"`
	Picture *string `json:"picture" example:"https://example.com/picture.png"`
	// ExternalProvider is the federated identity the user signed in through, and
	// is null for a user who signed up with a password.
	ExternalProvider *string `json:"externalProvider" example:"Apple"`
}

type UserSchema struct {
	Id         uuid.UUID `json:"id" example:"123e4567-e89b-12d3-a456-426614174000"`
	Language   string    `json:"language" example:"uk"`
	Currency   string    `json:"currency" example:"uah"`
	Name       string    `json:"name" example:"John Doe"`
	PictureUrl *string   `json:"pictureUrl" example:"https://example.com/picture.png"`
	// Profile is filled in only when the request asks for it, because filling it
	// in costs a call to the user pool.
	Profile *UserProfileSchema `json:"profile,omitempty"`
}
