BINARY_NAME=content-service
COVERAGE_FILE=coverage.out

.PHONY: install run generate test test-cover test-html test-integration test-all build clean

install:
	go mod download
	go mod tidy

run:
	go run cmd/server/main.go

generate:
	go run github.com/99designs/gqlgen generate

test:
	go test -v ./...

test-cover:
	go test -cover ./...

test-html:
	go test -coverprofile=$(COVERAGE_FILE) ./...
	go tool cover -html=$(COVERAGE_FILE)
	rm -f $(COVERAGE_FILE)

test-integration:
	go test -tags=integration -v -count=1 ./internal/repository/... ./internal/service/...

test-all: test test-integration

build:
	CGO_ENABLED=0 GOOS=linux go build -o $(BINARY_NAME) cmd/server/main.go

clean:
	go clean
	rm -f $(BINARY_NAME)
	rm -f $(COVERAGE_FILE)