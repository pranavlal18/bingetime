# Cast Row & Known For Typography Refinement

**Date:** 2026-08-23
**Status:** Approved
**Refines:** detail-tabs-cast (CastRow) + person-page (Known For) specs. UI-only.

## Principle

IMAGE SIZE → FIXED · CARD WIDTH → FIXED · TITLE → CONSTRAINED · YEAR → FIXED SECONDARY LINE.
Text length never determines card dimensions. Visual rhythm over complete text.

## 1. CastRow (`src/components/detail/CastRow.tsx`)

| Element | Change |
|---|---|
| Member width | 72 → **96** |
| Name | 14px (`bodySm`) / weight 600 / `lineHeight: 20` / `height: 20` fixed / 1 line ellipsis |
| Character | 12px (`labelSm`) / weight 400 / muted `onSurfaceVariant` / `lineHeight: 16` / `height: 16` fixed / 1 line ellipsis / **always rendered** (empty string when absent) so every card aligns |
| Skeleton | two lines matching text structure (h20 + h16) |
| Scroller | edge-to-edge bleed: `marginHorizontal: -spacing.marginMobile` on the ScrollView (ancestor `contentBody` pads), `paddingHorizontal: spacing.marginMobile` in `contentContainerStyle` |

**Overflow constraint:** verified no `overflow: 'hidden'` ancestor wraps the scrollers (show-page hits are backdrop/posterOverlay/progressTrack/episodesList branches — none are ancestors; movie + person pages have none). Negative margin applied only where an ancestor pads.

## 2. Person page header + Biography

No changes — already compliant (portrait-card hierarchy, subtle pill, wrapping metadata constrained by flex:1; 5-line collapse, plain-text Read more).

## 3. Known For (`app/person/[id].tsx`)

| Element | Change |
|---|---|
| Card | poster controls width: **108 × 162** (2:3) |
| Title | 14px (`bodySm`) / weight 500 / `numberOfLines: 2` / **fixed `height: 40`** (2×lineHeight 20) so years align across cards |
| Year | 12px (`labelSm`) / weight 400 / muted / `height: 16` fixed / **always rendered** (`year ?? ''`) |
| Row clipping | section loses horizontal padding; `knownForHeader` gains its own `paddingHorizontal`; scroller gets internal `paddingHorizontal: spacing.marginMobile`, spanning full width so partial next card clips at true screen edge (no ancestor pads here → no negative margin needed) |

## Untouched
Data fetching, navigation, API model, theme/colors, image styling/caching, See All placement, biography logic, DetailTabs.

## Verification

`tsc --noEmit`; manual: long-character truncation ("Prince Daemon Targaryen…"), 2-line title clamp ("The Amazing Spider-Man…"), aligned years, clean initial scroll (first card flush at margin, no left sliver), partial card affordance at right edge while scrolling.
