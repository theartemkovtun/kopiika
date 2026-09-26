package services_test

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"

	"kopiika-api-go/src/core"
	"kopiika-api-go/src/models"
	"kopiika-api-go/src/schemas"
	"kopiika-api-go/src/services"
	"kopiika-api-go/tests/testutil"
)

// foodCategory is one of the global defaults the migrations seed.
const foodCategory = 1

func ptr[T any](value T) *T { return &value }

func amount(value string) *decimal.Decimal { return ptr(decimal.RequireFromString(value)) }

func seedUser(t *testing.T, currency string) uuid.UUID {
	t.Helper()
	user := models.User{BaseModel: models.BaseModel{Id: uuid.New()}, Name: "Test", Language: "en", Currency: currency}
	require.NoError(t, core.DB.Create(&user).Error)
	return user.Id
}

func seedAccount(t *testing.T, userID uuid.UUID, currency string, value string) uuid.UUID {
	t.Helper()
	account := models.Account{
		BaseModel: models.BaseModel{Id: uuid.New()},
		Name:      "Card " + currency,
		Value:     decimal.RequireFromString(value),
		Currency:  currency,
		ColorHex:  "#1E88E5",
		UserId:    userID,
	}
	require.NoError(t, core.DB.Create(&account).Error)
	return account.Id
}

func deleteAccount(t *testing.T, accountID uuid.UUID) {
	t.Helper()
	require.NoError(t, core.DB.Model(&models.Account{}).Where("id = ?", accountID).
		Update("deleted_at", gorm.Expr("CURRENT_TIMESTAMP")).Error)
}

// accountValue is the stored balance, trimmed of the column's trailing zeros.
func accountValue(t *testing.T, accountID uuid.UUID) string {
	t.Helper()
	var account models.Account
	require.NoError(t, core.DB.First(&account, "id = ?", accountID).Error)
	return account.Value.String()
}

func seedCategory(t *testing.T, userID uuid.UUID) int {
	t.Helper()
	category := models.Category{Name: "Own", Icon: "icon-dots", HexColor: "#252525", UserId: &userID}
	require.NoError(t, core.DB.Create(&category).Error)
	return category.Id
}

func hideCategory(t *testing.T, userID uuid.UUID, categoryID int) {
	t.Helper()
	require.NoError(t, core.DB.Create(&models.HiddenCategory{UserId: userID, CategoryId: categoryID}).Error)
}

// seedTransaction writes a transaction row directly, without touching any
// balance, filling in whatever the test does not care about. CreatedAt is the
// test's to set: inside one database transaction CURRENT_TIMESTAMP never
// moves, so the order within a day would otherwise come down to the ids.
func seedTransaction(t *testing.T, transaction models.Transaction) uuid.UUID {
	t.Helper()
	transaction.Id = uuid.New()
	if transaction.Type == "" {
		transaction.Type = string(models.TransactionTypeOutcome)
	}
	if transaction.Title == "" {
		transaction.Title = "Coffee"
	}
	if transaction.Value.IsZero() {
		transaction.Value = decimal.NewFromInt(10)
	}
	if transaction.Currency == "" {
		transaction.Currency = "uah"
	}
	require.NoError(t, core.DB.Create(&transaction).Error)
	return transaction.Id
}

// at is a creation time a given number of minutes into a fixed day.
func at(minutes int) time.Time {
	return time.Date(2026, time.September, 1, 12, minutes, 0, 0, time.UTC)
}

// createdAt and deletedAt are the BaseModel of a row written, or deleted, that
// many minutes in. seedTransaction assigns the id.
func createdAt(minutes int) models.BaseModel { return models.BaseModel{CreatedAt: at(minutes)} }

func deletedAt(minutes int) models.BaseModel { return models.BaseModel{DeletedAt: ptr(at(minutes))} }

func transactionIDs(transactions []schemas.TransactionSchema) []uuid.UUID {
	ids := make([]uuid.UUID, 0, len(transactions))
	for _, transaction := range transactions {
		ids = append(ids, transaction.Id)
	}
	return ids
}

