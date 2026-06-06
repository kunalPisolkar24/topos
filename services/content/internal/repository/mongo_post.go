package repository

import (
	"context"
	"errors"
	"fmt"
	"math"

	"github.com/kunalPisolkar24/blogapp/services/content/internal/domain"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type mongoPostRepo struct {
	collection *mongo.Collection
}

func NewMongoPostRepository(db *mongo.Database) domain.PostRepository {
	return &mongoPostRepo{
		collection: db.Collection("posts"),
	}
}

func (r *mongoPostRepo) Create(ctx context.Context, post *domain.Post) (*domain.Post, error) {
	result, err := r.collection.InsertOne(ctx, post)
	if err != nil {
		return nil, err
	}
	if oid, ok := result.InsertedID.(primitive.ObjectID); ok {
		post.ID = oid.Hex()
	}
	return post, nil
}

func (r *mongoPostRepo) Update(ctx context.Context, id string, post *domain.Post) (*domain.Post, error) {
	oid, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return nil, err
	}

	updateFields := bson.M{
		"updatedAt": post.UpdatedAt,
	}

	if post.Title != "" {
		updateFields["title"] = post.Title
	}
	if post.Body != "" {
		updateFields["body"] = post.Body
	}
	if post.Tags != nil {
		updateFields["tags"] = post.Tags
	}
	if post.ImageUrl != nil {
		updateFields["imageUrl"] = post.ImageUrl
	}
	if post.Slug != "" {
		updateFields["slug"] = post.Slug
	}
	if post.Summary != "" {
		updateFields["summary"] = post.Summary
	}
	if post.SummaryStatus != "" {
		updateFields["summaryStatus"] = post.SummaryStatus
	}

	update := bson.M{
		"$set": updateFields,
	}

	opts := options.FindOneAndUpdate().SetReturnDocument(options.After)

	var updatedPost domain.Post
	err = r.collection.FindOneAndUpdate(ctx, bson.M{"_id": oid}, update, opts).Decode(&updatedPost)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, fmt.Errorf("%w: %w", domain.ErrNotFound, err)
		}
		return nil, err
	}

	return &updatedPost, nil
}

func (r *mongoPostRepo) UpdateSummary(ctx context.Context, id string, summary string, status string) error {
	oid, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return err
	}

	update := bson.M{
		"$set": bson.M{
			"summary":       summary,
			"summaryStatus": status,
		},
	}

	_, err = r.collection.UpdateOne(ctx, bson.M{"_id": oid}, update)
	return err
}

func (r *mongoPostRepo) Delete(ctx context.Context, id string) error {
	oid, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return err
	}
	_, err = r.collection.DeleteOne(ctx, bson.M{"_id": oid})
	return err
}

func (r *mongoPostRepo) findWithPagination(ctx context.Context, filter bson.M, page, limit int) (*domain.PaginatedPosts, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 10
	}
	skip := (page - 1) * limit

	totalCount, err := r.collection.CountDocuments(ctx, filter)
	if err != nil {
		return nil, err
	}

	opts := options.Find().
		SetSkip(int64(skip)).
		SetLimit(int64(limit)).
		SetSort(bson.M{"createdAt": -1})

	cursor, err := r.collection.Find(ctx, filter, opts)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	posts := make([]*domain.Post, 0)
	if err = cursor.All(ctx, &posts); err != nil {
		return nil, err
	}

	totalPages := 0
	if limit > 0 {
		totalPages = int(math.Ceil(float64(totalCount) / float64(limit)))
	}

	return &domain.PaginatedPosts{
		Posts:      posts,
		TotalPages: totalPages,
		TotalPosts: totalCount,
		Page:       page,
	}, nil
}

func (r *mongoPostRepo) FindAll(ctx context.Context, page, limit int) (*domain.PaginatedPosts, error) {
	return r.findWithPagination(ctx, bson.M{}, page, limit)
}

func (r *mongoPostRepo) FindByID(ctx context.Context, id string) (*domain.Post, error) {
	oid, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return nil, fmt.Errorf("%w: invalid id format", domain.ErrNotFound)
	}

	var post domain.Post
	err = r.collection.FindOne(ctx, bson.M{"_id": oid}).Decode(&post)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, fmt.Errorf("%w: %w", domain.ErrNotFound, err)
		}
		return nil, err
	}
	return &post, nil
}

func (r *mongoPostRepo) FindByAuthor(ctx context.Context, authorID string, page, limit int) (*domain.PaginatedPosts, error) {
	return r.findWithPagination(ctx, bson.M{"authorId": authorID}, page, limit)
}

func (r *mongoPostRepo) FindByTag(ctx context.Context, tag string, page, limit int) (*domain.PaginatedPosts, error) {
	return r.findWithPagination(ctx, bson.M{"tags": tag}, page, limit)
}