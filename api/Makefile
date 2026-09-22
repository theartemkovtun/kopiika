.PHONY: run build swagger migrate-diff migrate-new migrate-apply migrate-rehash migrate-status migrate-validate lint fmt fmt-check

run:
	go run .

build:
	swag init --parseInternal && go build -o kopiika-api-go .

swagger:
	swag init --parseInternal

migrate-diff:
	export $$(cat .env | grep -v '^#' | xargs) && \
	atlas migrate diff $(name) --env dev --var DATABASE_URL=$$DATABASE_URL

migrate-new:
	export $$(cat .env | grep -v '^#' | xargs) && \
	atlas migrate new $(name) --env dev --var DATABASE_URL=$$DATABASE_URL

migrate-apply:
	export $$(cat .env | grep -v '^#' | xargs) && \
	atlas migrate apply --env dev --var DATABASE_URL=$$DATABASE_URL

migrate-rehash:
	export $$(cat .env | grep -v '^#' | xargs) && \
	atlas migrate hash --env dev --var DATABASE_URL=$$DATABASE_URL

migrate-status:
	export $$(cat .env | grep -v '^#' | xargs) && \
	atlas migrate status --env dev --var DATABASE_URL=$$DATABASE_URL

migrate-validate:
	export $$(cat .env | grep -v '^#' | xargs) && \
	atlas migrate validate --env dev --var DATABASE_URL=$$DATABASE_URL

lint:
	golangci-lint run ./...

fmt:
	golangci-lint fmt ./...

fmt-check:
	golangci-lint fmt --diff ./...