func TestCreateTransaction(t *testing.T) {
	testutil.UseDB(t)
	userID := seedUser(t, "uah")
	accountID := seedAccount(t, userID, "uah", "1000")

	created, err := services.CreateTransaction(userID, schemas.CreateTransactionSchema{
		Type:        "outcome",
		Title:       "Groceries",
		Value:       amount("125.40"),
		Currency:    " UAH ",
		Description: ptr("Weekly shop"),
		CategoryId:  ptr(foodCategory),
		AccountId:   &accountID,
		Year:        2026,
		Month:       9,
		Day:         12,
	})
	require.NoError(t, err)

	assert.Equal(t, "2026-09-12", created.Date)
	assert.Equal(t, "outcome", created.Type)
	assert.Equal(t, "Groceries", created.Title)
	require.NotNil(t, created.Description)
	assert.Equal(t, "Weekly shop", *created.Description)
	assert.Equal(t, "125.4", created.Amount.Value.String())
	assert.Equal(t, "uah", created.Amount.Currency, "currency is normalized")
	assert.Equal(t, "125.4", created.LocalizedAmount.Value.String(), "own currency needs no rate")
	assert.Equal(t, "uah", created.LocalizedAmount.Currency)
	assert.Equal(t, []string{}, created.Tags)
	require.NotNil(t, created.Category)
	assert.Equal(t, foodCategory, created.Category.Id)
	assert.Equal(t, "food", created.Category.Name)
	require.NotNil(t, created.Account)
	assert.Equal(t, accountID, created.Account.Id)

	assert.Equal(t, "874.6", accountValue(t, accountID), "outcome subtracts")

	stored, err := services.GetTransactionById(userID, created.Id)
	require.NoError(t, err)
	assert.Equal(t, created, stored)

	_, err = services.CreateTransaction(userID, schemas.CreateTransactionSchema{
		Type: "income", Title: "Salary", Value: amount("500"), Currency: "uah",
		AccountId: &accountID, Year: 2026, Month: 9, Day: 13,
	})
	require.NoError(t, err)
	assert.Equal(t, "1374.6", accountValue(t, accountID), "income adds")

	unposted, err := services.CreateTransaction(userID, schemas.CreateTransactionSchema{
		Type: "outcome", Title: "Cash", Value: amount("0"), Currency: "uah",
		Year: 2026, Month: 9, Day: 13,
	})
	require.NoError(t, err)
	assert.Nil(t, unposted.Account)
	assert.Nil(t, unposted.Category)
	assert.Equal(t, "0", unposted.Amount.Value.String(), "an explicit zero is accepted")
	assert.Equal(t, "1374.6", accountValue(t, accountID))
}

func TestCreateTransactionLocalizesAtItsOwnDate(t *testing.T) {
	testutil.UseDB(t)
	userID := seedUser(t, "uah")
	seedRates(t,
		seededRate{Date: "2026-09-10", From: "usd", To: "uah", Rate: "41.00"},
		seededRate{Date: "2026-09-20", From: "usd", To: "uah", Rate: "99.00"},
	)

	created, err := services.CreateTransaction(userID, schemas.CreateTransactionSchema{
		Type: "outcome", Title: "Book", Value: amount("10"), Currency: "usd",
		Year: 2026, Month: 9, Day: 12,
	})
	require.NoError(t, err)

	assert.Equal(t, "10", created.Amount.Value.String())
	assert.Equal(t, "usd", created.Amount.Currency)
	assert.Equal(t, "410", created.LocalizedAmount.Value.String(), "the rate on or before the day, not a later one")
	assert.Equal(t, "uah", created.LocalizedAmount.Currency)

	// A pair with no recorded rate is reported, not converted to zero.
	_, err = services.CreateTransaction(userID, schemas.CreateTransactionSchema{
		Type: "outcome", Title: "Tea", Value: amount("10"), Currency: "gbp",
		Year: 2026, Month: 9, Day: 12,
	})
	assert.ErrorIs(t, err, services.ErrRateUnavailable)
}

