#!/bin/bash
# Sync idrama in small lazy batches to avoid timeout + rate limit.
# Run: chmod +x scripts/sync-idrama-loop.sh && ./scripts/sync-idrama-loop.sh
# Stops after N rounds or when batch returns 0 dramaNew.
set -euo pipefail
MAX_ROUNDS=${1:-10}
BATCH=${2:-15}
ROUND=0

while [ $ROUND -lt $MAX_ROUNDS ]; do
  ROUND=$((ROUND + 1))
  echo "=== Round $ROUND / $MAX_ROUNDS ==="
  OUT=$(pnpm --filter @dramaplay/api exec tsx scripts/sync-providers.ts idrama --max "$BATCH" --search-seed 2>&1)
  echo "$OUT" | grep "done:"
  # Stop if nothing new was added (feeds exhausted)
  if echo "$OUT" | grep -q "+0 dramas"; then
    echo "No new dramas this round — feeds exhausted. Done."
    break
  fi
done
