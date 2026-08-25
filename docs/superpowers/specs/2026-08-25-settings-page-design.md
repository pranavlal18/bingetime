# Settings Page — Design

**Date:** 2026-08-25
**Status:** Approved (user, in conversation)

## Goal

Dedicated Settings page (`/profile/settings`) reached from a gear icon at the top-right of the Profile user header, replacing the inline settings card at the bottom of Profile. Central home for all current + future customization.

## Page contents (one rounded card, four groups)

| Group | Rows |
|---|---|
| **Appearance** | Theme (swatches + collapsible picker, moved) · Shows view (Grid/List toggle → `setShowsViewMode`) · Movies view (→ `setMoviesViewMode`) |
| **Notifications** | Switch moved as-is: mount-time OS permission sync; enable → `requestNotificationPermissions()`; disable → `cancelAllReminders()` |
| **Haptics** | New switch, default ON |
| **Account** | Name (inline editor: custom name or email-prefix fallback; empty input resets) · Sign out (moved, unchanged) |

## State

- `appStore` additions (persisted MMKV, no migration needed): `hapticsEnabled: boolean = true`, `displayName: string | null = null`
- View modes reuse existing `showsViewMode` / `moviesViewMode` — page icons and Settings bind to the same fields (single source of truth)
- Display name is LOCAL ONLY (user decision): profile header shows `displayName || email.split('@')[0]`; avatar initials prefer it too

## Haptics kill-switch

- New `src/utils/haptics.ts`: `hapticLight()` / `hapticSuccess()` gate via `useAppStore.getState().hapticsEnabled` (works outside React)
- All ~32 direct `expo-haptics` call sites across 24 files replaced with the wrapper; unused imports removed
- Default ON → zero behavior change until disabled

## Profile tab changes

- Gear button (`settings-outline`, 24px) at right edge of user-header row → Light haptic → `/profile/settings`
- Bottom settings card + its loading-skeleton mirror deleted; dead code removed (theme picker state/UI, notification util imports/effects, local `SettingsRow`/`SettingsToggle`/`ThemeSwatchPreview` move into the settings page file)

## Route

`app/profile/settings.tsx`, registered in root `_layout.tsx` with `animation: 'slide_from_right'`. Header copied from `app/profile/stats.tsx` pattern (back chevron + title, safe-area padding).

## Out of scope (queued candidates)

Notification lead time, upcoming window, auto-advance, clear cache/searches, TMDb attribution card, export library, change password, delete account, stats-period row.

## Verification

`npm run typecheck` per step; manual: every control functions, page view-mode icons ↔ Settings stay in sync, haptics OFF silences all feedback globally, rename persists across restart and clears back to email prefix.