func TestCreateTransactionRejects(t *testing.T) {
	testutil.UseDB(t)
	userID := seedUser(t, "uah")
	otherID := seedUser(t, "uah")

	accountID := seedAccount(t, userID, "uah", "1000")
	usdAccountID := seedAccount(t, userID, "usd", "1000")
	deletedAccountID := seedAccount(t, userID, "uah", "1000")
	deleteAccount(t, deletedAccountID)
	otherAccountID := seedAccount(t, otherID, "uah", "1000")

	otherCategoryID := seedCategory(t, otherID)
	hideCategory(t, userID, foodCategory)

	cases := []struct {
		name    string
		mutate  func(*schemas.CreateTransactionSchema)
		wantErr error
	}{
		{
			name:    "a day that does not exist",
			mutate:  func(s *schemas.CreateTransactionSchema) { s.Month, s.Day = 2, 31 },
			wantErr: services.ErrInvalidTransactionDate,
		},
		{
			name:    "an unknown account",
			mutate:  func(s *schemas.CreateTransactionSchema) { s.AccountId = ptr(uuid.New()) },
			wantErr: services.ErrAccountNotFound,
		},
		{
			name:    "another user's account",
			mutate:  func(s *schemas.CreateTransactionSchema) { s.AccountId = &otherAccountID },
			wantErr: services.ErrAccountNotFound,
		},
		{
			name:    "a deleted account",
			mutate:  func(s *schemas.CreateTransactionSchema) { s.AccountId = &deletedAccountID },
			wantErr: services.ErrAccountNotFound,
		},
		{
			name:    "an account in another currency",
			mutate:  func(s *schemas.CreateTransactionSchema) { s.AccountId = &usdAccountID },
			wantErr: services.ErrAccountCurrencyMismatch,
		},
		{
			name:    "an unknown category",
			mutate:  func(s *schemas.CreateTransactionSchema) { s.CategoryId = ptr(999999) },
			wantErr: services.ErrCategoryNotFound,
		},
		{
			name:    "another user's category",
			mutate:  func(s *schemas.CreateTransactionSchema) { s.CategoryId = &otherCategoryID },
			wantErr: services.ErrCategoryNotFound,
		},
		{
			name:    "a hidden default category",
			mutate:  func(s *schemas.CreateTransactionSchema) { s.CategoryId = ptr(foodCategory) },
			wantErr: services.ErrCategoryHidden,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			payload := schemas.CreateTransactionSchema{
				Type: "outcome", Title: "Rejected", Value: amount("100"), Currency: "uah",
				AccountId: &accountID, Year: 2026, Month: 9, Day: 12,
			}
			tc.mutate(&payload)

			_, err := services.CreateTransaction(userID, payload)
			assert.ErrorIs(t, err, tc.wantErr)
		})
	}

	// Nothing a rejected create did survives it: no row, and no balance moved.
	var count int64
	require.NoError(t, core.DB.Model(&models.Transaction{}).Where("user_id = ?", userID).Count(&count).Error)
	assert.Zero(t, count)
	for _, id := range []uuid.UUID{accountID, usdAccountID, deletedAccountID, otherAccountID} {
		assert.Equal(t, "1000", accountValue(t, id))
	}
}

