package services

import (
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"

	"kopiika-api-go/src/core"
	"kopiika-api-go/src/models"
	"kopiika-api-go/src/queries"
	"kopiika-api-go/src/schemas"
)

// ErrInvalidTransactionDate is returned when the year, month and day do not
// name a real day. Python stores the three parts unchecked, so a 31st of
// February reaches the table and only fails later, when something reads it.
var ErrInvalidTransactionDate = errors.New("transaction date is not a real date")

// ErrAccountNotFound is returned when a transaction names an account that is
// not the user's own, or has been deleted.
var ErrAccountNotFound = errors.New("account does not exist")

// ErrCategoryNotFound is returned when a transaction names a category that is
// neither the user's own nor a global default.
var ErrCategoryNotFound = errors.New("category does not exist")

// ErrAccountCurrencyMismatch is returned when a transaction would be posted to
// an account denominated in another currency.
var ErrAccountCurrencyMismatch = errors.New("transaction currency does not match the account currency")

// composeTransactionDate turns the three parts a client sends into one date,
// rejecting days that do not exist rather than rolling them forward the way
// time.Date does on its own.
func composeTransactionDate(year int, month int, day int) (time.Time, error) {
	date := time.Date(year, time.Month(month), day, 0, 0, 0, 0, time.UTC)

	if date.Year() != year || int(date.Month()) != month || date.Day() != day {
		return time.Time{}, fmt.Errorf("%w: %04d-%02d-%02d", ErrInvalidTransactionDate, year, month, day)
	}

	return date, nil
}

// balanceEffect is what posting a transaction does to its account's value:
// income adds, outcome subtracts.
func balanceEffect(transactionType string, value decimal.Decimal) decimal.Decimal {
	if transactionType == string(models.TransactionTypeIncome) {
		return value
	}

	return value.Neg()
}

// adjustAccountBalance moves the account's value by delta in a single statement,
// so two writes landing on the same account cannot read the same balance and
// overwrite each other. RowsAffected of zero means the account is not the
// user's, or is deleted.
func adjustAccountBalance(db *gorm.DB, userId uuid.UUID, accountId uuid.UUID, delta decimal.Decimal) error {
	result := db.Model(&models.Account{}).
		Where("id = ? AND user_id = ? AND deleted_at IS NULL", accountId, userId).
		Update("value", gorm.Expr("value + ?", delta))

	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return fmt.Errorf("%w: %s", ErrAccountNotFound, accountId)
	}

	return nil
}

// postToAccount applies a transaction's effect to the account, once the account
// is established as able to hold it. The currencies have to agree: a balance is
// one number in one currency, so posting another denomination into it would make
// the stored total mean nothing.
//
// Python applies this check on create but not on update, which lets an update
// move a foreign-currency transaction onto an account and quietly corrupt its
// balance. It is enforced on both paths here.
func postToAccount(db *gorm.DB, userId uuid.UUID, accountId uuid.UUID, currency string, delta decimal.Decimal) error {
	var account models.Account

	err := db.First(&account, "id = ? AND user_id = ? AND deleted_at IS NULL", accountId, userId).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return fmt.Errorf("%w: %s", ErrAccountNotFound, accountId)
	}
	if err != nil {
		return err
	}

	if account.Currency != currency {
		return fmt.Errorf("%w: transaction %s, account %s", ErrAccountCurrencyMismatch, currency, account.Currency)
	}

	return adjustAccountBalance(db, userId, accountId, delta)
}

// reverseFromAccount takes a posting back off the account it was applied to. The
// values were validated when they were written, so only the account itself is
// re-checked.
func reverseFromAccount(db *gorm.DB, userId uuid.UUID, transaction models.Transaction) error {
	reversal := balanceEffect(transaction.Type, transaction.Value).Neg()

	return adjustAccountBalance(db, userId, *transaction.AccountId, reversal)
}

// ensureCategoryExists checks the category is one the user may label with: their
// own, or a global default. Python relies on the foreign key alone, which also
// accepts another user's private category id.
func ensureCategoryExists(db *gorm.DB, userId uuid.UUID, categoryId int) error {
	var count int64

	err := db.Model(&models.Category{}).
		Where("id = ? AND (user_id = ? OR user_id IS NULL) AND deleted_at IS NULL", categoryId, userId).
		Count(&count).Error
	if err != nil {
		return err
	}

	if count == 0 {
		return fmt.Errorf("%w: %d", ErrCategoryNotFound, categoryId)
	}

	return nil
}

