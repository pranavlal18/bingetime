# Person Page (Tappable Cast) Design

**Date:** 2026-08-23
**Status:** Approved
**Depends on:** Detail tabs + cast row feature (2026-08-23-detail-tabs-cast-design.md)

## Problem

Cast rows on show/movie detail pages are display-only. Users want to tap an actor and see who they are — photo, bio, birth info, and their other work — like TV Time/IMDb-lite person pages.

## Requirements

1. **Tap target:** Every avatar in `CastRow` becomes tappable → `/person/{tmdb_person_id}`, light haptic on press, subtle pressed-opacity feedback. Applies automatically to both show and movie pages.
2. **Person page** (`app/person/[id].tsx`, portrait-card style):
   - Floating back button (same pattern as movie page)
   - Portrait card: ~120×180 rounded image (`w342`), initial-letter fallback
   - Name + `known_for_department` pill (e.g., "Acting")
   - Birth line: "Mar 7, 1956 · Hollywood, CA"; if `deathday` present, show lifespan "1956–2020"
3. **Biography:** collapsed to 5 lines with "Read more" / "Show less" inline toggle; hidden entirely when empty.
4. **Known For row:** horizontal poster cards — `combined_credits` cast ∪ crew deduped by id (cast entry preferred over crew), requiring `poster_path`, sorted by `popularity` desc, top 8. Card = `w185` poster + title + year. Tap → `/show/{id}` (media_type tv) or `/movie/{id}` (movie) — both screens already accept numeric TMDb IDs.
5. **See All credits screen** (`app/person/[id]/credits.tsx`): opened via "See All" control beside the Known For label. Lists ALL deduped credits (cast ∪ crew) as rows: poster thumb, title, year, character (cast) or job (crew). Segmented filter: All | Movies | TV. Reads from the same cached query — zero additional TMDb requests.
6. **Graceful degradation:** no bio → hide biography section; no poster credits → hide Known For row + See All; missing birthday/place → omit that fragment; fetch failure → existing error-screen pattern (icon + message + Go back).
7. No schema changes, no new dependencies.

## Non-goals

- External links (IMDb/Twitter)
- Crew-only deep dives (awards, full crew filmography breakdowns)
- Episode-level guest appearances

## Architecture

**Data (single request):**
```ts
// tmdb.ts
getPersonDetails(tmdbId) // GET /person/{id}?append_to_response=combined_credits
// Types: TMDbPersonDetails (name, biography, birthday, deathday, place_of_birth,
//        known_for_department, profile_path, combined_credits)
//        TMDbCombinedCredit { id, media_type, title?, name?, release_date?,
//          first_air_date?, character?, job?, department?, poster_path?, popularity }
```

**Query:** `src/lib/queries/people.ts`
- `usePerson(personId)` — key `['person', personId]`, `enabled: !!personId`, staleTime 24h, gcTime 14d (people data is near-static)
- Pure exported helpers used by both screens: `dedupeCredits(person)` (cast ∪ crew, cast preferred, id-deduped), `topKnownFor(person, n=8)` (dedupe → poster filter → popularity sort)

**Screens:**
- `app/person/[id].tsx` — hero-less scroll: back button overlay, portrait card header, biography, Known For row ("See All" beside label)
- `app/person/[id]/credits.tsx` — segmented filter + FlatList of credit rows; reads the SAME `usePerson(id)` cache (instant render after first visit)

**Edit:** `src/components/detail/CastRow.tsx` — wrap avatar block in `Pressable` + `router.push` + haptic.

## Error handling

- Invalid/failing person ID → existing error pattern; See All screen shows empty-state text if credits array empty.
- All degradation rules from Requirement 6.

## Verification

- `npx tsc --noEmit`
- Manual: tap cast member from a show AND a movie → person page renders; Read more toggles; Known For card navigates to correct show/movie page; See All opens instantly (cached) and filters work; untracked titles open via TMDb fallback.
