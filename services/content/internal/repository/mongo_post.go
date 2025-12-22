package repository

import (
	"context"
	"errors"

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

	if post.SummaryStatus != "" {
		updateFields["summaryStatus"] = post.SummaryStatus

		if post.SummaryStatus == "PENDING" {
			updateFields["summary"] = ""
		}
	} else if post.Summary != "" {
		updateFields["summary"] = post.Summary
	}

	update := bson.M{
		"$set": updateFields,
	}

	opts := options.FindOneAndUpdate().SetReturnDocument(options.After)
	var updatedPost domain.Post
	err = r.collection.FindOneAndUpdate(ctx, bson.M{"_id": oid}, update, opts).Decode(&updatedPost)
	if err != nil {
		return nil, err
	}

	return &updatedPost, nil
}

func (r *mongoPostRepo) Delete(ctx context.Context, id string) error {
	oid, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return err
	}
	_, err = r.collection.DeleteOne(ctx, bson.M{"_id": oid})
	return err
}

func (r *mongoPostRepo) FindAll(ctx context.Context, page, limit int) ([]*domain.Post, error) {
	skip := (page - 1) * limit
	opts := options.Find().SetSkip(int64(skip)).SetLimit(int64(limit)).SetSort(bson.M{"createdAt": -1})

	cursor, err := r.collection.Find(ctx, bson.M{}, opts)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var posts []*domain.Post
	if err = cursor.All(ctx, &posts); err != nil {
		return nil, err
	}
	return posts, nil
}

func (r *mongoPostRepo) FindByID(ctx context.Context, id string) (*domain.Post, error) {
	oid, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return nil, errors.New("invalid id format")
	}

	var post domain.Post
	err = r.collection.FindOne(ctx, bson.M{"_id": oid}).Decode(&post)
	if err != nil {
		return nil, err
	}
	return &post, nil
}

func (r *mongoPostRepo) FindByAuthor(ctx context.Context, authorID string) ([]*domain.Post, error) {
	cursor, err := r.collection.Find(ctx, bson.M{"authorId": authorID})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var posts []*domain.Post
	if err = cursor.All(ctx, &posts); err != nil {
		return nil, err
	}
	return posts, nil
}
