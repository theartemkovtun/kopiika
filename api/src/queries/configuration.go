package queries

import (
	"encoding/json"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"kopiika-api-go/src/models"
)

// transactionsConfigurationSQL is the categories a user may label with and the
// accounts they may post to, in one statement.
//
// The two lists have nothing to join on, so they come back as two JSON arrays in
// a single row rather than as a union that would have to flatten two unrelated
// shapes into one set of columns. json_build_object names the model's own
// fields, so what arrives is the model — the conversion to a DTO stays in the
// service, where the rest of it lives.
//
// Categories are the user's own plus the global defaults, which are the rows
// with no owner.
const transactionsConfigurationSQL = `
SELECT
	(
		SELECT coalesce(json_agg(json_build_object(
			'id', c.id, 'name', c.name, 'icon', c.icon, 'hexColor', c.hex_color
		) ORDER BY c.id), '[]'::json)
		FROM categories c
		WHERE (c.user_id = ? OR c.user_id IS NULL) AND c.deleted_at IS NULL
	) AS categories,
	(
		SELECT coalesce(json_agg(json_build_object(
			'id', a.id, 'name', a.name, 'description', a.description,
			'currency', a.currency, 'colorHex', a.color_hex
		) ORDER BY a.created_at), '[]'::json)
		FROM accounts a
		WHERE a.user_id = ? AND a.deleted_at IS NULL
	) AS accounts`

// TransactionsConfiguration returns the user's categories and accounts in a
// single statement.
//
// A user with neither gets two empty slices rather than nulls: coalesce does it
// in SQL so the caller never has to tell "none" from "not asked".
func TransactionsConfiguration(db *gorm.DB, userId uuid.UUID) ([]models.Category, []models.Account, error) {
	var row struct {
		Categories []byte
		Accounts   []byte
	}

	err := db.Raw(transactionsConfigurationSQL, userId, userId).Scan(&row).Error
	if err != nil {
		return nil, nil, err
	}

	var categories []models.Category
	if err := json.Unmarshal(row.Categories, &categories); err != nil {
		return nil, nil, err
	}

	var accounts []models.Account
	if err := json.Unmarshal(row.Accounts, &accounts); err != nil {
		return nil, nil, err
	}

	return categories, accounts, nil
}
