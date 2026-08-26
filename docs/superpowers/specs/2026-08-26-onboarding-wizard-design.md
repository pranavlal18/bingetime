# Onboarding Wizard + Empty State Upgrades — Design

**Date:** 2026-08-26
**Status:** Approved (user, in conversation — mockups reviewed)
**Stitch project:** `projects/11496724429326899252` — "BingeTime — Onboarding Wizard Mockup" (3 screens generated: Welcome, Genre Picker, Empty State)
**Mocks:** Welcome `efef070ec4054410a94f0f7986cd1d0b`, Genres `855aa4bd69544b4ca90d2077159efdd9`, Empty `4ce252e40abc447b9be23382b6891724`; Step 3 poster grid described textually (Stitch timeout, follows existing Discover card pattern)

## Problem

Fresh user after signup → lands on empty Shows tab with plain text "No shows yet" (no CTA). No onboarding/welcome flow exists. Movies tab identical. Only Profile has a proper empty-state card with actions. Discover works standalone (trending always renders) but is never surfaced to new users. Result feels like a blank professional app rather than a guided first-run.

## Goal

Single skippable first-run wizard that seeds the library with a few titles so the user lands on a populated feed. Bundled with upgraded Shows/Movies empty states so users who skip still get a clear CTA. Reinstall-safe (Supabase account with data must not re-show the wizard when local storage was wiped).

## Scope: Full wizard + empty states (both)

## Wizard: 3 steps, single route `app/onboarding.tsx`

Linear flow inside one screen with reanimated fade/slide between steps — chosen over a 3-screen route group to avoid cross-screen param plumbing (genre picks stay in local state) and to keep the throwaway flow in one cohesive ~400-line unit.

All steps use the cinematic palette (`#15121b`/`#211e27`/`#8b5cf6`/`#d0bcff`, Inter, 16px radius) matching `src/theme.ts`.

### Trigger & persistence

**Trigger model (revised after user feedback — flash fix):** the wizard is armed ONLY at signup. `register.tsx` sets `onboardingPending = true` (persisted store) on successful signUp; first login consumes it (`index.tsx` / `InnerLayout` route to `/onboarding` when pending). Skip/Finish set `onboardingPending = false`. Returning accounts on any device never route to the wizard — no async library-count guard needed (removed), zero delay, wizard impossible post-first-run. Defensive `InnerLayout` branch bounces `user && inOnboarding && !pending` → tabs.

- `onboardingPending: boolean = false` in persisted Zustand store (`src/stores/*`, MMKV — default false is correct for everyone; no migration).
- `app/index.tsx`: authed && pending → `/onboarding`; else current behavior.
- `app/_layout.tsx` registers `/onboarding` with `headerShown: false`, `slide_from_right`; post-login `(auth)` redirect respects pending; unauthenticated on any non-auth surface → login.
- Edge: storage cleared between signup and first login → wizard skipped; upgraded empty-state CTAs cover discovery.

### Step 1 — Welcome