func toTransactionSchema(transaction models.Transaction, converter CurrencyConverter) (schemas.TransactionSchema, error) {
	localized, ok := converter.Convert(transaction.Value, transaction.Currency)
	if !ok {
		return schemas.TransactionSchema{}, fmt.Errorf("%w: %s to %s", ErrRateUnavailable, transaction.Currency, converter.Target())
	}

	schema := schemas.TransactionSchema{
		Id:          transaction.Id,
		Date:        transaction.Date.Format(dateLayout),
		Type:        transaction.Type,
		Title:       transaction.Title,
		Description: transaction.Description,
		Amount: schemas.AmountSchema{
			Value:    transaction.Value,
			Currency: transaction.Currency,
		},
		LocalizedAmount: schemas.AmountSchema{
			Value:    localized,
			Currency: converter.Target(),
		},
		Tags: []string{},
	}

	if transaction.Category != nil {
		category := toCategorySchema(*transaction.Category)
		schema.Category = &category
	}

	if transaction.Account != nil {
		account := toAccountBaseSchema(*transaction.Account)
		schema.Account = &account
	}

	return schema, nil
}

// GetTransactionById returns one of the user's transactions with its category
// and account attached. The write endpoints answer with it, so a client sees the
// stored result of what it just sent.
func GetTransactionById(userId uuid.UUID, transactionId uuid.UUID) (schemas.TransactionSchema, error) {
	// One statement: the transaction, its category and account, and the rate
	// for the transaction's own date — a transaction is worth what it was worth
	// on the day it happened, not what it would be worth today.
	row, err := queries.GetTransaction(core.DB, userId, transactionId)
	if err != nil {
		return schemas.TransactionSchema{}, err
	}

	return toTransactionSchema(row.Transaction(), converterForRow(row))
}

// CreateTransaction records a transaction and moves the balance of the account
// it is posted to. Both happen in one database transaction, so a row can never
// exist without its effect on the balance, or the other way round.
func CreateTransaction(userId uuid.UUID, schema schemas.CreateTransactionSchema) (schemas.TransactionSchema, error) {
	date, err := composeTransactionDate(schema.Year, schema.Month, schema.Day)
	if err != nil {
		return schemas.TransactionSchema{}, err
	}

	transaction := models.Transaction{
		BaseModel:   models.BaseModel{Id: uuid.New()},
		Date:        date,
		Type:        schema.Type,
		Title:       schema.Title,
		Description: schema.Description,
		Value:       *schema.Value,
		Currency:    normalizeCurrency(schema.Currency),
		CategoryId:  schema.CategoryId,
		AccountId:   schema.AccountId,
		UserId:      userId,
	}

	err = core.DB.Transaction(func(db *gorm.DB) error {
		if transaction.CategoryId != nil {
			if err := ensureCategoryExists(db, userId, *transaction.CategoryId); err != nil {
				return err
			}
		}

		if transaction.AccountId != nil {
			delta := balanceEffect(transaction.Type, transaction.Value)
			if err := postToAccount(db, userId, *transaction.AccountId, transaction.Currency, delta); err != nil {
				return err
			}
		}

		return db.Create(&transaction).Error
	})
	if err != nil {
		return schemas.TransactionSchema{}, err
	}

	return GetTransactionById(userId, transaction.Id)
}

// UpdateTransaction replaces a transaction's fields and rebalances whatever
// accounts are involved. Every field in the payload is written, so an omitted
// description, category or account clears the stored one; the date is not part
// of the payload and cannot be changed.
func UpdateTransaction(userId uuid.UUID, schema schemas.UpdateTransactionSchema) (schemas.TransactionSchema, error) {
	err := core.DB.Transaction(func(db *gorm.DB) error {
		var existing models.Transaction

		// The deleted_at filter is what stops an update resurrecting a deleted
		// transaction and re-applying its effect to a balance.
		if err := db.First(&existing, "id = ? AND user_id = ? AND deleted_at IS NULL", schema.Id, userId).Error; err != nil {
			return err
		}

		if schema.CategoryId != nil {
			if err := ensureCategoryExists(db, userId, *schema.CategoryId); err != nil {
				return err
			}
		}

		// Take the old posting off first, then apply the new one. An update can
		// move a transaction between accounts, flip its direction or change its
		// value, and reversing before applying leaves every account it touches
		// correct in all of those cases — including when the account is the same
		// one, where the two adjustments simply net out.
		if existing.AccountId != nil {
			if err := reverseFromAccount(db, userId, existing); err != nil {
				return err
			}
		}

		currency := normalizeCurrency(schema.Currency)

		if schema.AccountId != nil {
			delta := balanceEffect(schema.Type, *schema.Value)
			if err := postToAccount(db, userId, *schema.AccountId, currency, delta); err != nil {
				return err
			}
		}

		// A map rather than a struct: the nil pointers have to be written as
		// NULL, and GORM skips zero values when updating from a struct.
		return db.Model(&existing).Updates(map[string]any{
			"title":       schema.Title,
			"description": schema.Description,
			"type":        schema.Type,
			"value":       *schema.Value,
			"currency":    currency,
			"category_id": schema.CategoryId,
			"account_id":  schema.AccountId,
		}).Error
	})
	if err != nil {
		return schemas.TransactionSchema{}, err
	}

	return GetTransactionById(userId, schema.Id)
}

