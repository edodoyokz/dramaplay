# Launch Readiness

## Subscription Smoke Evidence

- Date:
- API URL:
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
curl -i https://api.dramaplay.my.id/watch/<free-slug>/1
curl -i https://api.dramaplay.my.id/watch/<vip-slug>/1
curl -i -H "Authorization: Bearer <free-user-token>" https://api.dramaplay.my.id/watch/<vip-slug>/1
curl -i -H "Authorization: Bearer <vip-user-token>" https://api.dramaplay.my.id/watch/<vip-slug>/1
```

Expected statuses: `200`, `403`, `403`, `200`.

## Deploy Evidence

- Production DB migration applied: `payments_pakasir_reference_unique` exists.
- API Worker deployed: Version ID `8dfdc30e-dbe8-4889-865d-de661b60df9c`.
- Consumer Pages deployed: `https://062f194c.dramaplay-consumer.pages.dev`.
- Public smoke after deploy:
  - `https://api.dramaplay.my.id/health` → 200
  - `https://api.dramaplay.my.id/billing/plans` → 200
  - `https://api.dramaplay.my.id/catalog/home` → 200

## Remaining Risks

- Payment smoke requires a real test user JWT and manual Pakasir payment step.
- Real Pakasir payment/webhook-to-VIP activation still needs manual proof before broad paid launch.
- Legal/support pages still need business/legal review before paid public launch.
