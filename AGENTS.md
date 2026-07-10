# BingeTime

Expo SDK 57 / Expo Router (file-based) / TypeScript ~6.0
NativeWind v4 (`className`, `darkMode: 'class'`)
Zustand v5 (persisted: `bingetime-settings`) + TanStack React Query v5
Supabase + TMDb API
FlashList / expo-image / reanimated 4.5 / gesture-handler

## Commands

```
npm start          # dev server
npm run android    # dev on Android
npm run ios        # dev on iOS
npm run web        # dev in browser
```

No lint, typecheck, or test scripts are configured.

## Environment (`.env`, gitignored)

```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_TMDB_API_KEY=
```

All vars use `EXPO_PUBLIC_*` prefix (Expo convention for client-side env vars).

## Key paths

| Path | Purpose |
|---|---|
| `app/` | Expo Router screens (file-based routing) |
| `app/_layout.tsx` | Root stack + QueryClientProvider + GestureHandlerRootView |
| `app/(tabs)/` | Tab navigator (Shows, Movies, Discover, Profile) |
| `src/lib/queries/` | React Query hooks per domain (shows, movies, episodes, profile, discover) |
| `src/lib/import/` | TV Time CSV → Supabase pipeline (one-time onboarding) |
| `src/stores/` | Zustand (viewMode, theme, import state) |
| `src/types/` | All TS interfaces |
| `src/components/` | ShowCard, MovieCard, ShowListItem, etc. |
| `src/utils/` | formatRuntime, formatDate, calcProgress, getYear |
| `supabase/migrations/` | 2 SQL migrations (7 tables) |
| `assets/csv/` | Bundled TV Time GDPR export CSVs |

## Gotchas

- **Metro**: `metro.config.js` pushes `'csv'` to `assetExts` — required for bundled CSV imports.
- **Babel**: `react-native-reanimated/plugin` must be **last** in `plugins` array.
- **TV Time import**: TVDB IDs (`tv_show_id`) resolve to TMDb via `/find/{tvdb_id}?external_source=tvdb_id`. Never call TheTVDB API directly (now paid).
- **Movie data only in v1 CSV**: `tracking-prod-records.csv` (v1) is the sole source of movie watch data. Do not treat it as superseded — `tracking-prod-records-v2.csv` has zero movie rows.
- **Supabase join pattern**: All queries use `'*, user_shows(*)'` (or `user_movies(*)`).
- **React Query `staleTime`**: 2m shows, 5m movies, 10m trending, 1h TMDb details. `gcTime`: 30m. `retry`: 2.
- **Zustand selectors** are used inside list items (not React Context) for granular re-renders.
- **Single-user**: No auth implemented. One device/user.
- **Dark-first palette**: `surface (#1a1a2e)`, `accent (#e94560)`, `muted (#6b7280)` in `tailwind.config.js`.

## Skills

Load these when working in their domain:

- `vercel-react-native-skills` — RN component performance, lists, animations, images, navigation, styling
- `supabase-postgres-best-practices` — SQL queries, indexes, schema design, migrations
- `ui-ux-pro-max` — color palettes, typography, UX guidelines, chart types, design patterns
- `frontend-design` — distinctive visual identity, creative direction, avoiding template looks
