# Consumer UI/UX Hardening Design

**Date:** 2026-07-11
**Status:** Approved

## Goal

Resolve all findings from the Dramaplay consumer UI/UX review without redesigning the product, adding dependencies, or expanding the desktop layout beyond its current mobile-first frame.

## Product decisions

- Payment is one-time. VIP is active for the purchased duration and never renews automatically.
- Desktop retains the centered `max-w-md` mobile application; only its framing/background may be polished.
- The current dark rose/amber visual language remains.
- Legal page content is out of scope.
- No new design system, state manager, modal library, toast framework, or test framework.

## Approach

Keep the existing route and component structure. Fix misleading copy and broken states at their current owners, use native `<dialog>` for payment/report overlays, and extract only small pure helpers when logic needs a runnable test. Reuse the existing local engagement module and browser APIs.

## Milestone 1: Payment clarity and conversion

`PricingModal` will state only guaranteed benefits. It will explicitly say that payment is one-time, VIP lasts for the selected plan duration, and renewal requires another payment. Plan loading, failure, retry, and checkout failure will be rendered inline instead of using `alert()`.

The profile will show VIP expiry returned by `/auth/me`. Login will accept a safe internal return path so users entering from a locked episode can resume their original journey after authentication.

## Milestone 2: Honest states and navigation

Home, search, drama detail, provider listing, and pricing will distinguish loading, empty, and failure states. Each recoverable failure gets a retry action. Missing metadata will be omitted rather than replaced with invented year, country, or episode counts.

Drama detail will preserve browser history when going back, disable playback when there are no episodes, and show a real failure state. A small wildcard route will handle unknown URLs.

## Milestone 3: Accessibility

Payment and report overlays will use native `<dialog>`, including Escape dismissal and browser focus management. Forms receive labels, icon-only actions receive accessible names, tab controls expose selected state, status messages use live regions, and selected provider chips expose pressed state.

Touch targets and essential text will be enlarged. A `prefers-reduced-motion` rule will suppress decorative movement and nonessential transitions.

## Milestone 4: Playback and polish

Guest users can inspect their local watch history, likes, and favorites; authentication remains necessary only for VIP and payment data. Home progress refreshes on focus. Watch progress uses `currentTime / duration`, share prefers `navigator.share` and safely falls back to clipboard, and explicit previous/next episode controls are shown when valid.

The desktop experience remains a centered mobile frame. No responsive desktop catalog is introduced.

## Error handling

- Network failure must never appear as an empty result or perpetual loader.
- Retry stays local to the failed request.
- Payment errors remain inside the payment surface.
- Clipboard/share success is shown only after the browser operation resolves.
- Auth errors are mapped to short Indonesian messages; unknown provider details are not exposed.
- Invalid return paths are rejected in favor of `/`.

## Testing

The project has no consumer component-test framework, so it will not gain one solely for this work. Pure behavior will be extracted into small helpers and tested with the existing Vitest setup where practical. UI changes will be verified by consumer lint, typecheck, build, and a manual browser smoke matrix at mobile and desktop viewports.

Critical smoke journeys:

1. Home → search → detail → free episode → back.
2. Locked episode → pricing → login → return to episode.
3. Pricing plans loading, error/retry, and one-time-payment disclosure.
4. Guest profile shows local engagement; signed-in profile shows payment and VIP expiry.
5. Search network failure differs from zero results.
6. Keyboard navigation opens/closes dialogs and returns focus.
7. Unknown route renders a useful 404.

## Non-goals

- Full desktop redesign
- New filters or recommendation features
- Cross-device engagement sync
- Legal copy changes
- Payment provider or billing architecture changes
- Visual rebrand
