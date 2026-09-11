package core

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/MicahParks/keyfunc/v3"
	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/cognitoidentityprovider"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

var jwks keyfunc.Keyfunc
var cognitoClient *cognitoidentityprovider.Client

// InitCognito initializes the JWKS for Cognito token validation and the Cognito SDK client
func InitCognito() error {
	jwksURL := fmt.Sprintf(
		"https://cognito-idp.%s.amazonaws.com/%s/.well-known/jwks.json",
		Config.CognitoRegion,
		Config.CognitoUserPoolID,
	)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	k, err := keyfunc.NewDefaultCtx(ctx, []string{jwksURL})
	if err != nil {
		return fmt.Errorf("failed to create JWKS keyfunc: %w", err)
	}
	jwks = k

	cfg, err := awsconfig.LoadDefaultConfig(ctx, awsconfig.WithRegion(Config.CognitoRegion))
	if err != nil {
		return fmt.Errorf("failed to load AWS config: %w", err)
	}
	cognitoClient = cognitoidentityprovider.NewFromConfig(cfg)

	return nil
}

type CognitoUserDetails struct {
	Name       string
	PictureURL *string
}

// GetCognitoUserDetails fetches name and picture URL for the given user sub from Cognito.
func GetCognitoUserDetails(userID uuid.UUID) (CognitoUserDetails, error) {
	if cognitoClient == nil {
		return CognitoUserDetails{}, errors.New("cognito client not initialized")
	}

	out, err := cognitoClient.ListUsers(context.Background(), &cognitoidentityprovider.ListUsersInput{
		UserPoolId: aws.String(Config.CognitoUserPoolID),
		Filter:     aws.String(fmt.Sprintf(`sub = "%s"`, userID.String())),
		Limit:      aws.Int32(1),
	})
	if err != nil {
		return CognitoUserDetails{}, fmt.Errorf("failed to list cognito users: %w", err)
	}
	if len(out.Users) == 0 {
		return CognitoUserDetails{}, fmt.Errorf("cognito user not found for sub %s", userID)
	}

	var details CognitoUserDetails
	for _, attr := range out.Users[0].Attributes {
		switch aws.ToString(attr.Name) {
		case "name":
			details.Name = aws.ToString(attr.Value)
		case "picture":
			if attr.Value != nil {
				details.PictureURL = attr.Value
			}
		}
	}
	return details, nil
}

// CognitoClaims represents the claims in a Cognito JWT token
type CognitoClaims struct {
	jwt.RegisteredClaims
	TokenUse string `json:"token_use"`
	Username string `json:"username"`
	Email    string `json:"email"`
}

// ValidateCognitoToken validates a Cognito JWT token and returns the user ID
func ValidateCognitoToken(tokenString string) (uuid.UUID, error) {
	if jwks == nil {
		return uuid.Nil, errors.New("JWKS not initialized")
	}

	token, err := jwt.ParseWithClaims(tokenString, &CognitoClaims{}, jwks.KeyfuncCtx(context.Background()))
	if err != nil {
		return uuid.Nil, fmt.Errorf("failed to parse token: %w", err)
	}

	if !token.Valid {
		return uuid.Nil, errors.New("invalid token")
	}

	claims, ok := token.Claims.(*CognitoClaims)
	if !ok {
		return uuid.Nil, errors.New("invalid token claims")
	}

	if claims.TokenUse != "id" && claims.TokenUse != "access" {
		return uuid.Nil, errors.New("invalid token_use claim")
	}

	expectedIssuer := fmt.Sprintf(
		"https://cognito-idp.%s.amazonaws.com/%s",
		Config.CognitoRegion,
		Config.CognitoUserPoolID,
	)
	if claims.Issuer != expectedIssuer {
		return uuid.Nil, errors.New("invalid token issuer")
	}

	userID, err := uuid.Parse(claims.Subject)
	if err != nil {
		return uuid.Nil, fmt.Errorf("invalid user ID in token: %w", err)
	}

	return userID, nil
}
