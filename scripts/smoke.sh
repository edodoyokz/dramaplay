#!/usr/bin/env bash
set -euo pipefail

API="${API_URL:-https://api.dramaplay.id}"

echo "→ $API/health"
curl -fsS "$API/health" | grep -q '"ok":true'

echo "→ $API/catalog/trending"
curl -fsS "$API/catalog/trending" | grep -q 'items'

echo "→ $API/billing/plans"
curl -fsS "$API/billing/plans" | grep -q 'items'

echo "smoke ok"
