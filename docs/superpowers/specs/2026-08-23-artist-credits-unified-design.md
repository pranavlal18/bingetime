# Artist + All Credits — Unified Small Posters (B) — Design Spec

**Date:** 2026-08-23
**Pick:** Option B — Small & similar, balanced (76–80px posters, 4-col grid)
**Supercedes:** 2026-08-23-person-page-design.md Known For 92px / 5-col 62px budget

---

## 1. Goals

*   Both pages feel like one system: same poster card family, same gaps, same radius/type.
*   Posters small enough to feel structured and browseable, but still legible for 2-line titles.
*   More structure via contained Bio card, header count pill, and tidy filter/sort chip rows.
*   Keep the proven functional contract (one request, dedupe, appearance filter, tappable everywhere).

## 2. Locked Pixel Budget

| Element | Spec | 390dp phone | 360dp phone |
|---|---|---|---|
| Header portrait | 112 × 168, radius 16, w342 image | fixed | fixed |
| Known For card | **width 76**, poster 76 × 114 (2:3), radius 9–10 | 76px; ~4.2 cards visible + peeking |
| Credits grid | **4 columns**, gap **10**, content padding **20** | cell = (390−40−30)/4 = **80** | cell = (360−40−30)/4 = **72.5** |
| Gaps | Row/board gap 10, section gap 14–24 | — | — |
| Title (Known For) | 13/500 lh18 h36 (non-compact) | 2-line reserve | — |
| Title (grid) | 12/500 lh16 h32 (compact) | 2-line reserve | — |
| Meta lines | 12/400 lh16 h16, always-rendered, ellipsis | baseline alignment | — |

Anti-bloat carries over: poster `width:100% aspectRatio:2/3` only inside a fixed-width parent (`width={cardWidth}`), every text line fixed height, scrollers bleed via `style={{marginHorizontal:-20}}` + `content gap/padding 20`, no `overflow:'hidden'` ancestors on scroller/grid paths.

## 3. Artist Page `app/person/[id].tsx`

**Shell:** `Stack.Screen headerShown:false → ScrollView style flex:1 contentContainer paddingBottom insets.bottom+40`.

**Back overlay:** 44×44 circle `rgba(0,0,0,0.5)`, `top: insets.top+8, left:20, zIndex:10`, chevron-back in `primary`, `router.back()`.

**Header row:** `paddingHorizontal:20, paddingTop:insets.top+16, gap:14, marginBottom:24`
*   Portrait: `112×168 r:16 bg:surfaceContainerHighest`, `expo-image w342 memory-disk 150ms`, fallback initial letter.
*   Meta column `flex:1 gap:7`: name `headlineMd/700 onSurface` → department pill `labelSm/500 pill surfaceContainerHighest onSurfaceVariant` → birth line `13/400 onSurfaceVariant` (deathday `YYYY–YYYY` or `–YYYY`; else `YYYY · place`).

**Biography (hidden when empty):** wrapped **contained card** `bg:surfaceContainer, 1px outlineVariant, r:12, p:12`, header `Biography bodyLg/700 onSurface mb:10` inside card, body `bodyMd/400 onSurfaceVariant`, collapsed `numberOfLines={5}`, toggle `labelSm/600 primary mt:8` only when `bio.length>=200` (`Read more` ↔ `Show less`).

**Known For (only when `topKnownFor(person).length>0`):**
*   Wrapper has no horizontal padding; header row inside: `flex row space-between align:center mb:8 paddingHorizontal:20` with `Known For bodyLg/700 + count pill (labelSm/600 muted, surfaceContainerHighest pill, text: '${n}')` left, `See All labelMd/600 primary → /person/${id}/credits` right.
*   Horizontal `ScrollView style={{marginHorizontal:-20}} contentContainerStyle={{gap:10, paddingHorizontal:20}}` scrollbar hidden, cards `<CreditCard width={76} compact={false} year={year||null} ...>` routed by `media_type`. No `compact` here — keeps 13px title family.

**States:** `isLoading → spinner`; `error || (!person && !isLoading) → alert-circle + Go back`; `!person → null`. Styles `useMemo([colors, insets.top])`.

## 4. All Credits `app/person/[id]/credits.tsx`

