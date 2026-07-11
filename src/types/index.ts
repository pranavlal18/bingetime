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
  archived: boolean
  episodes_seen: number
  last_watched_episode_data: {
    episode_id?: string
    season_number?: number
    episode_number?: number
    watched_at?: string
    updated_at?: string
  } | null
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
}

// ── Lists ──
export interface List {
  id: string
  name: string
  description: string | null
  item_ids: string[]
}

// ── Import ──
export interface CSVImportProgress {
  step: string
  current: number
  total: number
  status: 'pending' | 'processing' | 'done' | 'error'
  error?: string
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
  overview: string | null
  status: string
  first_air_date: string | null
  last_air_date: string | null
  number_of_episodes: number
  seasons: Array<{
    id: number
    season_number: number
    episode_count: number
    air_date: string | null
  }>
}

// ── CSV Row Types (raw from export) ──
export interface FollowedTvShowRow {
  tv_show_id: string
  tv_show_name: string
  archived: string
  active: string
  created_at: string
  updated_at: string
}

export interface UserTvShowDataRow {
  tv_show_id: string
  tv_show_name: string
  is_favorited: string
  nb_episodes_seen: string
  is_followed: string
}

export interface TrackingRecordV2Row {
  s_id: string
  series_name: string
  season_number: string
  episode_number: string
  rewatch_count: string
  created_at: string
  // tracking-stats rows have different shape
  runtime?: string
  movie_watch_count?: string
  ep_watch_count?: string
  total_movies_runtime?: string
  total_series_runtime?: string
}

export interface ShowSeenEpisodeLatestRow {
  tv_show_id: string
  tv_show_name: string
  episode_id: string
  updated_at: string
  created_at: string
}

export interface UserShowSpecialStatusRow {
  tv_show_id: string
  tv_show_name: string
  status: string
}

export interface TrackingProdRecordRow {
  type: string
  movie_name?: string
  series_name?: string
  runtime?: string
  release_date?: string
  watches?: string
  // Many columns, we only need movie-related ones
}

export interface ListsProdListRow {
  name: string
  objects: string
  description: string
}

// ── App Settings ──
export type ViewMode = 'poster-grid' | 'thumbnail-list'
export type Theme = 'system' | 'light' | 'dark'

export interface AppSettings {
  viewMode: ViewMode
  theme: Theme
  showArchived: boolean
}
