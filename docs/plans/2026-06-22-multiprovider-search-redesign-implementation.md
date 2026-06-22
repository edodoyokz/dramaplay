# Multiprovider Search Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add provider-aware, cached, paginated search with provider badges in UI.

**Architecture:** Extend `/catalog/search` with optional provider/page/limit and reuse existing in-isolate cache. Update `Search.tsx` to load provider chips from `/catalog/home`, keep state in URL, render provider badges, and use `Muat Lagi` pagination.

**Tech Stack:** Hono + Drizzle Worker API; React/Vite consumer.

---

## Task 1: Backend search endpoint

Files:
- Modify `apps/api/src/routes/catalog.ts`

Steps:
1. Replace `/catalog/search` handler.
2. Enforce min query length 2.
3. Parse `provider`, `page`, `limit` (cap 50).
4. Cache key: `search:${provider}:${q}:${page}:${limit}`.
5. If provider is set, validate enabled provider by code.
6. Query dramas joined with primary dramaProviders/providers.
7. Add provider filter when set.
8. Return `items`, `page`, `limit`, `hasMore`, optional `provider`.
9. Run `pnpm --filter @dramaplay/api typecheck` and tests.
10. Commit.

## Task 2: Frontend search redesign

Files:
- Modify `apps/consumer/src/pages/Search.tsx`

Steps:
1. Add `provider?: { code; name }` to Drama type.
2. Load provider chips from `/catalog/home` once.
3. Read/write `q`, `provider`, `page` from URL.
4. Debounce 300ms.
5. Do not call API for query length 0 or 1.
6. Fetch `/catalog/search?q=...&provider=...&page=...&limit=24`.
7. Append when loading page > 1.
8. Render provider chips.
9. Render provider badge on every result card.
10. Add `Muat Lagi` when `hasMore`.
11. Run consumer typecheck/build.
12. Commit.

## Task 3: Deploy and verify

Steps:
1. Deploy API Worker with `.env.deploy`.
2. Build consumer with `VITE_API_URL=/api` and Supabase env.
3. Deploy Cloudflare Pages project from `apps/consumer/dist`.
4. Verify:
   - `/catalog/search?q=cinta&page=1&limit=3`
   - `/catalog/search?q=cinta&provider=reelshort&page=1&limit=3`
   - `https://dramaplay.my.id/api/catalog/search?q=cinta&provider=reelshort`
   - production bundle uses `/api`, not absolute API URL.