// DeleteTransaction takes the transaction's effect back off its account and soft
// deletes it.
//
// It is idempotent, and that matters more here than it does elsewhere: Python
// does not filter on deleted_at, so deleting an already-deleted transaction
// reverses the balance a second time. The filter makes the repeat a no-op.
func DeleteTransaction(userId uuid.UUID, transactionId uuid.UUID) error {
	return core.DB.Transaction(func(db *gorm.DB) error {
		var transaction models.Transaction

		err := db.First(&transaction, "id = ? AND user_id = ? AND deleted_at IS NULL", transactionId, userId).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil
		}
		if err != nil {
			return err
		}

		if transaction.AccountId != nil {
			if err := reverseFromAccount(db, userId, transaction); err != nil {
				return err
			}
		}

		return db.Model(&transaction).Update("deleted_at", gorm.Expr("CURRENT_TIMESTAMP")).Error
	})
}

// ListTransactions returns the user's transactions grouped by the day they
// happened on, newest day first.
//
// The page is cut by day, not by transaction, so total counts days and a page
// of ten can hold any number of transactions. That is what the plpgsql
// list_transactions function did with its temp table of distinct dates, and it
// is the shape the clients render.
//
// The whole listing is one database round trip. The rows arrive already ordered
// by day, so grouping them is a walk rather than a map: a row whose day differs
// from the one before it opens the next group.
func ListTransactions(
	userId uuid.UUID,
	filters schemas.ListTransactionsFilters,
	page int,
	take int,
) (schemas.PaginatedResponse[schemas.DateTransactionsSchema], error) {
	response := schemas.PaginatedResponse[schemas.DateTransactionsSchema]{
		Page:  page,
		Take:  take,
		Items: []schemas.DateTransactionsSchema{},
	}

	rows, total, err := queries.ListTransactions(core.DB, userId, filters, page, take)
	if err != nil {
		return response, err
	}

	response.Total = total

	for _, row := range rows {
		schema, err := toTransactionSchema(row.Transaction(), converterForRow(row))
		if err != nil {
			return response, err
		}

		day := row.Date.Format(dateLayout)
		if len(response.Items) == 0 || response.Items[len(response.Items)-1].Date != day {
			response.Items = append(response.Items, schemas.DateTransactionsSchema{
				Date:         day,
				Transactions: []schemas.TransactionSchema{},
			})
		}

		group := &response.Items[len(response.Items)-1]
		group.Transactions = append(group.Transactions, schema)
	}

	return response, nil
}

// GetTransactionsByDate returns everything the user spent or earned on one day.
//
// It answers nothing at all for a day with no transactions, rather than an empty
// group, because that is the response the clients already read.
func GetTransactionsByDate(userId uuid.UUID, date time.Time) (*schemas.DateTransactionsSchema, error) {
	rows, err := queries.TransactionsOnDate(core.DB, userId, date)
	if err != nil {
		return nil, err
	}

	if len(rows) == 0 {
		return nil, nil
	}

	group := schemas.DateTransactionsSchema{
		Date:         date.Format(dateLayout),
		Transactions: make([]schemas.TransactionSchema, 0, len(rows)),
	}

	for _, row := range rows {
		schema, err := toTransactionSchema(row.Transaction(), converterForRow(row))
		if err != nil {
			return nil, err
		}

		group.Transactions = append(group.Transactions, schema)
	}

	return &group, nil
}

// GetLatestTransactions returns the user's most recent transactions, newest
// first — by the day the money moved, not by the day the row was written.
func GetLatestTransactions(userId uuid.UUID, limit int) ([]schemas.TransactionSchema, error) {
	response := []schemas.TransactionSchema{}

	rows, err := queries.LatestTransactions(core.DB, userId, limit)
	if err != nil {
		return response, err
	}

	for _, row := range rows {
		schema, err := toTransactionSchema(row.Transaction(), converterForRow(row))
		if err != nil {
			return response, err
		}

		response = append(response, schema)
	}

	return response, nil
}

// GetTransactionsConfiguration bundles what a client needs to fill in the
// transaction form: the categories it may label with, and the accounts it may
// post to. It is one request rather than three, and one statement rather than
// two.
func GetTransactionsConfiguration(userId uuid.UUID) (schemas.TransactionsConfigurationSchema, error) {
	response := schemas.TransactionsConfigurationSchema{
		Categories: []schemas.CategorySchema{},
		Accounts:   []schemas.AccountBaseSchema{},
		// Tags are not ported. The key stays so the response shape holds.
		Tags: []string{},
	}

	categories, accounts, err := queries.TransactionsConfiguration(core.DB, userId)
	if err != nil {
		return response, err
	}

	for _, category := range categories {
		response.Categories = append(response.Categories, toCategorySchema(category))
	}

	for _, account := range accounts {
		response.Accounts = append(response.Accounts, toAccountBaseSchema(account))
	}

	return response, nil
}
