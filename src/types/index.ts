// ─── BingeTime Type Definitions ───

// ── Shows ──
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
  genres: string[] | null // Add genres here
}

export interface Season {
  id: string
  show_id: string
  season_number: number
  episode_count: number
}

export interface Episode {
  id: string
  show_id: string
  season_number: number
  episode_number: number
  air_date: string | null
  name: string | null
  still_path: string | null
}

// ── User Data ──
export interface UserShow {
  show_id: string
  is_following: boolean
  is_favorited: boolean
  is_watchlist: boolean
  episodes_seen: number
  last_watched_episode_data: {
    episode_id?: string
    season_number?: number
    episode_number?: number
    watched_at?: string
    updated_at?: string
  } | null
  created_at?: string
  favorited_at: string | null // Add favorited_at
}

export interface ShowWithUserData extends Show {
  episodes_seen: number
  is_following: boolean
  is_favorited: boolean
  is_watchlist: boolean
  last_watched_episode_data: UserShow['last_watched_episode_data']
  created_at: string | null
  next_air_episode: NextAirEpisode | null
}

export interface NextAirEpisode {
  season_number: number
  episode_number: number
  name: string | null
  air_date: string
}

export interface UserEpisode {
  id?: string
  show_id?: string
  season_number: number
  episode_number: number
  watched: boolean
  watched_at: string | null
}

// ── Movies ──
export interface Movie {
  id: string
  tmdb_id: number | null
  title: string
  release_date: string | null
  runtime: number | null
  poster_path: string | null
  genres: string[] | null
}

export interface UserMovie {
  movie_id: string
  watched: boolean
  watched_at: string | null
  is_watchlist: boolean
  is_favorited: boolean
}

// ── Lists ──
export interface List {
  id: string
  name: string
  description: string | null
  item_ids: string[]
}

// ── TMDb API Responses ──
export interface TMDbFindResponse {
  tv_results: Array<{
    id: number
    name: string
    poster_path: string | null
    overview: string | null
    first_air_date: string | null
  }>
  movie_results: Array<{
    id: number
    title: string
    poster_path: string | null
    overview: string | null
    release_date: string | null
  }>
}

export interface TMDbSearchResponse {
  results: Array<{
    id: number
    title?: string
    name?: string
    poster_path: string | null
    release_date?: string
    first_air_date?: string
    overview: string | null
    media_type?: 'tv' | 'movie'
    genre_ids?: number[]
  }>
}

export interface TMDbExternalIds {
  tvdb_id?: number
  imdb_id?: string
}

export interface TMDbMovieDetails {
  id: number
  title: string
  poster_path: string | null
  backdrop_path: string | null
  overview: string | null
  release_date: string | null
  runtime: number | null
  genres?: Array<{ id: number; name: string }>
}

export interface TMDbSeasonDetails {
  id: number
  season_number: number
  name: string
  overview: string | null
  poster_path: string | null
  air_date: string | null
  episodes: Array<{
    id: number
    episode_number: number
    name: string
    overview: string | null
    air_date: string | null
    still_path: string | null
    vote_average: number
  }>
}

export interface TMDbShowDetails {
  id: number
  name: string
  poster_path: string | null
  backdrop_path: string | null
  overview: string | null
  status: string
  first_air_date: string | null
  last_air_date: string | null
  number_of_episodes: number
  number_of_seasons: number
  episode_run_time: number[] | null
  genres?: Array<{ id: number; name: string }>
  seasons: Array<{
    id: number
    season_number: number
    episode_count: number
    air_date: string | null
  }>
  networks?: Array<{
    id: number
    name: string
    logo_path: string | null
    origin_country: string
  }>
  next_episode_to_air?: {
    id: number
    name: string
    overview: string | null
    air_date: string | null
    episode_number: number
    season_number: number
    still_path: string | null
    vote_average: number
  } | null
  last_episode_to_air?: {
    id: number
    name: string
    overview: string | null
    air_date: string | null
    episode_number: number
    season_number: number
    still_path: string | null
    vote_average: number
  } | null
}

// ── App Settings ──
export type ViewMode = 'poster-grid' | 'thumbnail-list'

/** Available theme keys — add new themes here and in src/themes/index.ts */
export type ThemeKey =
  | 'cinematic-dark'
  | 'midnight-blue'
  | 'forest'
  | 'amber-glow'
  | 'neon-cyber'
  | 'luminescent'

/** Legacy theme type kept for backward compat; maps to ThemeKey now */
export type Theme = ThemeKey

export interface AppSettings {
  showsViewMode: ViewMode
  moviesViewMode: ViewMode
  theme: ThemeKey
  notificationsEnabled: boolean
}

// ── Query key factories ──
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

export interface EpisodeCardData {
  // Show info
  showId: string
  showName: string
  posterPath: string | null
  // Episode info
  seasonNumber: number
  episodeNumber: number
  episodeName: string | null
  airDate?: string | null // Added
  totalEpisodes: number | null
  // Remaining episodes (for watch-next / haven-watched badges)
  episodesRemaining: number | null
  // Watch status
  isWatched: boolean
  watchedAt?: string
  // Badges
  isPremiere?: boolean
  isFinale?: boolean
  // Upcoming-only fields
  airTime?: string | null
  network?: string | null
  // Tracking
  showStatus?: string | null
}

export type EpisodeSectionKind = 'watched-history' | 'watch-next' | 'haven-watched' | 'upcoming' | 'finished' | 'up-to-date' | 'not-started'

export interface EpisodeSection {
  kind: EpisodeSectionKind
  title: string
  episodes: EpisodeCardData[]
}

export type ShowsTabKind = 'watchlist' | 'upcoming'

export type ShowsListItem =
  | { type: 'section-header'; kind: EpisodeSectionKind; title: string }
  | { type: 'episode'; data: EpisodeCardData; sectionKind: EpisodeSectionKind }
  | { type: 'more'; kind: EpisodeSectionKind; remaining: number }
  | { type: 'skeleton'; kind: EpisodeSectionKind }
