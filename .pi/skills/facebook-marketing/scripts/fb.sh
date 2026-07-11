#!/usr/bin/env bash
# Facebook Page CLI via Graph API. Pages only — Groups API is deprecated.
# Env: FB_PAGE_ID, FB_PAGE_TOKEN, FB_API_VERSION (default v21.0)
set -euo pipefail

: "${FB_PAGE_ID:?set FB_PAGE_ID}"
: "${FB_PAGE_TOKEN:?set FB_PAGE_TOKEN}"
V="${FB_API_VERSION:-v21.0}"
BASE="https://graph.facebook.com/$V"

usage() {
  cat <<EOF
Usage:
  fb.sh post "message"                       text post
  fb.sh link "message" "https://url"         link post
  fb.sh photo "caption" "https://img.jpg"    photo by URL
  fb.sh schedule "message" <unix_ts>         scheduled post (10min–6mo out)
  fb.sh posts                                list recent posts
  fb.sh insights                             last-7d page insights
  fb.sh reply <comment_id> "message"         reply to a comment
EOF
  exit 1
}

# curl wrapper: fails loudly, surfaces Graph API error messages.
g() {
  local resp
  resp=$(curl -sS "$@")
  if echo "$resp" | grep -q '"error"'; then
    echo "Graph API error:" >&2
    echo "$resp" >&2
    exit 1
  fi
  echo "$resp"
}

cmd="${1:-}"; shift || true
case "$cmd" in
  post)     g -X POST "$BASE/$FB_PAGE_ID/feed" -d "message=$1" -d "access_token=$FB_PAGE_TOKEN" ;;
  link)     g -X POST "$BASE/$FB_PAGE_ID/feed" -d "message=$1" -d "link=$2" -d "access_token=$FB_PAGE_TOKEN" ;;
  photo)    g -X POST "$BASE/$FB_PAGE_ID/photos" -d "caption=$1" -d "url=$2" -d "access_token=$FB_PAGE_TOKEN" ;;
  schedule) g -X POST "$BASE/$FB_PAGE_ID/feed" -d "message=$1" -d "published=false" \
              -d "scheduled_publish_time=$2" -d "access_token=$FB_PAGE_TOKEN" ;;
  posts)    g -G "$BASE/$FB_PAGE_ID/posts" \
              --data-urlencode "fields=id,message,created_time,permalink_url" \
              --data-urlencode "access_token=$FB_PAGE_TOKEN" ;;
  insights) g -G "$BASE/$FB_PAGE_ID/insights" \
              --data-urlencode "metric=page_impressions,page_engaged_users,page_fans,page_views_total" \
              --data-urlencode "period=day" \
              --data-urlencode "access_token=$FB_PAGE_TOKEN" ;;
  reply)    g -X POST "$BASE/$1/comments" -d "message=$2" -d "access_token=$FB_PAGE_TOKEN" ;;
  *)        usage ;;
esac
