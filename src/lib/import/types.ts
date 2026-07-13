// ─── Import Pipeline Type Definitions ───

/** Progress state for each import step */
export interface ImportStep {
  id: string
  label: string
  status: 'pending' | 'processing' | 'done' | 'skipped' | 'error'
  current: number
  total: number
  error?: string
}

/** Overall import state */
export interface ImportState {
  started: boolean
  completed: boolean
  steps: ImportStep[]
  currentStepIndex: number
  startTime: number | null
  endTime: number | null
}

/** Context passed through the pipeline, holding parsed data and resolved IDs */
export interface ImportContext {
  // Parsed CSV data
  followedShows: FollowedTvShowRow[]
  userShowData: UserTvShowDataRow[]
  trackingV2Rows: TrackingV2Row[]
  seenEpisodeLatest: ShowSeenEpisodeLatestRow[]
  specialStatus: UserShowSpecialStatusRow[]
  movieRecords: TrackingProdRecordRow[]
  listRows: ListsProdListRow[]

  // Resolved IDs for shows (tvdb_id -> tmdb_id)
  showResolutionMap: Map<number, ShowResolution>

  // Resolved IDs for movies (title+year -> tmdb_id)
  movieResolutionMap: Map<string, MovieResolution>

  // Supabase UUIDs for shows (tvdb_id -> show_uuid)
  showUuidMap: Map<number, string>

  // Errors that didn't fail the step but should be logged
  warnings: string[]
}

export interface ShowResolution {
  tvdb_id: number
  tmdb_id: number
  name: string
  poster_path: string | null
  status: string | null
  total_episodes: number | null
  last_air_date: string | null
  seasons: Array<{
    season_number: number
    episode_count: number
  }>
}

export interface MovieResolution {
  title: string
  year: string | undefined
  tmdb_id: number
  poster_path: string | null
  release_date: string | null
}

// ── Raw CSV Row Types (matching actual CSV columns) ──

export interface FollowedTvShowRow {
  tv_show_id: string
  tv_show_name: string
  archived: string // '0' or '1'
  active: string // '0' or '1'
  created_at: string
  updated_at: string
}

export interface UserTvShowDataRow {
  tv_show_id: string
  tv_show_name: string
  is_favorited: string // '0' or '1'
  nb_episodes_seen: string
  is_followed: string // '0' or '1'
}

export interface TrackingV2Row {
  s_id: string // TVDB series ID
  key: string // unique row key (e.g. "tracking-stats", "user-series-...")
  ep_id: string // TV Time episode UUID
  ep_no: string // episode number
  s_no: string // season number
  rewatch_count: string
  created_at: string // watched_at
  season_number: string // duplicate season
  episode_number: string // duplicate episode
  series_name: string
  is_archived: string
  is_for_later: string
  most_recent_ep_watched: string
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
  type: string // 'watch', 'follow', 'towatch', 'rewatch', 'rewatch_count'
  entity_type: string // 'movie' or 'episode'
  movie_name?: string
  release_date?: string
  runtime?: string // in seconds
  created_at: string
  series_name?: string
}

export interface ListsProdListRow {
  name: string
  objects: string // serialized map format
  description: string
}
