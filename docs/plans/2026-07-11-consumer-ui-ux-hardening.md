# Consumer UI/UX Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all reviewed consumer UI/UX issues while retaining Dramaplay's current mobile-first visual structure and one-time VIP payment model.

**Architecture:** Keep state and retries inside their owning page; add only pure shared helpers for safe return paths, user-facing auth errors, sharing, and progress percentage. Use native `<dialog>` rather than a modal dependency, existing localStorage engagement helpers, and existing React Router routes.

**Tech Stack:** React 19, React Router 6, TypeScript 6, Tailwind CSS 3, Supabase Auth, existing Vitest workspace, native HTML dialog/Web Share/Clipboard APIs.

---

## Scope guard

- Do not modify Terms, Privacy, or Refund page content.
- Do not add dependencies.
- Do not widen the catalog/detail desktop layout; retain `max-w-md`.
- Do not introduce a design system, global store, toast provider, or generic request abstraction.
- Do not modify API billing behavior. The UI must describe the current one-time purchase behavior.

## Verification baseline

Run from repository root before starting:

```bash
pnpm --filter @dramaplay/consumer typecheck
pnpm --filter @dramaplay/consumer lint
pnpm --filter @dramaplay/consumer build
```

Expected: all three exit `0`. Record any pre-existing lint failure before editing rather than weakening lint rules.

---

### Task 1: Add tested UX behavior helpers

**Files:**
- Create: `apps/consumer/src/lib/ux.ts`
- Create: `apps/consumer/test/ux.test.ts`

**Step 1: Write failing tests**

Cover these exact behaviors:

```ts
import { describe, expect, it } from "vitest";
import { authErrorMessage, progressPercent, safeReturnPath } from "../src/lib/ux";

describe("safeReturnPath", () => {
  it("accepts an internal episode path", () => {
    expect(safeReturnPath("/drama/demo/episode/2")).toBe("/drama/demo/episode/2");
  });
  it("rejects external and protocol-relative paths", () => {
    expect(safeReturnPath("https://evil.example")).toBe("/");
    expect(safeReturnPath("//evil.example")).toBe("/");
  });
});

describe("progressPercent", () => {
  it("calculates and clamps video progress", () => {
    expect(progressPercent(30, 120)).toBe(25);
    expect(progressPercent(200, 120)).toBe(100);
    expect(progressPercent(5, 0)).toBe(0);
  });
});

describe("authErrorMessage", () => {
  it("maps provider errors without exposing technical text", () => {
    expect(authErrorMessage("Invalid login credentials")).toBe("Email atau kata sandi salah.");
    expect(authErrorMessage("unknown internal detail")).toBe("Autentikasi gagal. Silakan coba lagi.");
  });
});
```

**Step 2: Run the test and verify failure**

```bash
pnpm --filter @dramaplay/consumer exec vitest run test/ux.test.ts
```

Expected: FAIL because `src/lib/ux.ts` does not exist.

**Step 3: Implement the minimum pure helpers**

Implement:

```ts
export function safeReturnPath(value: string | null): string {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export function progressPercent(currentTime: number, duration: number): number {
  if (!Number.isFinite(currentTime) || !Number.isFinite(duration) || duration <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((currentTime / duration) * 100)));
}

export function authErrorMessage(message: string): string {
  const value = message.toLowerCase();
  if (value.includes("invalid login credentials")) return "Email atau kata sandi salah.";
  if (value.includes("email not confirmed")) return "Verifikasi email Anda sebelum masuk.";
  if (value.includes("already registered")) return "Email ini sudah terdaftar.";
  if (value.includes("password") && value.includes("characters")) return "Kata sandi terlalu pendek.";
  if (value.includes("rate") || value.includes("too many")) return "Terlalu banyak percobaan. Coba lagi nanti.";
  return "Autentikasi gagal. Silakan coba lagi.";
}
```

**Step 4: Verify the helper tests**

