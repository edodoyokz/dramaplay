# Safe Error Report Email Design

## Goal

Add a safe report button flow that lets users report playback/payment/content errors and notifies support by email without exposing secrets or sensitive user data.

## Recommended Approach

Use a server-side `POST /reports` endpoint. The consumer sends a small sanitized report payload. The API optionally attaches `reporterId` if the Authorization token is valid, resolves episode IDs when possible, stores the report in the existing `reports` table, then sends a plain-text Resend email to `REPORT_EMAIL_TO`.

## Safety Controls

- Resend API key stays only in Cloudflare Worker secret `RESEND_API_KEY`.
- Destination email stays in Worker secret `REPORT_EMAIL_TO`.
- Anonymous reports are allowed, but payload is validated and size-limited.
- Report reasons are an enum: `video_error`, `subtitle_error`, `payment_error`, `wrong_episode`, `other`.
- Free-text message is trimmed to 500 chars.
- User agent is trimmed to 300 chars.
- Authorization, cookies, localStorage, and full sensitive headers are never accepted from client payload.
- Email uses plain text and fixed subject prefix, not raw HTML.
- API uses a tiny in-memory per-IP/user rate limiter: 5 reports per 10 minutes. This is enough for basic abuse resistance; upgrade to KV/Postgres only if abuse appears.
- DB insert remains source of truth. Email failure should not fail user-facing report submission.

## UX

On the Watch screen, replace the current `window.confirm` report with a minimal modal:

- user chooses reason
- optional note
- submit button sends report
- success toast: `Laporan terkirim. Terima kasih!`

## Data Flow

1. User clicks report in player.
2. Consumer posts to `/reports` with drama slug, episode number, reason, optional message, and safe client context.
3. API validates and rate-limits.
4. API resolves episode ID and inserts into `reports`.
5. API sends email via Resend to `REPORT_EMAIL_TO`.
6. API returns `{ ok: true }`.

## Deployment

Worker secrets required:

- `RESEND_API_KEY` already configured.
- `REPORT_EMAIL_TO=webdev@nusanexus.com` configured.

Redeploy API and consumer after code changes.
