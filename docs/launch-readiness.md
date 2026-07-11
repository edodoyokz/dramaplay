# Launch Readiness

## Subscription Smoke Evidence

- Date:
- API URL: `https://api.dramaplay.my.id`
- Test user:
- Plan:
- Checkout created: yes/no
- Pakasir payment completed: yes/no
- Webhook received: yes/no
- Payment status paid: yes/no
- `/auth/me` returns `isVip: true`: yes/no
- VIP episode unlock tested: yes/no

## Dependency Audit

- `pnpm audit --audit-level high`: PASS on 2026-06-23 after upgrading runtime/dev dependencies. Remaining advisories are below high severity.

## VIP Access Smoke Commands

```bash
curl -i -A 'Mozilla/5.0' https://api.dramaplay.my.id/watch/<free-slug>/1
curl -i -A 'Mozilla/5.0' https://api.dramaplay.my.id/watch/<vip-slug>/1
curl -i -A 'Mozilla/5.0' -H "Authorization: Bearer <free-user-token>" https://api.dramaplay.my.id/watch/<vip-slug>/1
curl -i -A 'Mozilla/5.0' -H "Authorization: Bearer <vip-user-token>" https://api.dramaplay.my.id/watch/<vip-slug>/1
```

Expected statuses: `200`, `403`, `403`, `200`.

## Deploy Evidence

- Production DB migration applied: `payments_pakasir_reference_unique` exists.
- API Worker deployed: Version ID `d2cc8b01-a3ad-4854-8370-816de82f34d6` (2026-07-11 launch fixes).
- Consumer Pages deployed: `https://062f194c.dramaplay-consumer.pages.dev`.
- Public smoke after deploy:
  - `https://api.dramaplay.my.id/health` → 200
  - `https://api.dramaplay.my.id/billing/plans` → 200
  - `https://api.dramaplay.my.id/catalog/home` → 200

## Code readiness

- [x] Subscription grant extends active VIP instead of stacking rows
- [x] Pakasir `verifyTransaction` shared helper (webhook + reconcile)
- [x] Auth profile upsert only on `/auth/me` + checkout/redeem
- [x] Provider engine is v2-only (legacy removed)
- [ ] Real Pakasir payment → webhook → `/auth/me` `isVip:true` evidence filled above (sandbox confirmed by operator)
- [ ] Free-tier Worker CPU still a capacity risk at scale (watch path)

## Remaining Risks

- Cloudflare Free Workers 10ms CPU on watch can fail under concurrent load — upgrade when paid traffic grows.
- Content is via paid third-party API subscription; keep ToS/provider terms aligned with public redistrib/UI.
