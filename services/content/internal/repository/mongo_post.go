package repository

import (
	"context"
	"errors"
	"fmt"
	"math"
	"time"

	"github.com/kunalPisolkar24/topos/services/content/internal/domain"
	"github.com/kunalPisolkar24/topos/services/content/internal/metrics"
	"github.com/kunalPisolkar24/topos/services/content/internal/pagination"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// maxIDsPerQuery bounds a single $in query so a misbehaving caller can
// never build an oversized query document or hydrate an unbounded result
// set. Legitimate callers stay far below this cap (search and related
// limits are bounded by pagination).
const maxIDsPerQuery = 100

type MongoPostRepository struct {
	collection *mongo.Collection
}

func NewMongoPostRepository(db *mongo.Database) *MongoPostRepository {
	return &MongoPostRepository{
		collection: db.Collection("posts"),
	}
}

func (r *MongoPostRepository) Create(ctx context.Context, post *domain.Post) (*domain.Post, error) {
	start := time.Now()
	result, err := r.collection.InsertOne(ctx, post)
	defer metrics.ObserveDBQuery("posts.Create", start, err)
	if err != nil {
		return nil, err
	}
	if oid, ok := result.InsertedID.(primitive.ObjectID); ok {
		post.ID = oid.Hex()
	}
	return post, nil
}

func (r *MongoPostRepository) Update(ctx context.Context, id string, post *domain.Post) (*domain.Post, error) {
	start := time.Now()
	oid, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		metrics.ObserveDBQuery("posts.Update", start, err)
		return nil, fmt.Errorf("%w: invalid id format", domain.ErrNotFound)
	}

	opts := options.FindOneAndUpdate().SetReturnDocument(options.After)
	var updated domain.Post
	err = r.collection.FindOneAndUpdate(ctx, bson.M{"_id": oid}, bson.M{"$set": updateFields(post)}, opts).Decode(&updated)
	defer metrics.ObserveDBQuery("posts.Update", start, err)
	if err != nil {
		return nil, wrapNotFound(err)
	}
	return &updated, nil
}

// updateFields builds the $set document from the non-nil fields of post.
func updateFields(post *domain.Post) bson.M {
	fields := bson.M{"updatedAt": post.UpdatedAt}

	if post.Title != "" {
		fields["title"] = post.Title
	}
	if post.Body != "" {
		fields["body"] = post.Body
	}
	if post.Tags != nil {
		fields["tags"] = post.Tags
	}
	if post.ImageUrl != nil {
		fields["imageUrl"] = post.ImageUrl
	}
	if post.Slug != "" {
		fields["slug"] = post.Slug
	}
	if post.ApprovedByID != "" {
		fields["approvedById"] = post.ApprovedByID
	}

	if post.ResetSummary {
		fields["summary"] = ""
		fields["summaryStatus"] = domain.PostStatusPending
		return fields
	}
	if post.Summary != "" {
		fields["summary"] = post.Summary
	}
	if post.SummaryStatus != "" {
		fields["summaryStatus"] = post.SummaryStatus
	}
	return fields
}

func (r *MongoPostRepository) UpdateSummary(ctx context.Context, id string, summary string, status domain.PostStatus) error {
	start := time.Now()
	oid, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		metrics.ObserveDBQuery("posts.UpdateSummary", start, err)
		return fmt.Errorf("%w: invalid id format", domain.ErrNotFound)
	}

	_, err = r.collection.UpdateOne(ctx, bson.M{"_id": oid}, bson.M{
		"$set": bson.M{"summary": summary, "summaryStatus": status},
	})
	defer metrics.ObserveDBQuery("posts.UpdateSummary", start, err)
	return err
}

func (r *MongoPostRepository) Delete(ctx context.Context, id string) error {
	start := time.Now()
	oid, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		metrics.ObserveDBQuery("posts.Delete", start, err)
		return fmt.Errorf("%w: invalid id format", domain.ErrNotFound)
	}
	_, err = r.collection.DeleteOne(ctx, bson.M{"_id": oid})
	defer metrics.ObserveDBQuery("posts.Delete", start, err)
	return err
}

func (r *MongoPostRepository) FindAll(ctx context.Context, page, limit int) (*domain.PaginatedPosts, error) {
	start := time.Now()
	res, err := r.findWithPagination(ctx, bson.M{}, page, limit)
	metrics.ObserveDBQuery("posts.FindAll", start, err)
	return res, err
}

func (r *MongoPostRepository) FindByID(ctx context.Context, id string) (*domain.Post, error) {
	start := time.Now()
	oid, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		metrics.ObserveDBQuery("posts.FindByID", start, err)
		return nil, fmt.Errorf("%w: invalid id format", domain.ErrNotFound)
	}

	var post domain.Post
	err = r.collection.FindOne(ctx, bson.M{"_id": oid}).Decode(&post)
	defer metrics.ObserveDBQuery("posts.FindByID", start, err)
	if err != nil {
		return nil, wrapNotFound(err)
	}
	return &post, nil
}

