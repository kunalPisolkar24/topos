//go:build integration

package ratelimit

import (
	"context"
	"testing"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/wait"
)

func startRedis(t *testing.T, ctx context.Context) *redis.Client {
	t.Helper()

	req := testcontainers.ContainerRequest{
		Image:        "redis:7.2-alpine",
		ExposedPorts: []string{"6379/tcp"},
		WaitingFor:   wait.ForLog("Ready to accept connections").WithStartupTimeout(2 * time.Minute),
	}
	container, err := testcontainers.GenericContainer(ctx, testcontainers.GenericContainerRequest{
		ContainerRequest: req,
		Started:          true,
	})
	require.NoError(t, err)
	t.Cleanup(func() { _ = container.Terminate(context.Background()) })

	endpoint, err := container.Endpoint(ctx, "")
	require.NoError(t, err)

	client := redis.NewClient(&redis.Options{Addr: endpoint})
	t.Cleanup(func() { _ = client.Close() })
	require.NoError(t, client.Ping(ctx).Err())
	return client
}

func intLimits(window time.Duration, quota int) Limits {
	return Limits{
		Enabled:              true,
		Reads:                quota,
		Mutations:            quota,
		Interactions:         quota,
		Search:               quota,
		AI:                   quota,
		Window:               window,
		DegradedMultiplier:   2,
		AIDegradedMultiplier: 1,
		AIConcurrency:        5,
		RedisTimeout:         2 * time.Second,
		MemoryMaxEntries:     10000,
	}
}

func TestRedisSharedAcrossReplicas(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	client := startRedis(t, ctx)
	first := New(intLimits(time.Minute, 5), client)
	second := New(intLimits(time.Minute, 5), client)

	allowed := 0
	for i := 0; i < 5; i++ {
		if first.Allow(ctx, PolicyReads, "u:shared").Allowed {
			allowed++
		}
		if second.Allow(ctx, PolicyReads, "u:shared").Allowed {
			allowed++
		}
	}
	assert.Equal(t, 5, allowed, "two limiters on one Redis share a single quota of 5")
	assert.False(t, first.Allow(ctx, PolicyReads, "u:shared").Allowed)
	assert.False(t, second.Allow(ctx, PolicyReads, "u:shared").Allowed)
	// A different subject is unaffected.
	assert.True(t, first.Allow(ctx, PolicyReads, "u:other").Allowed)
}

func TestRedisKeysExpire(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	client := startRedis(t, ctx)
	l := New(intLimits(2*time.Second, 1), client)

	require.True(t, l.Allow(ctx, PolicySearch, "u:ttl").Allowed)
	assert.False(t, l.Allow(ctx, PolicySearch, "u:ttl").Allowed)

	ttl, err := client.PTTL(ctx, Key(PolicySearch, "u:ttl")).Result()
	require.NoError(t, err)
	assert.Greater(t, ttl, time.Duration(0), "quota keys carry a TTL so they cannot grow unbounded")
	assert.LessOrEqual(t, ttl, 2*time.Second)

	time.Sleep(2200 * time.Millisecond)
	assert.True(t, l.Allow(ctx, PolicySearch, "u:ttl").Allowed, "the bucket resets after expiry")
}

func TestRedisOutageUsesMemoryFallback(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	client := startRedis(t, ctx)
	l := New(intLimits(time.Minute, 2), client)
	require.True(t, l.Allow(ctx, PolicyReads, "u:flap").Allowed)
	assert.False(t, l.Degraded())

	// Point the limiter at a dead port: decisions degrade instead of erroring.
	dead := redis.NewClient(&redis.Options{Addr: "localhost:1"})
	t.Cleanup(func() { _ = dead.Close() })
	l.SetClient(dead)

	d := l.Allow(ctx, PolicyReads, "u:flap")
	assert.True(t, d.Allowed)
	assert.True(t, d.Degraded, "an unreachable Redis serves from memory")
}