**Shell:** `flex:1 bg:surface paddingTop:insets.top`.

**Header bar:** `row gap:8 paddingHorizontal:20 paddingBottom:12`, back `36×36 chevron primary marginLeft:-8`, title `All Credits headlineSm/700 onSurface`.

**Filter pill track:** `row marginHorizontal:20 marginBottom:8 p:3 r:full bg:surfaceContainerHighest` with `All/Movies/TV` segments `flex:1 pV:7 r:full` active `bg:primary text:onPrimary`.

**Sort chips:** `flex row gap:8 marginHorizontal:20 marginBottom:14` with `Newest/Oldest/Popular/A–Z` chips `ph:14 pV:6 r:full border 1 outlineVariant bg:surfaceContainerHighest` active `primary`.

**Grid:** `FlatList numColumns={4} style flex:1 contentContainer paddingHorizontal:20 paddingBottom:40 columnWrapperStyle justifyContent:flex-start gap:10 marginBottom:14`. Cell width computed `cellWidth=(windowWidth−40−30)/4` via `useWindowDimensions` → `<CreditCard width={cellWidth} compact roleLabel={character||job||''} year={year||null}>` zero extra fetches. Sort/filter logic identical to proven version (date-string compare with title tiebreak on all four sorts).

**Empty/loading/error:** invalid id → alert+Go back; `isLoading||!person → spinner`; empty filter → `No credits found` centered.

## 5. CreditCard `src/components/detail/CreditCard.tsx` (unified family)

```ts
interface CreditCardProps {
  posterPath: string | null
  title: string
  year?: string | null        // always '' when absent so rows baseline
  roleLabel?: string | null   // third line only when prop provided
  width: number               // fixed px — 76 scroller, ~80/72.5 grid cell
  compact?: boolean           // false Known For (13/h36), true grid (12/h32)
  onPress: () => void
}
```

*   Root `Pressable` style `[card.gap4, {width}, pressed?opacity0.6]`.
*   Poster fills width `width:100% aspectRatio:2/3 r:16 bg:surfaceContainerHighest`, `expo-image w185 memory-disk 150ms` or `View` fallback with `film-outline 24 outlineVariant`.
*   Titles constrained `numberOfLines={2} ellipsize tail` inside poster-width box; meta `numberOfLines={1}` `12/400 h16`.
*   Bounded-parent rule enforced — no bare `aspectRatio` on unbounded node; gap 4 between poster and text never changes card height.

## 6. Data & Navigation

*   One request: `getPersonDetails(id)` → `/person/{id}?append_to_response=combined_credits`, key `['person', id]` `staleTime 24h`.
*   Helpers: `dedupeCredits(person)` cast∪crew map-cast-wins, `isSelfAppearance` `/^\s*(self|guest|host…)/i` on `character`, `topKnownFor(person, 8)` filter `poster+popularity+!self` sorted by `popularity`.
*   Routes: Known For cards → `/show/{id}` for tv else `/movie/{id}`; grid cells same; **CastRow** member Pressable → `/person/{id}` (haptic light, pressed opacity, a11y `${name} — ${character}`).

## 7. Validation Gates

*   `npx tsc --noEmit` clean (all files); `overflow:'hidden'` audit on scroller/grid ancestor chains.
*   **Measurement gate:** dev `onLayout` logs — scroller card **76** and grid cell **(W−70)/4** (80@390 / 72.5@360).
*   Manual: Bio toggle appears only ≥200 chars, empty Known For hidden, All×Movies/TV × 4 sorts combos, bidirectional nav, back-stack, sparse last row stays small left-aligned.

---

## Build Steps (next skill: writing-plans)

0. Delete `app/person/[id].tsx` and `app/person/[id]/credits.tsx` to avoid bleed.
1. Update `CreditCard` sizing/comments if needed (API already supports fixed width).
2. Rebuild `app/person/[id].tsx` per §3 (112×168 portrait, Bio card, 76px scroller).
3. Rebuild `app/person/[id]/credits.tsx` per §4 (4-col, cellWidth, filter/sort).
4. Verify CastRow tap still wired (no change after §3–4 if intact).
5. `npx tsc --noEmit` + audit + device measurement gate.
