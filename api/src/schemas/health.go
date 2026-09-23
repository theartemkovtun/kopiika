package schemas

type HealthSchema struct {
	Status string `json:"status" example:"ok"`
}

type ReadinessSchema struct {
	Status   string  `json:"status" example:"ok"`
	Database string  `json:"database" example:"ok"`
	Queue    string  `json:"queue" example:"ok"`
	Error    *string `json:"error,omitempty"`
}
