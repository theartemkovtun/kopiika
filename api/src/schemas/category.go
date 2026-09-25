package schemas

type CreateCategorySchema struct {
	Name string `json:"name" binding:"required,max=64" example:"Groceries"`
	Icon string `json:"icon" binding:"required,max=64" example:"shopping-cart"`
	// HexColor is spelled this way, rather than the accounts colorHex, because
	// that is the key the existing clients send and read.
	HexColor string `json:"hexColor" binding:"required,max=64" example:"#43A047"`
}

// UpdateCategorySchema is the partial update payload: only the fields present
// are changed.
type UpdateCategorySchema struct {
	Name     *string `json:"name" binding:"omitempty,max=64" example:"Groceries"`
	Icon     *string `json:"icon" binding:"omitempty,max=64" example:"shopping-cart"`
	HexColor *string `json:"hexColor" binding:"omitempty,max=64" example:"#43A047"`
}

// SetCategoryHiddenSchema hides or unhides a global default category for the
// current user.
type SetCategoryHiddenSchema struct {
	// A pointer so that an explicit false passes the required check.
	Hidden *bool `json:"hidden" binding:"required" example:"true"`
}

// CategorySchema is a category as the clients see it. Transactions and Hidden
// are filled in by the categories endpoints only; where a category is embedded
// in another response they are left at zero.
type CategorySchema struct {
	Id           int    `json:"id" example:"12"`
	Name         string `json:"name" example:"Groceries"`
	Icon         string `json:"icon" example:"shopping-cart"`
	HexColor     string `json:"hexColor" example:"#43A047"`
	Transactions int    `json:"transactions" example:"3"`
	// Hidden is true for a global default the user has hidden. Their own
	// categories cannot be hidden, so it is always false for those.
	Hidden bool `json:"hidden" example:"false"`
}
