package schemas

import "github.com/google/uuid"

type CreateTransactionTemplateSchema struct {
	Title string `json:"title" binding:"required,max=64" example:"Morning coffee"`
	// Value is the client's serialized transaction form; the API does not read it.
	Value string `json:"value" binding:"required" example:"{\"type\":\"outcome\",\"value\":\"85\",\"currency\":\"uah\"}"`
}

// UpdateTransactionTemplateSchema is the partial update payload: only the
// fields present are changed. The id travels in the body rather than the path,
// which is how the Python endpoint is shaped.
type UpdateTransactionTemplateSchema struct {
	Id    uuid.UUID `json:"id" binding:"required" example:"123e4567-e89b-12d3-a456-426614174000"`
	Title *string   `json:"title" binding:"omitempty,max=64" example:"Morning coffee"`
	Value *string   `json:"value" example:"{\"type\":\"outcome\",\"value\":\"85\",\"currency\":\"uah\"}"`
}

type TransactionTemplateSchema struct {
	Id    uuid.UUID `json:"id" example:"123e4567-e89b-12d3-a456-426614174000"`
	Title string    `json:"title" example:"Morning coffee"`
	Value string    `json:"value" example:"{\"type\":\"outcome\",\"value\":\"85\",\"currency\":\"uah\"}"`
}
