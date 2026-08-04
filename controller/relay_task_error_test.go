package controller

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/dto"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRespondTaskErrorRemapsUpstreamAuthFailures(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name           string
		statusCode     int
		localError     bool
		wantStatusCode int
	}{
		{
			name:           "upstream 401 becomes 502",
			statusCode:     http.StatusUnauthorized,
			localError:     false,
			wantStatusCode: http.StatusBadGateway,
		},
		{
			name:           "upstream 403 becomes 502",
			statusCode:     http.StatusForbidden,
			localError:     false,
			wantStatusCode: http.StatusBadGateway,
		},
		{
			name:           "local 401 stays 401",
			statusCode:     http.StatusUnauthorized,
			localError:     true,
			wantStatusCode: http.StatusUnauthorized,
		},
		{
			name:           "upstream 500 stays 500",
			statusCode:     http.StatusInternalServerError,
			localError:     false,
			wantStatusCode: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			respondTaskError(c, &dto.TaskError{
				Code:       "upstream_error",
				Message:    "invalid upstream key",
				StatusCode: tt.statusCode,
				LocalError: tt.localError,
			})
			assert.Equal(t, tt.wantStatusCode, w.Code)

			var body dto.TaskError
			require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
			assert.Equal(t, "upstream_error", body.Code)
			assert.Equal(t, "invalid upstream key", body.Message)
		})
	}
}
