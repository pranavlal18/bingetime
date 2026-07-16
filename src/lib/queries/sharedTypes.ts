// ─── Shared Type Definitions for Queries ───

/** Core show type from database */
export interface Show {
  id: string
  tmdb_id: number | null
  tvdb_id: number
  name: string
  status: string | null
  poster_path: string | null
  total_episodes: number | null
  last_air_date: string | null
  average_runtime: number | null // in seconds
}

/** User-specific show tracking data */
export interface UserShow {
  episodes_seen: number
  is_favorited: boolean
  is_following: boolean
  is_watchlist: boolean
  last_watched_episode_data: {
    episode_id?: string
    season_number: number
    episode_number: number
    watched_at: string
    updated_at: string
  } | null
  favorited_at: string | null
}

/** Show with user-specific data joined */
export interface ShowWithUserData extends Show {
  episodes_seen: number
  is_following: boolean
  is_favorited: boolean
  is_watchlist: boolean
  last_watched_episode_data: UserShow['last_watched_episode_data']
  created_at: string | null
  next_air_episode: NextAirEpisode | null
}

/** Next episode to air info from TMDb */
export interface NextAirEpisode {
  season_number: number
  episode_number: number
  name: string | null
  air_date: string
}

/** Query key factories — shared to avoid circular imports */
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

export const profileKeys = {
  stats: (userId: string) => ['profile', 'stats', userId] as const,
  favorites: (userId: string) => ['profile', 'favorites', userId] as const,
  watchlist: (userId: string) => ['profile', 'watchlist', userId] as const,
  lists: (userId: string) => ['profile', 'lists', userId] as const,
}