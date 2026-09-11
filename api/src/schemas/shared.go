package schemas

type PaginatedResponse[T any] struct {
	Total int64 `json:"total"`
	Page  int   `json:"page"`
	Take  int   `json:"take"`
	Items []T   `json:"items"`
}
