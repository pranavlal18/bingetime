// ─── Query key factories — single source of truth ───
//
// All React Query cache keys live here so invalidation scopes stay consistent
// across query files. Key string shapes are load-bearing: broad invalidations
// like invalidateQueries({ queryKey: ['movies'] }) match these prefixes.
// (statsKeys stays in stats.ts, upcomingKeys in upcoming.ts — each has a
// single definition and one consumer.)

export const showKeys = {
  all: ['shows'] as const,
  list: (userId: string) => ['shows', 'list', userId] as const,
  continueWatching: (userId: string) => ['shows', 'continue-watching', userId] as const,
  detail: (id: string) => ['shows', 'detail', id] as const,
}

export const episodeKeys = {
  all: ['episodes'] as const,
  season: (showId: string, tmdbId: number | null, seasonNumber: number, userId: string) =>
    ['episodes', 'season', showId, tmdbId, seasonNumber, userId] as const,
}

export const movieKeys = {
  all: ['movies'] as const,
  list: (userId: string) => ['movies', 'list', userId] as const,
  detail: (id: string) => ['movies', 'detail', id] as const,
  favorites: (userId: string) => ['movies', 'favorites', userId] as const,
  upcoming: (userId: string) => ['movies', 'upcoming', userId] as const,
}

export const profileKeys = {
  stats: (userId: string) => ['profile', 'stats', userId] as const,
  favorites: (userId: string) => ['profile', 'favorites', userId] as const,
  watchlist: (userId: string) => ['profile', 'watchlist', userId] as const,
}