func TestUpdateTransaction(t *testing.T) {
	testutil.UseDB(t)
	userID := seedUser(t, "uah")
	accountA := seedAccount(t, userID, "uah", "1000")
	accountB := seedAccount(t, userID, "uah", "500")

	created, err := services.CreateTransaction(userID, schemas.CreateTransactionSchema{
		Type: "outcome", Title: "Groceries", Value: amount("100"), Currency: "uah",
		Description: ptr("Weekly shop"), CategoryId: ptr(foodCategory), AccountId: &accountA,
		Year: 2026, Month: 9, Day: 12,
	})
	require.NoError(t, err)
	require.Equal(t, "900", accountValue(t, accountA))

	update := func(t *testing.T, schema schemas.UpdateTransactionSchema) schemas.TransactionSchema {
		t.Helper()
		schema.Id = created.Id
		updated, err := services.UpdateTransaction(userID, schema)
		require.NoError(t, err)
		return updated
	}

	t.Run("a new value on the same account nets out", func(t *testing.T) {
		updated := update(t, schemas.UpdateTransactionSchema{
			Type: "outcome", Title: "Groceries", Value: amount("250"), Currency: "uah",
			Description: ptr("Weekly shop"), CategoryId: ptr(foodCategory), AccountId: &accountA,
		})
		assert.Equal(t, "250", updated.Amount.Value.String())
		assert.Equal(t, "750", accountValue(t, accountA))
	})

	t.Run("flipping the direction", func(t *testing.T) {
		updated := update(t, schemas.UpdateTransactionSchema{
			Type: "income", Title: "Refund", Value: amount("250"), Currency: "uah", AccountId: &accountA,
		})
		assert.Equal(t, "income", updated.Type)
		assert.Equal(t, "Refund", updated.Title)
		assert.Equal(t, "1250", accountValue(t, accountA))
	})

	t.Run("moving to another account", func(t *testing.T) {
		updated := update(t, schemas.UpdateTransactionSchema{
			Type: "outcome", Title: "Groceries", Value: amount("100"), Currency: "UAH", AccountId: &accountB,
		})
		require.NotNil(t, updated.Account)
		assert.Equal(t, accountB, updated.Account.Id)
		assert.Equal(t, "1000", accountValue(t, accountA))
		assert.Equal(t, "400", accountValue(t, accountB))
	})

	t.Run("omitted fields are cleared, the date is kept", func(t *testing.T) {
		updated := update(t, schemas.UpdateTransactionSchema{
			Type: "outcome", Title: "Groceries", Value: amount("100"), Currency: "uah",
		})
		assert.Nil(t, updated.Description)
		assert.Nil(t, updated.Category)
		assert.Nil(t, updated.Account)
		assert.Equal(t, "2026-09-12", updated.Date)
		assert.Equal(t, "1000", accountValue(t, accountA))
		assert.Equal(t, "500", accountValue(t, accountB))
	})
}

func TestUpdateTransactionHiddenCategory(t *testing.T) {
	testutil.UseDB(t)
	userID := seedUser(t, "uah")
	const transportCategory = 2

	created, err := services.CreateTransaction(userID, schemas.CreateTransactionSchema{
		Type: "outcome", Title: "Groceries", Value: amount("100"), Currency: "uah",
		CategoryId: ptr(foodCategory), Year: 2026, Month: 9, Day: 12,
	})
	require.NoError(t, err)

	hideCategory(t, userID, foodCategory)
	hideCategory(t, userID, transportCategory)

	// Hiding stops new use, not editing what was already labelled.
	updated, err := services.UpdateTransaction(userID, schemas.UpdateTransactionSchema{
		Id: created.Id, Type: "outcome", Title: "Market", Value: amount("100"), Currency: "uah",
		CategoryId: ptr(foodCategory),
	})
	require.NoError(t, err)
	assert.Equal(t, "Market", updated.Title)

	_, err = services.UpdateTransaction(userID, schemas.UpdateTransactionSchema{
		Id: created.Id, Type: "outcome", Title: "Bus", Value: amount("100"), Currency: "uah",
		CategoryId: ptr(transportCategory),
	})
	assert.ErrorIs(t, err, services.ErrCategoryHidden)
}

