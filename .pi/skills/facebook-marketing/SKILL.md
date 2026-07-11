---
name: facebook-marketing
description: >
  Facebook marketing for Pages and Groups. Create/schedule/publish content,
  manage comments, pull insights via Meta Graph API for Pages; plan and run
  Group engagement (API auto-post to Groups is deprecated by Meta — manual /
  Business Suite only). Use when someone asks to grow a Facebook Page, post to
  Pages or Groups, run a content calendar, manage comments, or build Facebook
  marketing strategy.
---

# Facebook Marketing (Pages + Groups)

## What we're marketing: DramaPlay

Vertical short-drama streaming platform for Indonesia. Mobile-first PWA +
Android, VIP subscription (Pakasir). Domain `dramaplay.my.id`. The product IS
short vertical video — which is exactly Facebook's highest-reach format, so the
strategy is cheap: the content you already host is the ad.

**Goal funnel:** Reel/clip on Facebook → hook → "nonton lanjutannya di
DramaPlay" → install/visit `dramaplay.my.id` → free episodes → VIP conversion.

**The marketing loop (do this, skip the rest):**
- Cut 30-60s cliffhanger clips from the most binge-worthy episodes. End on the
  hook, never the resolution. CTA overlay: "Lanjut di DramaPlay".
- Post 1-2 Reels/day on the Page. Reels reach non-followers — this is your
  acquisition engine, not boosted posts.
- Link in **first comment** (`dramaplay.my.id` + UTM), never in the post body —
  in-post links get reach-throttled.
- Run 2-3 niche Groups ("Drama Pendek Indonesia", per-genre). Groups out-reach
  Pages; post daily "episode of the day" + polls "genre apa minggu ini?".
- Track install/visit source with UTM on every link:
  `?utm_source=facebook&utm_medium=social&utm_campaign=reel_<slug>`.

**VIP push (sparingly, ~10% of posts):** "Episode baru tiap hari, unlock semua
seri tanpa iklan — VIP DramaPlay". Sell the binge, not the price.

**Paid (when budget exists):** Advantage+ / Lookalike from existing VIP users,
optimize for app install or `dramaplay.my.id` visits. Start Rp150-300k/day, kill
losers after ~1000 impressions. Vertical Reel creatives only.

## Hard truth about Groups first

Meta **deprecated the Groups API** (the `publish_to_groups` permission and group
feed publishing) on **22 April 2024**. There is **no supported Graph API way to
auto-post to a Group** anymore. So:

- **Pages** → full automation via Graph API (this skill scripts it).
- **Groups** → strategy + content drafting here; actual posting is **manual**
  or scheduled through **Meta Business Suite** (Planner). Don't write code that
  POSTs to `/{group-id}/feed` — it will 403/deprecated-error.

If a user insists on Group auto-posting, tell them the only routes are: manual,
Business Suite Planner, or fragile browser automation (against ToS, breaks
often). Recommend Business Suite.

## Credentials

Store, never hardcode. Read from env or a config file:

- `FB_PAGE_ID` — numeric Page ID
- `FB_PAGE_TOKEN` — **long-lived Page access token**
- `FB_API_VERSION` — default `v21.0`

Get a long-lived token (one-time, then discard app secret):

1. Graph API Explorer → select the Page → scopes: `pages_manage_posts`,
   `pages_read_engagement`, `pages_manage_engagement`, `read_insights`.
2. Exchange short → long-lived (60 days):
   `GET /oauth/access_token?grant_type=fb_exchange_token&client_id=APP_ID&client_secret=APP_SECRET&fb_exchange_token=SHORT_TOKEN`
3. Get the never-expiring **Page** token from `GET /me/accounts` using the
   long-lived **user** token. Store that as `FB_PAGE_TOKEN`.

Tokens are secrets. Rotate periodically, rotate immediately if the host is
compromised. Grant minimal scopes.

## Pages — Graph API (the part you automate)

Base: `https://graph.facebook.com/${FB_API_VERSION}`

| Action | Call |
|---|---|
| Text post | `POST /{page-id}/feed` body `message`, `access_token` |
| Link post | `POST /{page-id}/feed` body `message`, `link` |
| Photo (URL) | `POST /{page-id}/photos` body `url`, `caption` |
| Photo (upload) | `POST /{page-id}/photos` multipart `source`=@file |
| Schedule post | `POST /{page-id}/feed` body `published=false`, `scheduled_publish_time`=UNIX (10min–6mo out) |
| List posts | `GET /{page-id}/posts?fields=id,message,created_time,permalink_url` |
| Comments | `GET /{post-id}/comments` · reply `POST /{comment-id}/comments` · hide `POST /{comment-id}?is_hidden=true` · delete `DELETE /{comment-id}` |
| Insights | `GET /{page-id}/insights?metric=page_impressions,page_engaged_users,page_fans,page_views_total&period=day` |

Use `scripts/fb.sh` for one-off CLI posting/insights. Write a TS/Python script
only when the task needs logic (batching, retries, a calendar). Keep it to the
endpoints above.

Always handle: token expiry (`code 190`), rate limits (`code 4`/`32` →
exponential backoff), and `error.error_user_msg` surfacing to the user.

## Groups — strategy only (no API)

Groups have the **highest organic reach** on Facebook 2025-2026. Drive it with
structure, not automation:

- 3 membership screening questions to filter spam; post-approval for members < 14 days.
- A weekly cadence of prompts (poll, resource thread, tutorial, win-of-the-week, off-topic Friday).
- Don't sell in-group — build trust, sell in DMs/links. Feature members (they reshare).
- Schedule the drafted posts via **Meta Business Suite → Planner**, manually.

## Algorithm (2025-2026): what ranks, what kills

Ranks: meaningful conversations, Group content, native video/Reels (2-3x reach),
Messenger shares, long comment threads, replying to every comment.

Kills reach: engagement bait ("like if…", "tag a friend"), clickbait, external
links in-post (put links in comments), misinformation, posts users flag.

## Content formats (quick ref)

- **Reels** (top organic reach): 15-90s, 9:16 1080x1920, hook in 3s, captions required.
- **Native video**: 1-3min, upload native (YouTube links suppressed), enable captions.
- **Images**: 1080x1080 standalone, 1200x630 link, carousel 2-10. Text < 20% of image.
- **Text**: < 250 chars to avoid "See more"; questions drive comments.
- **Links**: reduce reach — prefer link-in-comments; always add UTM params.

## Posting mix (Pages)

40% video/Reels · 25% community (questions/polls) · 20% images/carousels ·
10% links (in comments) · 5% live. Cadence: 1-2 posts/day + Stories.

## Ads (Marketing API) — when asked

Start $10-20/day, test 3 creatives, kill losers after ~1000 impressions, use
Lookalike audiences from email list / site visitors. Campaign → Ad Set
(targeting/budget) → Ad (creative). This is a separate token scope
(`ads_management`); only set up when the user explicitly wants paid ads.
