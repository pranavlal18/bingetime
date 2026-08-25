# Network & Company Browse Pages — Design

**Date:** 2026-08-25
**Status:** Approved (user, in conversation)

## Goal

Make networks (TV) and production companies (movies) first-class browse entry points, on par with genres:

1. A **network page** per streaming platform (`/discover/network`) mirroring the genre page.
2. A **company page** per studio (`/discover/company`) as the movie equivalent of networks.
3. Networks/companies **tappable everywhere they appear** — show detail, movie detail, upcoming episode cards — each tap firing the same Light haptic as genre chips.
4. Full **sorting** on all three browse pages via the existing bottom-sheet pattern.
5. Polished page design: logo in header when available.

## Decisions (from brainstorming)

| Question | Decision |
|---|---|
| Movie equivalent of networks | Production companies (`with_companies`) |
| Sort options | Popular · Top Rated · Newest · A–Z · Most Votes (existing `GENRE_SORT_OPTIONS`, server-side) |
| Detail-page rendering | Logo pills (TMDb `logo_path`), text-chip fallback when no logo |
| Genre page scope | Unified with network/company pages via one shared browser component |
| Architecture | Shared `CollectionBrowser` + thin routes (Approach A) |

Verified: TMDb accepts `original_title.asc` for `/discover/tv` (A–Z works server-side; no client sort needed).

## Architecture

```
src/lib/tmdb.ts               discoverTitles(mediaType, kind, id, page, sortBy)
                              kind: 'genre' → with_genres
                                    'network' → with_networks
                                    'company' → with_companies
src/lib/queries/discover.ts   useDiscoverTitles(mediaType, kind, id, sortBy)
                              key: ['tmdb', 'discover', mediaType, kind, id, sortBy]
src/components/browse/
  CollectionBrowser.tsx       Header (back + logo/title) + grid + sticky sort bar + sheet
src/components/detail/
  TappableLogoPills.tsx       Wrap-row of logo pills w/ haptic + fallback chips
app/discover/genre.tsx        thin route → CollectionBrowser kind="genre"
app/discover/network.tsx      thin route → CollectionBrowser kind="network" (tv)
app/discover/company.tsx      thin route → CollectionBrowser kind="company" (movie default)
src/components/discover/
  BrowseSortSheet.tsx         generalized GenreSortSheet (options passed in)
```

## Data layer

- `discoverTitles` replaces `discoverByGenre`; maps `kind` to the discover query param. Sort values unchanged (`popularity.desc`, `vote_average.desc`, `first_air_date.desc`/`primary_release_date.desc`, `original_title.asc`, `vote_count.desc`). Top Rated keeps no `vote_count.gte` floor (matches current genre behavior).
- Query: infinite, staleTime 10m / gcTime 30m (same as today). `sortBy` lives in the key → switching sorts refetches cleanly.
- Types:
  - `TMDbMovieDetails` gains `production_companies?: Array<{ id, name, logo_path }>` (TMDb always returns it).
  - `EpisodeCardData` gains `networkId?: number | null` alongside `network`.
  - `TMDbShowDetails.networks` already has `{ id, name, logo_path, origin_country }`.

## Routes & navigation pushes

| From | Push |
|---|---|
| Show detail network pill | `/discover/network?id&name&logo&type=tv` |
| EpisodeCard upcoming network | same |
| Movie detail studio pill | `/discover/company?id&name&logo&type=movie` |

Params are strings; `logo` = encodeURIComponent'd TMDb logo path (optional). Both new routes registered in `app/_layout.tsx` stack with `slide_from_right`.

## CollectionBrowser UI (extracted from current genre page)

- **Header**: back chevron (haptic Light) + brand logo image (`w154`, contain, height 24) when `logoPath` exists, else bold title text. Custom header, `headerShown: false`.
- **Grid**: 2-col FlashList v2 poster cards (exact geometry preserved from genre page): tap = Light haptic + `prefetchTitleDetails` + push to show/movie detail.
- **Sticky bottom bar**: sort pill (opens sheet, Light haptic) + "{n} titles" count.
- **Sheet**: `BrowseSortSheet` — same Spotify-style options list, active checkmark, Light haptics.
- States: invalid id → error card; loading spinner; ErrorState retry; empty message per kind ("No titles found for this network", etc.).

## TappableLogoPills component

Props: `items: {id, name, logo_path?}[]`, `onPress(item)`, `accessibilityLabelFor(item)`.

- Pill: dark container (`surfaceContainerHighest`), radius md, padding 8×10, expo-image logo contain height 18, memory-disk cache.
- Fallback (no `logo_path`): text chip styled like existing genre chips (`secondaryContainer`, labelSm semibold).
- Pressed: opacity 0.6. Press: `Haptics.impactAsync(ImpactFeedbackStyle.Light)` then `onPress`.

## Integration points

1. **`app/show/[id].tsx` (~963)** — "Network" details row: comma-joined text → `TappableLogoPills` over `tmdbDetails.networks`.
2. **`app/movie/[id].tsx` (~477)** — new "Studios" details row: `TappableLogoPills` over `tmdbDetails.production_companies`. Grid condition updated to include companies.
3. **`EpisodeCard.tsx` (~357)** — upcoming-card network text becomes a small Pressable (only when `networkId` present) → network page, Light haptic.
4. **`upcoming.ts`** — passes `networkId: details.networks?.[0]?.id ?? null`.

## Out of scope

Watch providers, region settings, hero redesigns, company pages for TV (route supports `type` param for future).

## Verification

`npm run typecheck` after each step; manual: sort switch on all pages, nav from show/movie/episode cards, haptics, empty/error states, logo-less pills fall back to text.
