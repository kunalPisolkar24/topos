package main

import (
	"context"
	"encoding/json"
	"fmt"
	"math/rand"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type seedPost struct {
	ID       string   `json:"id"`
	Slug     string   `json:"slug"`
	Title    string   `json:"title"`
	AuthorID string   `json:"authorId"`
	Tags     []string `json:"tags"`
}

type config struct {
	MongoURI    string
	DbName      string
	JwtSecret   string
	PostCount   int
	OutputDir   string
	AuthorCount int
	TagCount    int
}

var titleTemplates = []string{
	"Understanding %s in Modern Development",
	"A Comprehensive Guide to %s",
	"Getting Started with %s",
	"Deep Dive into %s",
	"Best Practices for %s",
	"Building Scalable %s Solutions",
	"Mastering %s: A Practical Approach",
	"The Evolution of %s",
	"Why %s Matters in 2026",
	"Everything You Need to Know About %s",
}

var bodyWords = []string{
	"lorem", "ipsum", "dolor", "sit", "amet", "consectetur", "adipiscing", "elit",
	"sed", "do", "eiusmod", "tempor", "incididunt", "ut", "labore", "et", "dolore",
	"magna", "aliqua", "ut", "enim", "ad", "minim", "veniam", "quis", "nostrud",
	"exercitation", "ullamco", "laboris", "nisi", "ut", "aliquip", "ex", "ea",
	"commodo", "consequat", "duis", "aute", "irure", "dolor", "in", "reprehenderit",
	"in", "voluptate", "velit", "esse", "cillum", "dolore", "eu", "fugiat", "nulla",
	"pariatur", "excepteur", "sint", "occaecat", "cupidatat", "non", "proident",
	"sunt", "in", "culpa", "qui", "officia", "deserunt", "mollit", "anim", "id",
	"est", "laborum", "architecture", "patterns", "scalability", "performance",
	"security", "testing", "deployment", "monitoring", "observability", "tracing",
	"microservices", "containers", "orchestration", "kubernetes", "serverless",
	"database", "caching", "streaming", "batch", "processing", "integration",
}

var tags = []string{
	"golang", "javascript", "typescript", "python", "rust", "java", "kotlin",
	"kubernetes", "docker", "terraform", "ansible", "helm",
	"react", "vue", "angular", "nextjs", "svelte", "solidjs",
	"postgresql", "mongodb", "redis", "elasticsearch", "cassandra",
	"graphql", "rest", "grpc", "websocket", "kafka", "rabbitmq",
	"aws", "gcp", "azure", "cloud", "devops", "ci-cd",
	"testing", "tdd", "e2e", "integration", "unit-testing",
	"security", "oauth", "jwt", "authentication", "authorization",
	"performance", "optimization", "profiling", "caching",
	"microservices", "monolith", "serverless", "edge",
}

func loadConfig() config {
	getEnv := func(key, fallback string) string {
		if v := os.Getenv(key); v != "" {
			return v
		}
		return fallback
	}
	getInt := func(key string, fallback int) int {
		v := os.Getenv(key)
		if v == "" {
			return fallback
		}
		n, err := strconv.Atoi(v)
		if err != nil {
			return fallback
		}
		return n
	}

	return config{
		MongoURI:    getEnv("MONGO_URI", "mongodb://localhost:27017"),
		DbName:      getEnv("DB_NAME", "blog_content"),
		JwtSecret:   os.Getenv("JWT_SECRET"),
		PostCount:   getInt("SEED_POST_COUNT", 5000),
		OutputDir:   getEnv("SEED_OUTPUT_DIR", "/load-tests/seed-k6/seed_data"),
		AuthorCount: getInt("SEED_AUTHOR_COUNT", 5),
		TagCount:    len(tags),
	}
}

func generatePostBody(rng *rand.Rand) string {
	wordCount := 50 + rng.Intn(200)
	words := make([]string, wordCount)
	for i := 0; i < wordCount; i++ {
		words[i] = bodyWords[rng.Intn(len(bodyWords))]
	}

	var result string
	for i, w := range words {
		if i > 0 && i%20 == 0 {
			result += "\n\n"
		} else if i > 0 {
			result += " "
		}
		if i == 0 {
			result += string(rune(w[0])-32) + w[1:]
		} else if i%20 == 19 {
			result += "."
		} else if i == wordCount-1 {
			result += "."
		} else {
			result += w
		}
	}
	return result
}

func pickTags(rng *rand.Rand) []string {
	count := 1 + rng.Intn(3)
	selected := make([]string, count)
	used := make(map[int]bool)
	for i := 0; i < count; i++ {
		for {
			idx := rng.Intn(len(tags))
			if !used[idx] {
				used[idx] = true
				selected[i] = tags[idx]
				break
			}
		}
	}
	return selected
}

func createTags(ctx context.Context, db *mongo.Database) error {
	coll := db.Collection("tags")
	for _, name := range tags {
		_, err := coll.UpdateOne(
			ctx,
			bson.M{"name": name},
			bson.M{"$setOnInsert": bson.M{"name": name}},
			options.Update().SetUpsert(true),
		)
		if err != nil {
			return fmt.Errorf("upsert tag %s: %w", name, err)
		}
	}
	return nil
}

func createPosts(ctx context.Context, db *mongo.Database, cfg config) ([]seedPost, error) {
	coll := db.Collection("posts")
	count, err := coll.CountDocuments(ctx, bson.M{})
	if err != nil {
		return nil, fmt.Errorf("count posts: %w", err)
	}

	if int(count) >= cfg.PostCount {
		fmt.Printf("[seed] posts already present: %d >= %d, skipping insert\n", count, cfg.PostCount)
		return loadSeedPosts(ctx, coll, cfg.PostCount)
	}

	toInsert := cfg.PostCount - int(count)
	fmt.Printf("[seed] inserting %d posts (existing=%d, target=%d)\n", toInsert, count, cfg.PostCount)

	now := time.Now()
	rng := rand.New(rand.NewSource(42))
	authorIDs := make([]string, cfg.AuthorCount)
	for i := 0; i < cfg.AuthorCount; i++ {
		authorIDs[i] = fmt.Sprintf("loadtest-author-%d", i+1)
	}

	type postDoc struct {
		Title         string    `bson:"title"`
		Body          string    `bson:"body"`
		Slug          string    `bson:"slug"`
		AuthorID      string    `bson:"authorId"`
		ImageUrl      *string   `bson:"imageUrl,omitempty"`
		Summary       string    `bson:"summary"`
		SummaryStatus string    `bson:"summaryStatus"`
		Tags          []string  `bson:"tags"`
		CreatedAt     time.Time `bson:"createdAt"`
		UpdatedAt     time.Time `bson:"updatedAt"`
	}

	inserted := 0
	batchSize := 500
	var batch []interface{}

	for i := 0; i < toInsert; i++ {
		tagName := tags[rng.Intn(len(tags))]
		title := pickTitle(rng, tagName)
		slug := fmt.Sprintf("%s-%d", slugify(title), now.UnixNano()/int64(time.Millisecond)+int64(i))
		authorID := authorIDs[rng.Intn(len(authorIDs))]
		postTags := pickTags(rng)

		doc := postDoc{
			Title:         title,
			Body:          generatePostBody(rng),
			Slug:          slug,
			AuthorID:      authorID,
			Summary:       "",
			SummaryStatus: "PENDING",
			Tags:          postTags,
			CreatedAt:     now.Add(-time.Duration(rng.Intn(720)) * time.Hour),
			UpdatedAt:     now,
		}
		batch = append(batch, doc)
		if len(batch) >= batchSize {
			if _, err := coll.InsertMany(ctx, batch); err != nil {
				return nil, fmt.Errorf("insert batch: %w", err)
			}
			inserted += len(batch)
			batch = batch[:0]
			fmt.Printf("[seed]   inserted %d/%d\n", inserted, toInsert)
		}
	}
	if len(batch) > 0 {
		if _, err := coll.InsertMany(ctx, batch); err != nil {
			return nil, fmt.Errorf("insert final batch: %w", err)
		}
		inserted += len(batch)
		fmt.Printf("[seed]   inserted %d/%d\n", inserted, toInsert)
	}

	return loadSeedPosts(ctx, coll, cfg.PostCount)
}

func loadSeedPosts(ctx context.Context, coll *mongo.Collection, count int) ([]seedPost, error) {
	cursor, err := coll.Find(ctx, bson.M{}, options.Find().SetLimit(int64(count)).SetSort(bson.M{"createdAt": -1}))
	if err != nil {
		return nil, fmt.Errorf("find posts: %w", err)
	}
	defer cursor.Close(ctx)

	var posts []seedPost
	for cursor.Next(ctx) {
		var doc bson.M
		if err := cursor.Decode(&doc); err != nil {
			return nil, fmt.Errorf("decode post: %w", err)
		}
		id, ok := doc["_id"].(primitive.ObjectID)
		if !ok {
			continue
		}
		tagsRaw, _ := doc["tags"].(bson.A)
		var tagStrs []string
		for _, t := range tagsRaw {
			if s, ok := t.(string); ok {
				tagStrs = append(tagStrs, s)
			}
		}
		authorID, _ := doc["authorId"].(string)
		title, _ := doc["title"].(string)
		slug, _ := doc["slug"].(string)
		posts = append(posts, seedPost{
			ID:       id.Hex(),
			Slug:     slug,
			Title:    title,
			AuthorID: authorID,
			Tags:     tagStrs,
		})
	}
	if len(posts) == 0 {
		return nil, fmt.Errorf("no posts found after seed")
	}
	return posts, nil
}

func mintTokens(cfg config) ([]string, error) {
	if cfg.JwtSecret == "" {
		return nil, fmt.Errorf("JWT_SECRET is required")
	}
	tokens := make([]string, cfg.AuthorCount)
	for i := 0; i < cfg.AuthorCount; i++ {
		claims := jwt.MapClaims{
			"id":  fmt.Sprintf("loadtest-author-%d", i+1),
			"exp": time.Now().Add(24 * time.Hour).Unix(),
			"iat": time.Now().Unix(),
		}
		token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
		signed, err := token.SignedString([]byte(cfg.JwtSecret))
		if err != nil {
			return nil, fmt.Errorf("sign token: %w", err)
		}
		tokens[i] = signed
	}
	return tokens, nil
}

func writeSeedFiles(posts []seedPost, tokens []string, cfg config) error {
	if err := os.MkdirAll(cfg.OutputDir, 0755); err != nil {
		return fmt.Errorf("mkdir output: %w", err)
	}

	postsFile := filepath.Join(cfg.OutputDir, "posts.json")
	postsData, err := json.Marshal(posts)
	if err != nil {
		return fmt.Errorf("marshal posts: %w", err)
	}
	if err := os.WriteFile(postsFile, postsData, 0644); err != nil {
		return fmt.Errorf("write posts.json: %w", err)
	}

	tokensFile := filepath.Join(cfg.OutputDir, "tokens.json")
	tokensData, err := json.Marshal(tokens)
	if err != nil {
		return fmt.Errorf("marshal tokens: %w", err)
	}
	if err := os.WriteFile(tokensFile, tokensData, 0644); err != nil {
		return fmt.Errorf("write tokens.json: %w", err)
	}

	tagsFile := filepath.Join(cfg.OutputDir, "tags.json")
	tagsData, err := json.Marshal(tags)
	if err != nil {
		return fmt.Errorf("marshal tags: %w", err)
	}
	if err := os.WriteFile(tagsFile, tagsData, 0644); err != nil {
		return fmt.Errorf("write tags.json: %w", err)
	}

	fmt.Printf("[seed] wrote %d posts, %d tokens, %d tags to %s\n", len(posts), len(tokens), len(tags), cfg.OutputDir)
	return nil
}

func pickTitle(rng *rand.Rand, tag string) string {
	tmpl := titleTemplates[rng.Intn(len(titleTemplates))]
	return fmt.Sprintf(tmpl, capitalize(tag))
}

func capitalize(s string) string {
	if s == "" {
		return ""
	}
	return string(rune(s[0])-32) + s[1:]
}

func slugify(s string) string {
	result := make([]byte, 0, len(s))
	for i := 0; i < len(s); i++ {
		c := s[i]
		if c >= 'A' && c <= 'Z' {
			result = append(result, c+32)
		} else if c >= 'a' && c <= 'z' || c >= '0' && c <= '9' {
			result = append(result, c)
		} else if c == ' ' || c == '-' {
			if len(result) == 0 || result[len(result)-1] != '-' {
				result = append(result, '-')
			}
		}
	}
	slug := string(result)
	if len(slug) > 0 && slug[len(slug)-1] == '-' {
		slug = slug[:len(slug)-1]
	}
	if slug == "" {
		slug = "post"
	}
	return slug
}

func main() {
	cfg := loadConfig()

	if cfg.JwtSecret == "" {
		fmt.Fprintln(os.Stderr, "[seed] JWT_SECRET is required")
		os.Exit(1)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 120*time.Second)
	defer cancel()

	client, err := mongo.Connect(ctx, options.Client().ApplyURI(cfg.MongoURI))
	if err != nil {
		fmt.Fprintf(os.Stderr, "[seed] connect mongo: %v\n", err)
		os.Exit(1)
	}
	defer client.Disconnect(context.Background())

	if err := client.Ping(ctx, nil); err != nil {
		fmt.Fprintf(os.Stderr, "[seed] ping mongo: %v\n", err)
		os.Exit(1)
	}

	db := client.Database(cfg.DbName)
	startedAt := time.Now()

	if err := createTags(ctx, db); err != nil {
		fmt.Fprintf(os.Stderr, "[seed] create tags: %v\n", err)
		os.Exit(1)
	}

	posts, err := createPosts(ctx, db, cfg)
	if err != nil {
		fmt.Fprintf(os.Stderr, "[seed] create posts: %v\n", err)
		os.Exit(1)
	}

	tokens, err := mintTokens(cfg)
	if err != nil {
		fmt.Fprintf(os.Stderr, "[seed] mint tokens: %v\n", err)
		os.Exit(1)
	}

	if err := writeSeedFiles(posts, tokens, cfg); err != nil {
		fmt.Fprintf(os.Stderr, "[seed] write seed files: %v\n", err)
		os.Exit(1)
	}

	elapsed := time.Since(startedAt).Seconds()
	fmt.Printf("[seed] completed in %.1fs\n", elapsed)
}