// FindBySlug returns the post with the given slug.
func (r *MongoPostRepository) FindBySlug(ctx context.Context, slug string) (*domain.Post, error) {
	start := time.Now()
	var post domain.Post
	err := r.collection.FindOne(ctx, bson.M{"slug": slug}).Decode(&post)
	defer metrics.ObserveDBQuery("posts.FindBySlug", start, err)
	if err != nil {
		return nil, wrapNotFound(err)
	}
	return &post, nil
}

// FindByIDs returns the posts matching the given ids. Unparseable or
// missing ids are dropped so a stale search index entry can never fail
// the whole query.
func (r *MongoPostRepository) FindByIDs(ctx context.Context, ids []string) ([]*domain.Post, error) {
	start := time.Now()
	if len(ids) > maxIDsPerQuery {
		err := fmt.Errorf("too many ids (%d), max %d", len(ids), maxIDsPerQuery)
		metrics.ObserveDBQuery("posts.FindByIDs", start, err)
		return nil, err
	}
	oids := make([]primitive.ObjectID, 0, len(ids))
	for _, id := range ids {
		oid, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			continue
		}
		oids = append(oids, oid)
	}
	if len(oids) == 0 {
		metrics.ObserveDBQuery("posts.FindByIDs", start, nil)
		return []*domain.Post{}, nil
	}

	cursor, err := r.collection.Find(ctx, bson.M{"_id": bson.M{"$in": oids}})
	if err != nil {
		metrics.ObserveDBQuery("posts.FindByIDs", start, err)
		return nil, err
	}
	defer cursor.Close(ctx)

	posts := make([]*domain.Post, 0)
	err = cursor.All(ctx, &posts)
	metrics.ObserveDBQuery("posts.FindByIDs", start, err)
	if err != nil {
		return nil, err
	}
	return posts, nil
}

func (r *MongoPostRepository) FindByAuthor(ctx context.Context, authorID string, page, limit int) (*domain.PaginatedPosts, error) {
	start := time.Now()
	res, err := r.findWithPagination(ctx, bson.M{"authorId": authorID}, page, limit)
	metrics.ObserveDBQuery("posts.FindByAuthor", start, err)
	return res, err
}

func (r *MongoPostRepository) FindAllExceptAuthor(ctx context.Context, authorID string, page, limit int) (*domain.PaginatedPosts, error) {
	start := time.Now()
	res, err := r.findWithPagination(ctx, bson.M{"authorId": bson.M{"$ne": authorID}}, page, limit)
	metrics.ObserveDBQuery("posts.FindAllExceptAuthor", start, err)
	return res, err
}

func (r *MongoPostRepository) FindByTag(ctx context.Context, tag string, page, limit int) (*domain.PaginatedPosts, error) {
	start := time.Now()
	res, err := r.findWithPagination(ctx, bson.M{"tags": tag}, page, limit)
	metrics.ObserveDBQuery("posts.FindByTag", start, err)
	return res, err
}

func (r *MongoPostRepository) findWithPagination(ctx context.Context, filter bson.M, page, limit int) (*domain.PaginatedPosts, error) {
	start := time.Now()
	page, limit = pagination.Normalize(page, limit)

	total, err := r.collection.CountDocuments(ctx, filter)
	if err != nil {
		metrics.ObserveDBQuery("posts.findWithPagination", start, err)
		return nil, err
	}

	opts := options.Find().
		SetSkip(int64((page - 1) * limit)).
		SetLimit(int64(limit)).
		SetSort(bson.M{"createdAt": -1})

	cursor, err := r.collection.Find(ctx, filter, opts)
	if err != nil {
		metrics.ObserveDBQuery("posts.findWithPagination", start, err)
		return nil, err
	}
	defer cursor.Close(ctx)

	posts := make([]*domain.Post, 0)
	if err := cursor.All(ctx, &posts); err != nil {
		metrics.ObserveDBQuery("posts.findWithPagination", start, err)
		return nil, err
	}

	res := &domain.PaginatedPosts{
		Posts:      posts,
		TotalPages: int(math.Ceil(float64(total) / float64(limit))),
		TotalPosts: total,
		Page:       page,
	}
	metrics.ObserveDBQuery("posts.findWithPagination", start, nil)
	return res, nil
}

func wrapNotFound(err error) error {
	if errors.Is(err, mongo.ErrNoDocuments) {
		return fmt.Errorf("%w: %w", domain.ErrNotFound, err)
	}
	return err
}
