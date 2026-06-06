//go:build integration

package testhelpers

import (
	"context"
	"testing"

	"github.com/kunalPisolkar24/blogapp/services/content/internal/db"
	"github.com/stretchr/testify/require"
	"github.com/testcontainers/testcontainers-go/modules/mongodb"
	"go.mongodb.org/mongo-driver/mongo"
)

func SetupMongoDB(t *testing.T) (*mongo.Database, func()) {
	t.Helper()

	ctx := context.Background()

	mongoC, err := mongodb.Run(ctx, "mongo:7")
	require.NoError(t, err)

	uri, err := mongoC.ConnectionString(ctx)
	require.NoError(t, err)

	client, err := db.Connect(uri)
	require.NoError(t, err)

	database := client.Database("blog_content_test")

	err = db.EnsureIndexes(ctx, database)
	require.NoError(t, err)

	cleanup := func() {
		_ = client.Disconnect(context.Background())
		_ = mongoC.Terminate(context.Background())
	}

	return database, cleanup
}