func TestUpdateTransactionRejects(t *testing.T) {
	testutil.UseDB(t)
	userID := seedUser(t, "uah")
	otherID := seedUser(t, "uah")
	accountID := seedAccount(t, userID, "uah", "1000")
	usdAccountID := seedAccount(t, userID, "usd", "1000")
	otherCategoryID := seedCategory(t, otherID)

	created, err := services.CreateTransaction(userID, schemas.CreateTransactionSchema{
		Type: "outcome", Title: "Groceries", Value: amount("100"), Currency: "uah",
		AccountId: &accountID, Year: 2026, Month: 9, Day: 12,
	})
	require.NoError(t, err)

	deleted, err := services.CreateTransaction(userID, schemas.CreateTransactionSchema{
		Type: "outcome", Title: "Deleted", Value: amount("50"), Currency: "uah",
		AccountId: &accountID, Year: 2026, Month: 9, Day: 12,
	})
	require.NoError(t, err)
	require.NoError(t, services.DeleteTransaction(userID, deleted.Id))
	require.Equal(t, "900", accountValue(t, accountID))

	cases := []struct {
		name    string
		userID  uuid.UUID
		mutate  func(*schemas.UpdateTransactionSchema)
		wantErr error
	}{
		{
			name:    "an account in another currency",
			userID:  userID,
			mutate:  func(s *schemas.UpdateTransactionSchema) { s.AccountId = &usdAccountID },
			wantErr: services.ErrAccountCurrencyMismatch,
		},
		{
			name:    "an unknown account",
			userID:  userID,
			mutate:  func(s *schemas.UpdateTransactionSchema) { s.AccountId = ptr(uuid.New()) },
			wantErr: services.ErrAccountNotFound,
		},
		{
			name:    "another user's category",
			userID:  userID,
			mutate:  func(s *schemas.UpdateTransactionSchema) { s.CategoryId = &otherCategoryID },
			wantErr: services.ErrCategoryNotFound,
		},
		{
			name:    "a deleted transaction is not resurrected",
			userID:  userID,
			mutate:  func(s *schemas.UpdateTransactionSchema) { s.Id = deleted.Id },
			wantErr: gorm.ErrRecordNotFound,
		},
		{
			name:    "another user's transaction",
			userID:  otherID,
			mutate:  func(*schemas.UpdateTransactionSchema) {},
			wantErr: gorm.ErrRecordNotFound,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			payload := schemas.UpdateTransactionSchema{
				Id: created.Id, Type: "outcome", Title: "Changed", Value: amount("300"), Currency: "uah",
				AccountId: &accountID,
			}
			tc.mutate(&payload)

			_, err := services.UpdateTransaction(tc.userID, payload)
			assert.ErrorIs(t, err, tc.wantErr)
		})
	}

	// The reversal an update makes before it fails is rolled back with it.
	assert.Equal(t, "900", accountValue(t, accountID))
	assert.Equal(t, "1000", accountValue(t, usdAccountID))

	stored, err := services.GetTransactionById(userID, created.Id)
	require.NoError(t, err)
	assert.Equal(t, created, stored)
}

func TestDeleteTransaction(t *testing.T) {
	testutil.UseDB(t)
	userID := seedUser(t, "uah")
	otherID := seedUser(t, "uah")
	accountID := seedAccount(t, userID, "uah", "1000")

	created, err := services.CreateTransaction(userID, schemas.CreateTransactionSchema{
		Type: "income", Title: "Salary", Value: amount("300"), Currency: "uah",
		AccountId: &accountID, Year: 2026, Month: 9, Day: 12,
	})
	require.NoError(t, err)
	require.Equal(t, "1300", accountValue(t, accountID))

	// Another user cannot delete it, and is not told it exists.
	require.NoError(t, services.DeleteTransaction(otherID, created.Id))
	assert.Equal(t, "1300", accountValue(t, accountID))

	require.NoError(t, services.DeleteTransaction(userID, created.Id))
	assert.Equal(t, "1000", accountValue(t, accountID), "the effect is reversed")

	_, err = services.GetTransactionById(userID, created.Id)
	assert.ErrorIs(t, err, gorm.ErrRecordNotFound)

	// Deleting again reverses nothing a second time.
	require.NoError(t, services.DeleteTransaction(userID, created.Id))
	assert.Equal(t, "1000", accountValue(t, accountID))

	require.NoError(t, services.DeleteTransaction(userID, uuid.New()), "an unknown id is a no-op")
}

