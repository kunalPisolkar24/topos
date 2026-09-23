package db

import (
	"context"
	"fmt"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const indexTimeout = 30 * time.Second

// EnsureIndexes creates the indexes required by the posts, tags, chats,
// messages and post_interactions collections. The posts collection uses
// a standalone MongoDB deployment, so the unique slug index is always
// created (uniqueness is also enforced in-app via PostService).
func EnsureIndexes(ctx context.Context, db *mongo.Database) error {
	ctx, cancel := context.WithTimeout(ctx, indexTimeout)
	defer cancel()

	postIndexes := []mongo.IndexModel{
		{
			Keys:    bson.D{{Key: "authorId", Value: 1}, {Key: "createdAt", Value: -1}},
			Options: options.Index().SetName("authorId_createdAt"),
		},
		{
			Keys:    bson.D{{Key: "tags", Value: 1}, {Key: "createdAt", Value: -1}},
			Options: options.Index().SetName("tags_createdAt"),
		},
		{
			Keys:    bson.D{{Key: "createdAt", Value: -1}},
			Options: options.Index().SetName("createdAt_desc"),
		},
		{
			Keys:    bson.D{{Key: "slug", Value: 1}},
			Options: options.Index().SetUnique(true).SetName("slug_unique"),
		},
	}

	if _, err := db.Collection("posts").Indexes().CreateMany(ctx, postIndexes); err != nil {
		return fmt.Errorf("create posts indexes: %w", err)
	}

	tagIndexes := []mongo.IndexModel{
		{
			Keys:    bson.D{{Key: "name", Value: 1}},
			Options: options.Index().SetUnique(true).SetName("name_unique"),
		},
	}

	if _, err := db.Collection("tags").Indexes().CreateMany(ctx, tagIndexes); err != nil {
		return fmt.Errorf("create tags indexes: %w", err)
	}

	chatIndexes := []mongo.IndexModel{
		{
			Keys:    bson.D{{Key: "userId", Value: 1}, {Key: "createdAt", Value: -1}},
			Options: options.Index().SetName("userId_createdAt"),
		},
	}

	if _, err := db.Collection("chats").Indexes().CreateMany(ctx, chatIndexes); err != nil {
		return fmt.Errorf("create chats indexes: %w", err)
	}

	messageIndexes := []mongo.IndexModel{
		{
			Keys:    bson.D{{Key: "chatId", Value: 1}, {Key: "createdAt", Value: -1}},
			Options: options.Index().SetName("chatId_createdAt"),
		},
	}

	if _, err := db.Collection("messages").Indexes().CreateMany(ctx, messageIndexes); err != nil {
		return fmt.Errorf("create messages indexes: %w", err)
	}

	interactionIndexes := []mongo.IndexModel{
		{
			// Idempotent likes/saves: a duplicate (userId, postId, kind)
			// is rejected by Mongo and returns the existing record.
			Keys:    bson.D{{Key: "userId", Value: 1}, {Key: "postId", Value: 1}, {Key: "kind", Value: 1}},
			Options: options.Index().SetUnique(true).SetName("userId_postId_kind_unique"),
		},
		{
			Keys:    bson.D{{Key: "userId", Value: 1}, {Key: "createdAt", Value: -1}},
			Options: options.Index().SetName("userId_createdAt"),
		},
	}

	if _, err := db.Collection("post_interactions").Indexes().CreateMany(ctx, interactionIndexes); err != nil {
		return fmt.Errorf("create post_interactions indexes: %w", err)
	}

	draftIndexes := []mongo.IndexModel{
		{
			Keys:    bson.D{{Key: "status", Value: 1}, {Key: "createdAt", Value: -1}},
			Options: options.Index().SetName("status_createdAt"),
		},
		{
			Keys:    bson.D{{Key: "authorId", Value: 1}, {Key: "createdAt", Value: -1}},
			Options: options.Index().SetName("authorId_createdAt"),
		},
		{
			Keys:    bson.D{{Key: "approvalId", Value: 1}},
			Options: options.Index().SetUnique(true).SetName("approval_id_unique"),
		},
	}

	if _, err := db.Collection("post_drafts").Indexes().CreateMany(ctx, draftIndexes); err != nil {
		return fmt.Errorf("create post_drafts indexes: %w", err)
	}

	return nil
}
