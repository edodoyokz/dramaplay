# Archive (historical only)

Do **not** treat files here as current architecture or runbooks.

Moved out of the live tree so old design/implementation notes stop misleading
day-to-day work. Current truth lives in:

- `README.md` (repo root)
- `docs/setup/`
- `docs/deploy/`
- `docs/launch-readiness.md`
- `docs/providers/sapimu-provider-wiki.md`
- `docs/curl-endpoint/` (provider HTTP notes)

| Folder | What it was |
|---|---|
| `plans/` | One-off design/implementation plans (2026-06) |
| `reports/` | Capacity/provider audits |
| `tasks/` | Agent task result dumps from root |
| `scrapes/` | Raw Sapimu HTML/JSON probe dumps |
| `superpowers/` | Extra plan artifacts |

Provider runtime is **v2 only** (`apps/api/src/providers/sapimu/providers/*`).
Legacy engine code was removed.