func TestGetTransactionById(t *testing.T) {
	testutil.UseDB(t)
	userID := seedUser(t, "uah")
	otherID := seedUser(t, "uah")
	id := seedTransaction(t, models.Transaction{UserId: userID, Date: testutil.MustDate(t, "2026-09-12")})

	_, err := services.GetTransactionById(otherID, id)
	assert.ErrorIs(t, err, gorm.ErrRecordNotFound, "another user's transaction")

	_, err = services.GetTransactionById(uuid.New(), id)
	assert.ErrorIs(t, err, gorm.ErrRecordNotFound, "an unknown user")
}

func TestListTransactions(t *testing.T) {
	testutil.UseDB(t)
	userID := seedUser(t, "uah")
	otherID := seedUser(t, "uah")
	cardID := seedAccount(t, userID, "uah", "0")
	cashID := seedAccount(t, userID, "uah", "0")
	ownCategoryID := seedCategory(t, userID)

	day := func(value string) time.Time { return testutil.MustDate(t, value) }

	lunch := seedTransaction(t, models.Transaction{
		UserId: userID, Date: day("2026-09-12"), Title: "Lunch", BaseModel: createdAt(1),
		CategoryId: ptr(foodCategory), AccountId: &cardID,
	})
	dinner := seedTransaction(t, models.Transaction{
		UserId: userID, Date: day("2026-09-12"), Title: "Dinner", BaseModel: createdAt(2),
		CategoryId: ptr(foodCategory), AccountId: &cashID,
	})
	salary := seedTransaction(t, models.Transaction{
		UserId: userID, Date: day("2026-09-10"), Title: "Salary", BaseModel: createdAt(3),
		Type: string(models.TransactionTypeIncome), AccountId: &cardID,
	})
	course := seedTransaction(t, models.Transaction{
		UserId: userID, Date: day("2026-09-05"), Title: "Course", BaseModel: createdAt(4),
		CategoryId: &ownCategoryID,
	})
	seedTransaction(t, models.Transaction{
		UserId: userID, Date: day("2026-09-11"), Title: "Deleted", BaseModel: deletedAt(5),
	})
	seedTransaction(t, models.Transaction{UserId: otherID, Date: day("2026-09-11"), Title: "Lunch"})

	t.Run("grouped by day, newest first, paged by day", func(t *testing.T) {
		page, err := services.ListTransactions(userID, schemas.ListTransactionsFilters{}, 1, 2)
		require.NoError(t, err)

		assert.Equal(t, int64(3), page.Total, "counts days, not transactions")
		assert.Equal(t, 1, page.Page)
		assert.Equal(t, 2, page.Take)
		require.Len(t, page.Items, 2)
		assert.Equal(t, "2026-09-12", page.Items[0].Date)
		assert.Equal(t, []uuid.UUID{dinner, lunch}, transactionIDs(page.Items[0].Transactions),
			"most recently recorded first")
		assert.Equal(t, "2026-09-10", page.Items[1].Date)
		assert.Equal(t, []uuid.UUID{salary}, transactionIDs(page.Items[1].Transactions))

		next, err := services.ListTransactions(userID, schemas.ListTransactionsFilters{}, 2, 2)
		require.NoError(t, err)
		assert.Equal(t, int64(3), next.Total)
		require.Len(t, next.Items, 1)
		assert.Equal(t, []uuid.UUID{course}, transactionIDs(next.Items[0].Transactions))
	})

	t.Run("a page past the end keeps the total", func(t *testing.T) {
		page, err := services.ListTransactions(userID, schemas.ListTransactionsFilters{}, 5, 2)
		require.NoError(t, err)
		assert.Equal(t, int64(3), page.Total)
		assert.Equal(t, []schemas.DateTransactionsSchema{}, page.Items)
	})

	filters := []struct {
		name    string
		filters schemas.ListTransactionsFilters
		want    []uuid.UUID
	}{
		{name: "type", filters: schemas.ListTransactionsFilters{Type: "income"}, want: []uuid.UUID{salary}},
		{name: "search ignores case", filters: schemas.ListTransactionsFilters{Search: "LUN"}, want: []uuid.UUID{lunch}},
		{
			name:    "date range is inclusive",
			filters: schemas.ListTransactionsFilters{FromDate: ptr(day("2026-09-05")), ToDate: ptr(day("2026-09-10"))},
			want:    []uuid.UUID{salary, course},
		},
		{
			name:    "categories",
			filters: schemas.ListTransactionsFilters{CategoryIds: []int{ownCategoryID}},
			want:    []uuid.UUID{course},
		},
		{
			name:    "accounts",
			filters: schemas.ListTransactionsFilters{AccountIds: []uuid.UUID{cardID}},
			want:    []uuid.UUID{lunch, salary},
		},
		{
			name:    "combined",
			filters: schemas.ListTransactionsFilters{Type: "outcome", AccountIds: []uuid.UUID{cardID, cashID}},
			want:    []uuid.UUID{dinner, lunch},
		},
		{name: "nothing matches", filters: schemas.ListTransactionsFilters{Search: "rent"}, want: []uuid.UUID{}},
	}

	for _, tc := range filters {
		t.Run("filter by "+tc.name, func(t *testing.T) {
			page, err := services.ListTransactions(userID, tc.filters, 1, 10)
			require.NoError(t, err)

			got := []uuid.UUID{}
			for _, group := range page.Items {
				got = append(got, transactionIDs(group.Transactions)...)
			}
			assert.Equal(t, tc.want, got)
		})
	}

	t.Run("an unknown user", func(t *testing.T) {
		_, err := services.ListTransactions(uuid.New(), schemas.ListTransactionsFilters{}, 1, 10)
		assert.ErrorIs(t, err, gorm.ErrRecordNotFound)
	})
}

