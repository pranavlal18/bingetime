# BingeTime

Expo SDK 57 / Expo Router (file-based) / TypeScript ~6.0
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

No lint or test scripts are configured. `npm run typecheck` runs `tsc --noEmit` — run it after every change.

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
| `src/stores/` | Zustand (viewMode, theme, recent searches) |
| `src/types/` | All TS interfaces |
| `src/components/` | ShowCard, MovieCard, ShowListItem, etc. |
| `src/utils/` | formatRuntime, formatDate, calcProgress, getYear |
| `supabase/migrations/` | SQL migrations, numbered — apply in order (latest: `00014`) |

## Gotchas

- **Babel**: `react-native-reanimated/plugin` must be **last** in `plugins` array.
- **Supabase join pattern**: list queries project explicit columns with `!inner` user joins + DB-side filters (e.g. `.eq('user_shows.user_id', id).eq('user_shows.is_watchlist', true)`); avoid `select('*')`. Query keys live in `src/lib/queries/keys.ts`.
- **React Query caching**: default `staleTime` 5m / `gcTime` 24h / `retry` 2. Overrides: 2m shows, 5m movies, 10m trending + genre titles, 1h TMDb details (prefetch matches), 24h people/credits/upcoming with `gcTime` 14d. Persisted cache `maxAge` 7d (`app/_layout.tsx`).
- **Zustand selectors** are used inside list items (not React Context) for granular re-renders.
- **Auth**: Supabase email/password via `src/contexts/AuthContext.tsx`; single account on one device. Auth redirects are declarative (`app/index.tsx` + `_layout.tsx` guards).
- **Dark-first palette**: all tokens in `src/theme.ts` (`surface #15121b`, `primary #d0bcff`); themes in `src/themes/`. Styling is plain `StyleSheet.create` — no Tailwind.

## Skills

Load these when working in their domain:

- `vercel-react-native-skills` — RN component performance, lists, animations, images, navigation, styling
- `supabase-postgres-best-practices` — SQL queries, indexes, schema design, migrations
- `ui-ux-pro-max` — color palettes, typography, UX guidelines, chart types, design patterns
- `frontend-design` — distinctive visual identity, creative direction, avoiding template looks
