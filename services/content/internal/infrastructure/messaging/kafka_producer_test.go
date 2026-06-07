package messaging

import (
	"encoding/json"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestBuildDeadLetterPayload(t *testing.T) {
	cause := errors.New("processing failed")
	value := []byte(`{"postId":"post-123"}`)

	data, err := buildDeadLetterPayload("posts", value, cause)
	assert.NoError(t, err)
	assert.NotEmpty(t, data)

	var payload struct {
		OriginalTopic string          `json:"originalTopic"`
		Error         string          `json:"error"`
		Payload       json.RawMessage `json:"payload"`
		Timestamp     string          `json:"timestamp"`
	}
	assert.NoError(t, json.Unmarshal(data, &payload))

	assert.Equal(t, "posts", payload.OriginalTopic)
	assert.Equal(t, "processing failed", payload.Error)
	assert.JSONEq(t, string(value), string(payload.Payload))
	assert.NotEmpty(t, payload.Timestamp)
}

func TestBuildDeadLetterPayload_PropagatesMarshalError(t *testing.T) {
	cause := errors.New("boom")
	invalid := json.RawMessage(`{`)

	_, err := buildDeadLetterPayload("posts", invalid, cause)
	assert.Error(t, err)
}
