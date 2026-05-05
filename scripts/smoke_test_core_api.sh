#!/bin/sh
# scripts/smoke_test_core_api.sh
# SM-P2.5: Integration smoke test for core API endpoints.
# Usage: ./scripts/smoke_test_core_api.sh [BASE_URL] [PAT_TOKEN]
#
# Example:
#   ./scripts/smoke_test_core_api.sh http://localhost:8100 vni_xxxxxxxx

set -eu

BASE_URL="${1:-http://localhost:8100}"
PAT="${2:-}"
PASS=0
FAIL=0

_ok() { echo "  [PASS] $1"; PASS=$((PASS + 1)); }
_fail() { echo "  [FAIL] $1"; FAIL=$((FAIL + 1)); }

_check() {
    local label="$1"
    local url="$2"
    local expected_status="${3:-200}"

    if [ -n "$PAT" ]; then
        actual=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $PAT" "$url" 2>/dev/null)
    else
        actual=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null)
    fi

    if [ "$actual" = "$expected_status" ]; then
        _ok "$label ($actual)"
    else
        _fail "$label (expected $expected_status, got $actual)"
    fi
}

echo ""
echo "=== VNInvest Core API Smoke Test ==="
echo "Base URL: $BASE_URL"
echo ""

# Health
echo "--- Health ---"
_check "GET /core/v1/health" "$BASE_URL/core/v1/health" "200"

# Auth endpoints (no PAT needed)
echo "--- Auth ---"
_check "GET /core/v1/access/capabilities/ (no auth)" "$BASE_URL/core/v1/access/capabilities/" "401"

# Market Serving (requires PAT)
echo "--- Market Serving ---"
_check "GET /core/v1/market/symbol-snapshot/" "$BASE_URL/core/v1/market/symbol-snapshot/" "200"
_check "GET /core/v1/market/session-facts/" "$BASE_URL/core/v1/market/session-facts/" "200"

# Signal Intelligence
echo "--- Signal Intelligence ---"
_check "GET /core/v1/signals/alerts/" "$BASE_URL/core/v1/signals/alerts/" "200"

echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="
if [ "$FAIL" -gt 0 ]; then
    exit 1
fi
