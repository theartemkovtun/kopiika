package core

import (
	"errors"
	"os"

	"github.com/joho/godotenv"
)

type config struct {
	DatabaseUrl        string
	CORSAllowedOrigins string
	CognitoRegion      string
	CognitoUserPoolID  string
}

var Config = &config{}

func LoadConfig() error {

	godotenv.Load()

	Config.DatabaseUrl = os.Getenv("DATABASE_URL")
	Config.CORSAllowedOrigins = os.Getenv("CORS_ALLOWED_ORIGINS")
	Config.CognitoRegion = os.Getenv("COGNITO_REGION")
	Config.CognitoUserPoolID = os.Getenv("COGNITO_USER_POOL_ID")

	if Config.DatabaseUrl == "" {
		return errors.New("DATABASE_URL environment variable is not set")
	}

	if Config.CognitoRegion == "" {
		return errors.New("COGNITO_REGION environment variable is not set")
	}

	if Config.CognitoUserPoolID == "" {
		return errors.New("COGNITO_USER_POOL_ID environment variable is not set")
	}

	return nil
}