Run the Step 2 command again.

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/consumer/src/lib/ux.ts apps/consumer/test/ux.test.ts
git commit -m "test(consumer): cover safe UX behavior helpers"
```

---

### Task 2: Make authentication accessible and return users to their original journey

**Files:**
- Modify: `apps/consumer/src/pages/Auth.tsx`
- Modify: `apps/consumer/src/components/PricingModal.tsx`
- Test: `apps/consumer/test/ux.test.ts`

**Step 1: Extend return-path tests**

Add cases for empty values, `/auth`, and values containing a valid query string. `/auth` may remain valid; only external navigation must be rejected.

**Step 2: Verify tests pass against the helper contract**

```bash
pnpm --filter @dramaplay/consumer exec vitest run test/ux.test.ts
```

Expected: PASS.

**Step 3: Update Auth**

- Read `returnTo` from `useSearchParams()` and pass it through `safeReturnPath`.
- After password or OAuth login, return to that path instead of always `/`.
- Configure Google `redirectTo` as `/auth?returnTo=<encoded path>` so the callback retains context.
- Use `authErrorMessage` instead of showing raw Supabase messages.
- Add visible `<label>` elements for email and password.
- Add `autoComplete="email"`, and `current-password`/`new-password` according to active tab.
- Add `aria-live="polite"` to feedback messages.
- Add `aria-label="Kembali"` to the back button.
- Add a brief password requirement only on signup.
- Do not add password-reset behavior in this task; list it as deferred because no existing reset route exists.

**Step 4: Update payment login redirects**

In `PricingModal`, replace `/auth` redirects with:

```ts
const returnTo = window.location.pathname + window.location.search;
window.location.assign(`/auth?returnTo=${encodeURIComponent(returnTo)}`);
```

Do not use `alert()`; Task 4 will provide inline payment feedback.

**Step 5: Verify**

```bash
pnpm --filter @dramaplay/consumer typecheck
pnpm --filter @dramaplay/consumer exec vitest run test/ux.test.ts
```

Expected: both exit `0`.

**Step 6: Commit**

```bash
git add apps/consumer/src/pages/Auth.tsx apps/consumer/src/components/PricingModal.tsx apps/consumer/test/ux.test.ts
git commit -m "fix(consumer): preserve journey through authentication"
```

---

### Task 3: Make catalog states honest and recoverable

**Files:**
- Modify: `apps/consumer/src/pages/Home.tsx`
- Modify: `apps/consumer/src/pages/Search.tsx`
- Modify: `apps/consumer/src/pages/ProviderDramas.tsx`

**Step 1: Reproduce current failure paths from source**

Confirm before editing:

- Home failure has no retry.
- Search catch becomes an empty result.
- Provider first-page failure labels every failure “Provider tidak ditemukan.”

Record the lines in the implementation session notes.

**Step 2: Fix Home state**

- Move catalog fetch into a local `loadHome()` function.
- Render one simple poster-grid skeleton while loading; no skeleton package.
- Render “Gagal memuat katalog” with a `Coba Lagi` button on failure.
- Refresh `progressList` on mount and `window.focus`, removing the immutable initializer.
- Replace the logo wrapper `div onClick` with `<Link to="/">`.
- Add `aria-label="Cari drama"` and a minimum `44px` hit area to header search.
- Increase “Lihat Semua” hit area with padding while retaining visual size.
- Remove invented fallbacks: do not render `10 Eps`, `2026`, or `ID` when absent.

**Step 3: Fix Search state**

- Add `error` state independent of `results`.
- Set busy immediately when a valid query/provider changes; clear page-1 results to prevent stale results appearing under a new query.
- Render a retry button that repeats the current query.
- Keep genuine zero-result UI separate from network failure.
- Add an accessible search label (visible or `aria-label`).
- Add `aria-pressed={active}` to provider chips.
- Remove invented year/country fallback.

**Step 4: Fix Provider state**

- Use “Gagal memuat provider” for request failure; reserve “tidak ditemukan” only if the API error exposes a verified 404.
- Keep the existing retry button for both first and subsequent pages.
- Render a clear empty catalog state when loading succeeds with zero items.
- Remove invented year/country fallback.

**Step 5: Verify**

```bash
pnpm --filter @dramaplay/consumer typecheck
pnpm --filter @dramaplay/consumer lint
```

Expected: both exit `0`.

**Step 6: Commit**

```bash
git add apps/consumer/src/pages/Home.tsx apps/consumer/src/pages/Search.tsx apps/consumer/src/pages/ProviderDramas.tsx
git commit -m "fix(consumer): distinguish catalog loading empty and error states"
```

---

### Task 4: Make drama detail recoverable and navigation-correct

**Files:**
- Modify: `apps/consumer/src/pages/DramaDetail.tsx`

**Step 1: Reproduce the failure path**

Confirm that `.catch(() => setData(null))` and `if (!data)` display an endless loader.

**Step 2: Implement explicit state**

- Add separate `loading` and `error` state.
- Put the fetch in `loadDrama()` so retry uses the same path.
- On failure show “Gagal memuat drama”, `Coba Lagi`, and `Kembali`.
- Back uses `navigate(-1)` when history exists, otherwise `/`; use the same handler for normal and error states.
- Add `aria-label="Kembali"` to the icon button.
- If `episodes.length === 0`, replace the playback link with a disabled message “Episode belum tersedia”.
- Add `role="tablist"`, `role="tab"`, `aria-selected`, and associated panel IDs.
- Enlarge essential metadata from 8–10px to at least 10–11px.

**Step 3: Verify**

```bash
pnpm --filter @dramaplay/consumer typecheck
pnpm --filter @dramaplay/consumer lint
```

Expected: both exit `0`.

**Step 4: Commit**

```bash
git add apps/consumer/src/pages/DramaDetail.tsx
git commit -m "fix(consumer): add recoverable drama detail states"
```

---

### Task 5: Make pricing truthful, resilient, and accessible

**Files:**
- Modify: `apps/consumer/src/components/PricingModal.tsx`
- Modify: `apps/consumer/src/pages/Profile.tsx`

**Step 1: Replace misleading benefits**

Use only these guaranteed messages:

- “Buka semua episode VIP selama masa aktif”
- “Pembayaran satu kali, tidak diperpanjang otomatis”
- “Perpanjang kapan saja dengan membeli paket lagi”

Remove claims about no buffering, Full HD, and most-accurate subtitles.

**Step 2: Add plan request states**

- Add `plansLoading` and `plansError`.
- Extract `loadPlans()` for initial fetch and retry.
- Show “Memuat paket...” while pending.
- Show “Paket gagal dimuat” and `Coba Lagi` when failed.
- Keep checkout disabled while loading or submitting.
- Render checkout and coupon failures inline in the drawer; remove all `alert()` calls.
- Each plan must say: `Bayar sekali • aktif N hari`.

**Step 3: Use native dialog**

- Use `<dialog open ...>` or `showModal()` through a ref; prefer `showModal()` so browser focus/inert behavior applies.
- Add `aria-labelledby` and a named close button.
- Handle `cancel` to call `onClose`.
- Prevent accidental backdrop close during checkout.
- Restore scroll/focus through native behavior; do not build a focus-trap utility.

**Step 4: Show subscription expiry in Profile**

Inspect the actual `/auth/me` response type in API source before naming the field. Extend the local response type only with the verified expiry identifier. For VIP users, display `Aktif hingga <localized date>`; for non-VIP users keep the existing activation CTA.

Do not change the API unless the expiry is absent. If absent, stop and ask before expanding scope because that would add a fourth file and server behavior.

**Step 5: Verify**

```bash
pnpm --filter @dramaplay/consumer typecheck
pnpm --filter @dramaplay/consumer lint
```

Expected: both exit `0`.

**Step 6: Commit**

```bash
git add apps/consumer/src/components/PricingModal.tsx apps/consumer/src/pages/Profile.tsx
git commit -m "fix(consumer): clarify one-time VIP purchase UX"
```

---

### Task 6: Expose local engagement honestly to guests

**Files:**
- Modify: `apps/consumer/src/pages/Profile.tsx`

**Step 1: Reproduce mismatch**

Confirm local engagement is loaded only inside `if (userEmail)` although Watch writes it for anonymous visitors.

**Step 2: Load local engagement independently**

- Read likes, favorites, and watch progress immediately on mount regardless of auth.
- Keep `/auth/me` and `/billing/me` gated by session.
- For guests, show local stats and lists first, then a smaller sign-in card explaining that login is required for VIP/payment—not for browser-local history.
- Add text: “Tersimpan hanya di perangkat ini” near local engagement.
- Keep the existing three expandable sections; do not redesign them.
- Add `aria-expanded` and `aria-controls` to statistic buttons.
- Use `posterSrc()` for local history images rather than raw poster URL.

**Step 3: Verify**

```bash
pnpm --filter @dramaplay/consumer typecheck
pnpm --filter @dramaplay/consumer lint
```

Expected: both exit `0`.

**Step 4: Commit**

```bash
git add apps/consumer/src/pages/Profile.tsx
git commit -m "fix(consumer): show local engagement to guest users"
```

---

### Task 7: Correct playback progress, sharing, and episode movement

**Files:**
- Modify: `apps/consumer/src/components/VerticalShortPlayer.tsx`
- Modify: `apps/consumer/src/pages/Watch.tsx`
- Test: `apps/consumer/test/ux.test.ts`

**Step 1: Change player callback contract**

Change `onTimeUpdate` from `(sec: number)` to `(currentTime: number, duration: number)`. Invoke it with both values inside the existing video handler.

**Step 2: Use accurate progress**

In Watch, use `progressPercent(currentTime, duration)` instead of `Math.floor(sec * 3)`. Preserve the existing 10-second write throttle and initial minimum entry behavior.

**Step 3: Implement honest sharing**

Use the minimum inline async handler:

1. If `navigator.share` exists, await it.
2. Otherwise await `navigator.clipboard.writeText`.
3. Show success only after resolution.
4. Ignore user-cancelled share; show “Gagal membagikan link” for other errors.

Do not add a share library.

**Step 4: Add explicit episode movement**

- Extend the verified `/watch` response only if previous-episode data already exists; inspect API response first.
- Always show a next button only when `nextEpisode !== null`.
- Show previous only when `episodeNumber > 1`, using `episodeNumber - 1` because episode numbering is sequential in the existing player contract.
- On ended, navigate only when `nextEpisode !== null`; otherwise return to detail or display completion feedback. Do not manufacture `current + 1`.

**Step 5: Accessibility**

Add accessible names to:

- Back
- Poster/detail link
- Like
- Favorite
- Share
- Report
- Fullscreen
- Seek bar (`role="slider"` plus current/min/max values)

Add `role="status" aria-live="polite"` to toast. Increase player action labels from 10px to 11px.

**Step 6: Verify**

```bash
pnpm --filter @dramaplay/consumer exec vitest run test/ux.test.ts
pnpm --filter @dramaplay/consumer typecheck
pnpm --filter @dramaplay/consumer lint
```

Expected: all exit `0`.

**Step 7: Commit**

```bash
git add apps/consumer/src/components/VerticalShortPlayer.tsx apps/consumer/src/pages/Watch.tsx apps/consumer/test/ux.test.ts
git commit -m "fix(consumer): make playback progress and sharing accurate"
```

---

### Task 8: Make the report overlay a native accessible dialog

**Files:**
- Modify: `apps/consumer/src/pages/Watch.tsx`

**Step 1: Replace the report overlay**

- Replace the absolute overlay with native `<dialog>` controlled by a ref.
- Open with `showModal()`, close through `close()` and the `cancel` event.
- Add an explicit label for the reason `<select>` and message `<textarea>`.
- Add `aria-describedby` pointing to the privacy warning.
- Disable submit while sending and show “Mengirim...” to prevent duplicates.
- Keep existing report payload and 500-character limit unchanged.

**Step 2: Verify keyboard behavior manually**

At mobile viewport:

1. Open report.
2. Press Tab through reason, message, Cancel, Send.
3. Press Escape and confirm dialog closes.
4. Reopen and confirm focus starts inside the dialog.

**Step 3: Verify code**

```bash
pnpm --filter @dramaplay/consumer typecheck
pnpm --filter @dramaplay/consumer lint
```

Expected: both exit `0`.

**Step 4: Commit**

```bash
git add apps/consumer/src/pages/Watch.tsx
git commit -m "fix(consumer): use accessible report dialog"
```

---

### Task 9: Add 404, reduced motion, readable text, and intentional desktop framing

**Files:**
- Create: `apps/consumer/src/pages/NotFound.tsx`
- Modify: `apps/consumer/src/App.tsx`
- Modify: `apps/consumer/src/index.css`

**Step 1: Add minimal NotFound page**

Render:

- `404`
- “Halaman tidak ditemukan”
- Link to home
- Link to search
- `SeoHead` with `noindex`

Do not add illustrations or assets.

**Step 2: Add wildcard route**

Add `path="*"` under the standard Layout so bottom navigation remains available.

**Step 3: Improve nav semantics and touch targets**

- Add `aria-label="Navigasi utama"` to the bottom nav.
- Ensure every nav item has at least a 44×44 hit area.
- Increase labels from 10px to 11px.
- Use `aria-current` supplied by `NavLink`; do not duplicate state.

**Step 4: Add CSS accessibility polish**

Add:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    scroll-behavior: auto !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

Retain `max-w-md`. At desktop widths, make the frame intentional using only the existing body background and subtle frame shadow/border; do not change content width or grid count.

**Step 5: Verify**

```bash
pnpm --filter @dramaplay/consumer typecheck
pnpm --filter @dramaplay/consumer lint
pnpm --filter @dramaplay/consumer build
```

Expected: all exit `0`.

**Step 6: Commit**

```bash
git add apps/consumer/src/pages/NotFound.tsx apps/consumer/src/App.tsx apps/consumer/src/index.css
git commit -m "fix(consumer): add accessible navigation fallback and motion settings"
```

---

### Task 10: Complete browser smoke review and final verification

**Files:**
- Modify only if a verified bug is found in an already scoped file.

**Step 1: Start the existing dev server safely**

Check port first:

```bash
ss -tlnp | grep ':5173' || true
```

If unused:

```bash
pnpm --filter @dramaplay/consumer dev --host 127.0.0.1
```

Do not kill an existing process without confirmation.

**Step 2: Mobile smoke matrix (`390×844`)**

Verify manually:

1. Home loading/error/retry and catalog display.
2. Search suggestions, provider filter, zero result, failure, retry.
3. Detail success, failure, no-episode state, browser back context.
4. Free playback, accurate progress, share, report, next/end behavior.
5. Locked episode → pricing disclosure → login → return path.
6. Guest profile local data; signed-in profile VIP expiry/payment.
7. Unknown route → 404.
8. Keyboard labels and Escape behavior for both dialogs.

**Step 3: Desktop smoke (`1440×1000`)**

Confirm the centered mobile frame remains intentional, bottom navigation aligns to the frame, and dialogs stay within the frame without horizontal overflow.

**Step 4: Run final automated checks**

```bash
pnpm --filter @dramaplay/consumer exec vitest run
pnpm --filter @dramaplay/consumer typecheck
pnpm --filter @dramaplay/consumer lint
pnpm --filter @dramaplay/consumer build
/usr/bin/git diff --check
```

Expected: all commands exit `0`.

**Step 5: Review scope and diff**

```bash
/usr/bin/git status --short
/usr/bin/git diff --stat
/usr/bin/git diff
```

Confirm:

- No legal-page content changed.
- No dependency or lockfile changed.
- No API behavior changed.
- No external URLs or secrets added.
- No metadata fallbacks remain for `2026`, `ID`, or fake episode counts.
- No raw `alert()` remains in consumer payment/auth paths.

**Step 6: Commit any final scoped corrections**

```bash
git add apps/consumer
git commit -m "fix(consumer): finish UI UX hardening"
```

Skip this commit if Step 5 produced no corrections.

---

## Deferred intentionally

- Password reset: add only when a reset route/email flow is specified.
- Full desktop responsive catalog: add only when desktop analytics justify it.
- Cross-device engagement sync: add only when local-only behavior becomes a product problem.
- Component test framework: add only when repeated interactive UI regressions justify the dependency and setup.
- Legal page copy: explicitly out of scope.
