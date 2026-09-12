package schemas

// DateLayout is the wire format for a date: the day on its own, with no time.
const DateLayout = "2006-01-02"

type PaginatedResponse[T any] struct {
	Total int64 `json:"total"`
	Page  int   `json:"page"`
	Take  int   `json:"take"`
	Items []T   `json:"items"`
}