Matches Stitch mock 1 (dark radial glow, skip top-right, centered icon in `#8b5cf6`→`#d0bcff` gradient square).
- Headline "Track what you watch." 32px white bold, subtitle "Your shows. Your movies. All in one place." `#cbc3d7` 16px.
- 3 feature cards (#211e27, 16px) in vertical stack: Track Progress / Discover / Never miss an episode (icon + label).
- 3 page dots (1 active `#d0bcff`), primary CTA "Get Started" full-width `#8b5cf6` 56px 16px radius, hint "Already have favorites? We'll help you add them in seconds." `#958ea0`.
- Back: no. Skip → flag + tabs.

### Step 2 — Choose genres

Matches Stitch mock 2.
- Header: back ←, Skip, dots 2/3.
- Headline "What do you love to watch?" 24px white left, subtitle "Pick a few genres — we'll suggest titles you'll love." `#cbc3d7`.
- Two wrap sections: "TV SHOWS" + "MOVIES" uppercase `#958ea0` 12px, chips:
  - Unselected: `#211e27` bg `#cbc3d7` text, 100px radius.
  - Selected: `#d0bcff` bg `#3c0091` text + ✓.
  - TV: Drama, Comedy, Sci-Fi & Fantasy, Crime, Thriller, Action & Adventure, Mystery, Animation … Movie: Action, Comedy, Drama, Sci-Fi, Horror, Thriller, Animation, Adventure …
- Data: TMDb `/genre/tv/list` + `/genre/movie/list` via new `getGenres` in `src/lib/tmdb.ts`, hooks `useGenres('tv'|'movie')` cached 24h (matches `people/credits/upcoming` gcTime 14d, staleTime 24h pattern).
- Bottom: "Continue — N selected" (N updates live, purple active; enabled even when 0 — skipping allowed), secondary text "Continue without picking" `#958ea0` skips picker.

### Step 3 — Add your first titles

- Header 3/3 dots, same nav. Title "Add your first titles" 24px, subtitle "Tap to select — change anytime."
- Filter pills: All / TV / Movies (All active `#211e27`/`#d0bcff`).
- 3-col FlashList poster grid (gap 10px, card 16px radius, year below title) sourced from TMDb discover by picked genres, `sort_by=popularity.desc`, up to 24 combined (interleaved TV + Movie). Falls back to trending (existing `getTrending`) when no genres picked.
- New hook `useOnboardingSuggestions({ tvGenreIds, movieGenreIds })` in `src/lib/queries/onboarding.ts` (or `discover.ts`); staleTime 10m (trending pattern), gcTime 24h.
- Selection: tap toggles `Set<string>` of ids, hapticLight, selected shows `#8b5cf6` 2px border + check circle overlay + dim, counter badge "N selected" top-right `#d0bcff`/`#3c0091`, same affordance as Discover filtered-in-library behavior (`sessionAddedIds` pattern).
- Bottom sticky: primary "Add N to my library" disabled when N=0 (hint "Pick at least one or skip"), on tap sequential `addShowToLibrary`/`addMovieToLibrary` (existing in `discover.ts`, each does TMDb detail + upsert global show/movie + user_shows/movies upsert) with progress text "Adding i of N…", allSettled — successes invalidate `shows/movies/profile/stats/upcoming` caches, failures counted, on done show snackbar "Added X of Y" (partial-ok), then `setHasOnboarded(true)` + `router.replace('/(tabs)/shows')`. Skip also sets flag.

### Empty-state upgrades

Replace text-only `ListEmptyComponent` in:

- `app/(tabs)/shows/index.tsx` (~438): new card `#211e27` 24px radius padding 32, centered TV icon circle `#2c2832`/`#8b5cf6` 48px, "Your watchlist is empty" 20px white bold, subtitle "Find shows you love and track every episode." `#cbc3d7`, primary "Find shows to add" full-width `#8b5cf6` 48px 16px + search icon → `router.replace('/(tabs)/discover')`, secondary outline "Browse Trending", hint outside "Tip: add from Discover — trending, search & genres." `#958ea0`.
- `app/(tabs)/movies/index.tsx` (~377): same pattern, movie copy. Reuses profile empty-state card component affordance but inline (no new shared component — simple to keep focused per YAGNI).

## Error / edge handling

- TMDb genre/discover failures: show retry affordance (small inline error + retry), wizard still dismissible via Skip.
- Batch add partial failure: tolerated; successes populate tabs; snackbar notes misses; wizard still completes (titles remain discoverable).
- Offline: wizard fetch shows empty with retry; Skip path always works.

## Verification

- `npm run typecheck` after each phase, zero new errors.
- Manual matrix: (a) fresh account full 3-step → populated tabs, (b) skip at step 1/2/3 → flag set, (c) reinstall-with-data auto-skip (mock by clearing MMKV), (d) zero-genre-picks → 0-selection disabled + trending fallback grid, (e) 7-add with one forced failure → partial snackbar.
- No new lint/test scripts; existing `tomatometer`-like patterns reused.

## Out of scope (roadmap candidates, not this spec)

`total_episodes` never populated for Discover-added shows (progress bars broken) — queued next bug fix. First-class Search screen, stats sharing/export, widgets, app icon/splash polish — future candidates from discovery session.