func TestListTransactionsLocalizes(t *testing.T) {
	testutil.UseDB(t)
	userID := seedUser(t, "uah")
	seedRates(t,
		seededRate{Date: "2026-09-10", From: "usd", To: "uah", Rate: "40.00"},
		seededRate{Date: "2026-09-12", From: "usd", To: "uah", Rate: "42.00"},
	)
	seedTransaction(t, models.Transaction{
		UserId: userID, Date: testutil.MustDate(t, "2026-09-12"), Value: decimal.NewFromInt(10), Currency: "usd",
	})
	seedTransaction(t, models.Transaction{
		UserId: userID, Date: testutil.MustDate(t, "2026-09-11"), Value: decimal.NewFromInt(10), Currency: "usd",
	})

	page, err := services.ListTransactions(userID, schemas.ListTransactionsFilters{}, 1, 10)
	require.NoError(t, err)
	require.Len(t, page.Items, 2)
	assert.Equal(t, "420", page.Items[0].Transactions[0].LocalizedAmount.Value.String())
	assert.Equal(t, "400", page.Items[1].Transactions[0].LocalizedAmount.Value.String())

	// One unconvertible row fails the listing rather than showing a zero.
	seedTransaction(t, models.Transaction{
		UserId: userID, Date: testutil.MustDate(t, "2026-09-11"), Currency: "gbp",
	})
	_, err = services.ListTransactions(userID, schemas.ListTransactionsFilters{}, 1, 10)
	assert.ErrorIs(t, err, services.ErrRateUnavailable)
}

