# Detail Tabs + Cast Row (Show & Movie Pages)

**Date:** 2026-08-23
**Status:** Approved

## Problem

The show detail page (`app/show/[id].tsx`) is one long scroll mixing title info, synopsis, details, season chips, and episode marking. There are no cast members anywhere on detail pages, and the movie page (`app/movie/[id].tsx`) is sparse. Users want a TV Time-style experience: a Details tab with cast, separate from episode tracking.

## Requirements

1. Show detail page gets two tabs pinned below the hero:
   - **Details**: synopsis, details grid (network / genres / runtime / status), horizontal cast row
   - **Episodes**: existing season selector, Play Next, Mark All Watched, episode rows (behavior unchanged)
2. Tab bar stays visible (sticky) while content scrolls underneath.
3. Smart default tab:
   - `episodes_seen === 0` (not started, watchlist-only) → **Details**
   - `episodes_seen > 0` → **Episodes**
   - Explicit tap overrides for the life of the screen.
4. Cast row: top ~15 TMDb cast members as circular headshots with actor name + character. Display-only (no navigation).
5. Movie detail page: no tabs (single-tab control looks broken). Same hero frame; enriched details grid; cast row added.
6. No schema changes, no new dependencies.

## Non-goals

- Actor/person detail pages
- "More like this" / similar titles sections
- Swipe gestures between tabs

## Architecture

Approach chosen over alternatives (FlatList refactor, pager-view): **ScrollView `stickyHeaderIndices`** — native pinning, smallest diff to working episode code, zero new deps.

### New files

| File | Purpose |
|---|---|
| `src/lib/queries/credits.ts` | `useTitleCredits(tmdbId, mediaType)` moved from `shows.ts`. Only change: drop `enabled: !!user` gate (TMDb credits are public) → `enabled: !!tmdbId`. Same key `['credits', mediaType, tmdbId]`, 24h staleTime, 14d gcTime. |
| `src/components/detail/DetailTabs.tsx` | Segmented pill control. Props: `tabs: {key,label}[]`, `active`, `onChange`. Themed via `useTheme()`. Light haptic on switch. |
| `src/components/detail/CastRow.tsx` | Props: `cast?: TMDbCastMember[]`, `isLoading`. "Cast" label + horizontal ScrollView of 60px circular headshots (`w185`, expo-image `memory-disk`, initial-letter fallback), name + character below. Skeleton circles while loading. Returns `null` when empty/error (dev-only warn). |

### Modified files

| File | Change |
|---|---|
| `app/show/[id].tsx` | Children array `[HeroBackdrop, <DetailTabs/>, activeContent]` + `stickyHeaderIndices={[1]}`. Derived tab state (no effect): `selectedTab ?? ((show?.episodes_seen ?? 0) > 0 ? 'episodes' : 'details')`. Details branch wraps synopsis + details grid (+ Status item from TMDb `status`) + `<CastRow/>`; Episodes branch wraps existing JSX unchanged. Modal stays screen-level. |
| `app/movie/[id].tsx` | Add details grid (genres / runtime / status), `<CastRow/>` fed by `useTitleCredits(resolvedTmdbId, 'movie')` under Overview. No tab bar. |
| `src/lib/queries/shows.ts` | Replace inline hook with `export { useTitleCredits } from './credits'` so `app/(tabs)/profile/index.tsx` import keeps working. |

## Data flow

- `useTitleCredits` calls existing `getTitleCredits()` in `src/lib/tmdb.ts` (`/{mediaType}/{id}/credits`). Response cast array is pre-ordered by billing; take first 15.
- Default-tab derivation uses `show.episodes_seen` already returned by `useShow` — no new queries.
- Screen renders full-screen spinner until `useShow` resolves, so the default tab is decided before first content paint (no flash/jank).

## Error handling

- Cast fetch failure or zero cast members → section hidden silently; `console.warn` in dev only. Never blocks page render.
- All existing show/movie error states unchanged.

## Verification

- `npx tsc --noEmit`
- Manual: sticky tab bar on scroll; default tab per watched state; explicit tap override; episode marking persists; movie cast renders; profile avatar collage unaffected.
