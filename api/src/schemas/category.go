package schemas

type CreateCategorySchema struct {
	Name string `json:"name" binding:"required,max=64" example:"Groceries"`
	Icon string `json:"icon" binding:"required,max=64" example:"shopping-cart"`
	// HexColor is spelled this way, rather than the accounts colorHex, because
	// that is the key the existing clients send and read.
	HexColor string `json:"hexColor" binding:"required,max=64" example:"#43A047"`
}

type CategorySchema struct {
	Id       int    `json:"id" example:"12"`
	Name     string `json:"name" example:"Groceries"`
	Icon     string `json:"icon" example:"shopping-cart"`
	HexColor string `json:"hexColor" example:"#43A047"`
}