func TestGetTransactionsByDate(t *testing.T) {
	testutil.UseDB(t)
	userID := seedUser(t, "uah")
	otherID := seedUser(t, "uah")
	day := testutil.MustDate(t, "2026-09-12")

	first := seedTransaction(t, models.Transaction{UserId: userID, Date: day, BaseModel: createdAt(1)})
	second := seedTransaction(t, models.Transaction{UserId: userID, Date: day, BaseModel: createdAt(2)})
	seedTransaction(t, models.Transaction{UserId: userID, Date: day, BaseModel: deletedAt(3)})
	seedTransaction(t, models.Transaction{UserId: userID, Date: testutil.MustDate(t, "2026-09-13")})
	seedTransaction(t, models.Transaction{UserId: otherID, Date: day})

	group, err := services.GetTransactionsByDate(userID, day)
	require.NoError(t, err)
	require.NotNil(t, group)
	assert.Equal(t, "2026-09-12", group.Date)
	assert.Equal(t, []uuid.UUID{second, first}, transactionIDs(group.Transactions))

	empty, err := services.GetTransactionsByDate(userID, testutil.MustDate(t, "2026-09-14"))
	require.NoError(t, err)
	assert.Nil(t, empty, "a day with nothing on it is no group at all")
}

func TestGetLatestTransactions(t *testing.T) {
	testutil.UseDB(t)
	userID := seedUser(t, "uah")
	otherID := seedUser(t, "uah")

	// Written in the opposite order to the days they happened on.
	newest := seedTransaction(t, models.Transaction{UserId: userID, Date: testutil.MustDate(t, "2026-09-12"), BaseModel: createdAt(1)})
	middle := seedTransaction(t, models.Transaction{UserId: userID, Date: testutil.MustDate(t, "2026-09-11"), BaseModel: createdAt(2)})
	seedTransaction(t, models.Transaction{UserId: userID, Date: testutil.MustDate(t, "2026-09-10"), BaseModel: createdAt(3)})
	seedTransaction(t, models.Transaction{UserId: userID, Date: testutil.MustDate(t, "2026-09-13"), BaseModel: deletedAt(4)})
	seedTransaction(t, models.Transaction{UserId: otherID, Date: testutil.MustDate(t, "2026-09-13")})

	latest, err := services.GetLatestTransactions(userID, 2)
	require.NoError(t, err)
	assert.Equal(t, []uuid.UUID{newest, middle}, transactionIDs(latest))

	none, err := services.GetLatestTransactions(uuid.New(), 2)
	require.NoError(t, err)
	assert.Equal(t, []schemas.TransactionSchema{}, none)
}

func TestGetTransactionsConfiguration(t *testing.T) {
	testutil.UseDB(t)
	userID := seedUser(t, "uah")
	otherID := seedUser(t, "uah")

	ownCategoryID := seedCategory(t, userID)
	seedCategory(t, otherID)
	hideCategory(t, userID, foodCategory)

	cardID := seedAccount(t, userID, "uah", "0")
	cashID := seedAccount(t, userID, "usd", "0")
	deletedID := seedAccount(t, userID, "uah", "0")
	deleteAccount(t, deletedID)
	seedAccount(t, otherID, "uah", "0")

	configuration, err := services.GetTransactionsConfiguration(userID)
	require.NoError(t, err)

	categoryIDs := []int{}
	for _, category := range configuration.Categories {
		categoryIDs = append(categoryIDs, category.Id)
	}
	// The defaults less the hidden one, then the user's own, in id order.
	assert.Equal(t, []int{2, 3, 4, 5, 6, 7, 8, 9, 10, ownCategoryID}, categoryIDs)

	accountIDs := []uuid.UUID{}
	for _, account := range configuration.Accounts {
		accountIDs = append(accountIDs, account.Id)
	}
	assert.ElementsMatch(t, []uuid.UUID{cardID, cashID}, accountIDs)
	assert.Equal(t, []string{}, configuration.Tags)

	empty, err := services.GetTransactionsConfiguration(uuid.New())
	require.NoError(t, err)
	assert.Len(t, empty.Categories, 10, "a user with nothing of their own still gets the defaults")
	assert.Equal(t, []schemas.AccountBaseSchema{}, empty.Accounts)
}
