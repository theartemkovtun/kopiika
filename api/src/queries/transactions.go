// Package queries holds the raw or hand-built SQL behind operations that are
// more than a service-level Find: complex reads, and writes that have to span
// several statements.
package queries

import (
	"strings"
	"time"

	"kopiika-api-go/src/models"
	"kopiika-api-go/src/schemas"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// FilterTransactions narrows a transaction query to one user's live rows and
// applies the optional list filters.
//
// The count of matching days, the page of days and the fetch of the rows on
// those days all go through here, so all three necessarily agree on what
// matches — in the plpgsql function this replaces, the same filter list is
// spelled out twice and had to be kept in step by hand.
func FilterTransactions(db *gorm.DB, userId uuid.UUID, filters schemas.ListTransactionsFilters) *gorm.DB {
	query := db.Model(&models.Transaction{}).
		Where("user_id = ? AND deleted_at IS NULL", userId)

	if filters.Type != "" {
		query = query.Where("type = ?", filters.Type)
	}

	// An unescaped LIKE, as in Python: % and _ in the search term stay
	// wildcards rather than matching themselves.
	if filters.Search != "" {
		query = query.Where("lower(title) LIKE ?", "%"+strings.ToLower(filters.Search)+"%")
	}

	// A single date column is what makes these two plain comparisons. Python
	// stores the day in three integer parts, so every range filter there has to
	// rebuild the date with make_date() before it can compare it.
	if filters.FromDate != nil {
		query = query.Where("date >= ?", *filters.FromDate)
	}
	if filters.ToDate != nil {
		query = query.Where("date <= ?", *filters.ToDate)
	}

	if len(filters.CategoryIds) > 0 {
		query = query.Where("category_id IN ?", filters.CategoryIds)
	}
	if len(filters.AccountIds) > 0 {
		query = query.Where("account_id IN ?", filters.AccountIds)
	}

	return query
}

// ListTransactionDates returns one page of the distinct days the user has
// matching transactions on, newest first, together with how many days match in
// all.
//
// Pagination is by day rather than by row, which is what the clients render and
// what the plpgsql list_transactions function did with a temp table of distinct
// dates. Total is therefore a count of days, not of transactions.
func ListTransactionDates(
	db *gorm.DB,
	userId uuid.UUID,
	filters schemas.ListTransactionsFilters,
	page int,
	take int,
) ([]time.Time, int64, error) {
	var total int64

	err := FilterTransactions(db, userId, filters).
		Distinct("date").
		Count(&total).Error
	if err != nil {
		return nil, 0, err
	}
	if total == 0 {
		return nil, 0, nil
	}

	dates := []time.Time{}

	err = FilterTransactions(db, userId, filters).
		Distinct("date").
		Order("date DESC").
		Limit(take).
		Offset((page-1)*take).
		Pluck("date", &dates).Error
	if err != nil {
		return nil, 0, err
	}

	return dates, total, nil
}

// ListTransactionsOnDates loads every transaction the filters match on the
// given days, with its category and account attached.
//
// The ordering is the one the plpgsql function produced: days newest first, and
// within a day the most recently recorded transaction first. The id breaks ties
// so that two transactions entered in the same instant still come back in a
// stable order.
func ListTransactionsOnDates(
	db *gorm.DB,
	userId uuid.UUID,
	filters schemas.ListTransactionsFilters,
	dates []time.Time,
) ([]models.Transaction, error) {
	transactions := []models.Transaction{}
	if len(dates) == 0 {
		return transactions, nil
	}

	err := FilterTransactions(db, userId, filters).
		Where("date IN ?", dates).
		Preload("Category").
		Preload("Account").
		Order("date DESC, created_at DESC, id DESC").
		Find(&transactions).Error

	return transactions, err
}
