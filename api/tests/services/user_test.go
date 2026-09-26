package services_test

import (
	"testing"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/cognitoidentityprovider"
	"github.com/aws/aws-sdk-go-v2/service/cognitoidentityprovider/types"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"kopiika-api-go/src/schemas"
	"kopiika-api-go/src/services"
	"kopiika-api-go/tests/testutil"
)

// poolUser is what the user pool's ListUsers returns for one user.
func poolUser(attributes map[string]string) *cognitoidentityprovider.ListUsersOutput {
	user := types.UserType{}
	for name, value := range attributes {
		user.Attributes = append(user.Attributes, types.AttributeType{Name: aws.String(name), Value: aws.String(value)})
	}
	return &cognitoidentityprovider.ListUsersOutput{Users: []types.UserType{user}}
}

func TestSetupUser(t *testing.T) {
	testutil.UseDB(t)
	cognito := testutil.UseCognito(t)
	// A fresh id per test also keeps core's Cognito details cache from
	// answering for a user another test looked up.
	userID := uuid.New()

	cognito.On("ListUsers", mock.Anything, mock.MatchedBy(func(in *cognitoidentityprovider.ListUsersInput) bool {
		return aws.ToString(in.Filter) == `sub = "`+userID.String()+`"`
	})).Return(poolUser(map[string]string{
		"given_name": "Olena",
		"picture":    "https://example.com/olena.png",
	}), nil).Once()

	user, err := services.SetupUser(userID, schemas.ConfigureUserSchema{CountryCode: "UA"})
	require.NoError(t, err)

	assert.Equal(t, userID, user.Id)
	assert.Equal(t, "Olena", user.Name, "falls back to given_name")
	require.NotNil(t, user.PictureUrl)
	assert.Equal(t, "https://example.com/olena.png", *user.PictureUrl)
	assert.Equal(t, "uk", user.Language)
	assert.Equal(t, "uah", user.Currency)

	// Setting up again returns the stored user without asking Cognito, which
	// the mock's Once enforces.
	again, err := services.SetupUser(userID, schemas.ConfigureUserSchema{CountryCode: "US"})
	require.NoError(t, err)
	assert.Equal(t, user, again)
}
