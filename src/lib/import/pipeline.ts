// ─── Import Pipeline — orchestrates the full import from CSVs → Supabase ───

import { supabase } from '@/lib/supabase'
import { readAllCsvs, type AllCsvData } from './csvParser'
import { resolveShowsBatch, resolveMoviesBatch } from './tmdbResolver'
import type {
  ImportStep,
  ImportContext,
  ShowResolution,
  MovieResolution,
} from './types'
import type {
  FollowedTvShowRow,
  UserTvShowDataRow,
  TrackingV2Row,
  TrackingProdRecordRow,
} from './types'

// ── Step definitions ──

export const IMPORT_STEPS: ImportStep[] = [
  { id: 'read-csvs', label: 'Reading CSV files', status: 'pending', current: 0, total: 4 },
  { id: 'import-shows', label: 'Importing shows', status: 'pending', current: 0, total: 0 },
  { id: 'reconcile-usershows', label: 'Reconciling show data', status: 'pending', current: 0, total: 0 },
  { id: 'import-episodes', label: 'Importing episode watches', status: 'pending', current: 0, total: 0 },
  { id: 'import-movies', label: 'Importing movies', status: 'pending', current: 0, total: 0 },
  { id: 'resolve-tmdb', label: 'Resolving TMDb IDs', status: 'pending', current: 0, total: 0 },
]

// ── Progress callback type ──

export type ProgressCallback = (stepIndex: number, current: number, total: number, message?: string) => void

// ── Main pipeline ──

export async function runImport(
  userId: string,
  onProgress?: ProgressCallback,
  onStepStatus?: (stepIndex: number, status: ImportStep['status'], error?: string) => void,
  csvData?: AllCsvData
): Promise<{ success: boolean; warnings: string[]; error?: string }> {
  const context: ImportContext = {
    followedShows: [],
    userShowData: [],
    trackingV2Rows: [],
    movieRecords: [],
    showResolutionMap: new Map(),
    movieResolutionMap: new Map(),
    showUuidMap: new Map(),
    warnings: [],
  }

  try {
    // ── Step 0: Read all CSVs (skip if pre-parsed data was passed) ──
    if (csvData) {
      context.followedShows = csvData.followedShows
      context.userShowData = csvData.userShowData
      context.trackingV2Rows = csvData.trackingV2
      context.movieRecords = csvData.movieRecords

      onStepStatus?.(0, 'done')
    } else {
      onStepStatus?.(0, 'processing')
      onProgress?.(0, 0, 4, 'Reading CSV files from assets...')

      const bundledData: AllCsvData = await readAllCsvs()
      context.followedShows = bundledData.followedShows
      context.userShowData = bundledData.userShowData
      context.trackingV2Rows = bundledData.trackingV2
      context.movieRecords = bundledData.movieRecords

      onProgress?.(0, 4, 4, 'All CSVs read successfully')
      onStepStatus?.(0, 'done')
    }

    // ── Step 1: Import shows from followed_tv_show.csv ──
    onStepStatus?.(1, 'processing')
    onProgress?.(1, 0, context.followedShows.length, 'Importing shows...')

    const showInsertResults = await importShows(context.followedShows, userId, (count) => {
      onProgress?.(1, count, context.followedShows.length)
    })
    context.showUuidMap = showInsertResults.uuidMap
    context.warnings.push(...showInsertResults.warnings)

    onProgress?.(1, context.followedShows.length, context.followedShows.length, 'Shows imported')
    onStepStatus?.(1, 'done')

    // ── Step 2: Reconcile user_tv_show_data.csv ──
    onStepStatus?.(2, 'processing')
    onProgress?.(2, 0, context.userShowData.length, 'Reconciling user show data...')

    const reconcileResults = await reconcileShowData(
      context.userShowData,
      context.showUuidMap,
      userId,
      (count) => {
        onProgress?.(2, count, context.userShowData.length)
      }
    )
    // Merge any new shows from user data into the uuid map
    for (const [tvdbId, uuid] of reconcileResults.newUuids) {
      context.showUuidMap.set(tvdbId, uuid)
    }
    context.warnings.push(...reconcileResults.warnings)

    onProgress?.(2, context.userShowData.length, context.userShowData.length, 'Show data reconciled')
    onStepStatus?.(2, 'done')

    // ── Step 3: Import episode watches from tracking-prod-records-v2.csv ──
    onStepStatus?.(3, 'processing')
    const episodeRows = filterEpisodeWatches(context.trackingV2Rows)
    onProgress?.(3, 0, episodeRows.length, 'Importing episode watches...')

    const episodeResults = await importEpisodeWatches(
      episodeRows,
      context.showUuidMap,
      userId,
      (count) => {
        onProgress?.(3, count, episodeRows.length)
      }
    )
    context.warnings.push(...episodeResults.warnings)

    onProgress?.(3, episodeRows.length, episodeRows.length, 'Episode watches imported')
    onStepStatus?.(3, 'done')

    // ── Step 4: Import movies from tracking-prod-records.csv ──
    onStepStatus?.(4, 'processing')
    onProgress?.(4, 0, context.movieRecords.length, 'Importing movies...')

    const movieResults = await importMovies(context.movieRecords, userId, (count) => {
      onProgress?.(4, count, context.movieRecords.length)
    })
    context.warnings.push(...movieResults.warnings)

    onProgress?.(4, context.movieRecords.length, context.movieRecords.length, 'Movies imported')
    onStepStatus?.(4, 'done')

    // ── Step 5: Resolve TMDb IDs for shows ──
    onStepStatus?.(5, 'processing')

    // Get all unique tvdb_ids that need resolution
    const allTvdbIds = [...context.showUuidMap.keys()]
    onProgress?.(5, 0, allTvdbIds.length, 'Resolving TMDb IDs...')

    // Build tvdb_id -> name map for fallback search
    const tvdbIdToName = new Map<number, string>()
    for (const row of context.followedShows) {
      const id = parseInt(row.tv_show_id, 10)
      if (!isNaN(id)) tvdbIdToName.set(id, row.tv_show_name)
    }
    for (const row of context.userShowData) {
      const id = parseInt(row.tv_show_id, 10)
      if (!isNaN(id)) tvdbIdToName.set(id, row.tv_show_name)
    }

    const resolutionMap = await resolveShowsBatch(
      allTvdbIds,
      context.showResolutionMap,
      tvdbIdToName,
      (resolved, total) => {
        onProgress?.(5, resolved, total)
      }
    )
    context.showResolutionMap = resolutionMap

    // Add resolution stats to warnings
    const resolvedCount = resolutionMap.size
    const totalCount = allTvdbIds.length
    const failedCount = totalCount - resolvedCount
    if (failedCount > 0) {
      context.warnings.push(`TMDb show resolution: ${resolvedCount}/${totalCount} succeeded (${failedCount} failed)`)
    }

    // Update shows with TMDb data
    await updateShowsWithTmdbData(resolutionMap, context.showUuidMap)

    onProgress?.(5, allTvdbIds.length, allTvdbIds.length, 'TMDb IDs resolved')
    onStepStatus?.(5, 'done')

    return { success: true, warnings: context.warnings }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error during import'
    console.error('Import pipeline failed:', error)
    return { success: false, warnings: context.warnings, error: message }
  }
}

// ── Step implementations ──

async function importShows(
  rows: FollowedTvShowRow[],
  userId: string,
  onBatch: (count: number) => void
): Promise<{ uuidMap: Map<number, string>; warnings: string[] }> {
  const uuidMap = new Map<number, string>()
  const warnings: string[] = []
  const BATCH_SIZE = 100

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)

    const showInserts: Array<{ tvdb_id: number; name: string }> = []
    for (const row of batch) {
      const tvdbId = parseInt(row.tv_show_id, 10)
      if (isNaN(tvdbId)) {
        warnings.push(`Invalid tv_show_id: ${row.tv_show_id} (${row.tv_show_name})`)
        continue
      }
      showInserts.push({
        tvdb_id: tvdbId,
        name: row.tv_show_name,
      })
    }

    if (showInserts.length === 0) continue

    // Upsert shows — on conflict (tvdb_id), do nothing (keep existing)
    const { data, error } = await supabase
      .from('shows')
      .upsert(showInserts, { onConflict: 'tvdb_id', ignoreDuplicates: true })
      .select('id, tvdb_id')

    if (error) {
      throw new Error(`Failed to insert shows batch: ${error.message}`)
    }

    // Map returned UUIDs from the upsert
    if (data) {
      for (const row of data as Array<{ id: string; tvdb_id: number }>) {
        if (!uuidMap.has(row.tvdb_id)) {
          uuidMap.set(row.tvdb_id, row.id)
        }
      }
    }

    // For any show that wasn't in the upsert result (because it already existed),
    // fetch missing UUIDs in one batch query
    const missingTvdbIds = showInserts
      .map((s) => s.tvdb_id)
      .filter((id) => !uuidMap.has(id))

    if (missingTvdbIds.length > 0) {
      const { data: existingShows } = await supabase
        .from('shows')
        .select('id, tvdb_id')
        .in('tvdb_id', missingTvdbIds)

      if (existingShows) {
        for (const show of existingShows) {
          uuidMap.set(show.tvdb_id, show.id)
        }
      }
    }

    // Batch upsert user_shows entries with archive flag
    const userShowInserts = batch
      .map((row) => {
        const tvdbId = parseInt(row.tv_show_id, 10)
        const showUuid = uuidMap.get(tvdbId)
        if (!showUuid) {
          warnings.push(`No UUID found for show ${row.tv_show_name} (tvdb: ${tvdbId})`)
          return null
        }
        return {
          show_id: showUuid,
          user_id: userId,
          is_following: true,
          is_watchlist: true,
        }
      })
      .filter(Boolean) as Array<{ show_id: string; user_id: string; is_following: boolean; is_watchlist: boolean }>

    if (userShowInserts.length > 0) {
      const { error: usError } = await supabase
        .from('user_shows')
        .upsert(userShowInserts, { onConflict: 'show_id,user_id' })

      if (usError) {
        warnings.push(`Failed to batch upsert user_shows: ${usError.message}`)
      }
    }

    onBatch(Math.min(i + BATCH_SIZE, rows.length))
  }

  return { uuidMap, warnings }
}

async function reconcileShowData(
  rows: UserTvShowDataRow[],
  existingUuidMap: Map<number, string>,
  userId: string,
  onBatch: (count: number) => void
): Promise<{ newUuids: Map<number, string>; warnings: string[] }> {
  const newUuids = new Map<number, string>()
  const warnings: string[] = []
  const BATCH_SIZE = 100

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)

    // Phase 1: Upsert any new shows that aren't in existingUuidMap, in a batch
    const newShowInserts: Array<{ tvdb_id: number; name: string }> = []
    for (const row of batch) {
      const tvdbId = parseInt(row.tv_show_id, 10)
      if (isNaN(tvdbId)) continue
      if (!existingUuidMap.has(tvdbId) && !newUuids.has(tvdbId)) {
        newShowInserts.push({ tvdb_id: tvdbId, name: row.tv_show_name })
      }
    }

    if (newShowInserts.length > 0) {
      const { data: insertedShows, error: insertError } = await supabase
        .from('shows')
        .upsert(newShowInserts, { onConflict: 'tvdb_id', ignoreDuplicates: true })
        .select('id, tvdb_id')

      if (insertError) {
        warnings.push(`Failed to batch insert shows from user_data: ${insertError.message}`)
      } else if (insertedShows) {
        for (const show of insertedShows) {
          newUuids.set(show.tvdb_id, show.id)
        }
      }

      // Fetch UUIDs for any that weren't returned (already existed)
      const missingIds = newShowInserts
        .map((s) => s.tvdb_id)
        .filter((id) => !newUuids.has(id))
      if (missingIds.length > 0) {
        const { data: existingShows } = await supabase
          .from('shows')
          .select('id, tvdb_id')
          .in('tvdb_id', missingIds)
        if (existingShows) {
          for (const show of existingShows) {
            newUuids.set(show.tvdb_id, show.id)
          }
        }
      }
    }

    // Phase 2: Batch upsert user_shows entries
    const userShowInserts = batch
      .map((row) => {
        const tvdbId = parseInt(row.tv_show_id, 10)
        if (isNaN(tvdbId)) return null

        const showUuid = existingUuidMap.get(tvdbId) || newUuids.get(tvdbId)
        if (!showUuid) return null

        return {
          show_id: showUuid,
          user_id: userId,
          episodes_seen: parseInt(row.nb_episodes_seen, 10) || 0,
          is_favorited: row.is_favorited === '1',
          is_following: row.is_followed !== '0',
          is_watchlist: true,
        }
      })
      .filter(Boolean) as Array<{ show_id: string; user_id: string; episodes_seen: number; is_favorited: boolean; is_following: boolean; is_watchlist: boolean }>

    if (userShowInserts.length > 0) {
      const { error: usError } = await supabase
        .from('user_shows')
        .upsert(userShowInserts, { onConflict: 'show_id,user_id' })

      if (usError) {
        warnings.push(`Failed to batch upsert user_shows reconcile: ${usError.message}`)
      }
    }

    onBatch(Math.min(i + BATCH_SIZE, rows.length))
  }

  return { newUuids, warnings }
}

function filterEpisodeWatches(rows: TrackingV2Row[]): TrackingV2Row[] {
  // Filter to actual episode watch rows (have ep_id, not tracking-stats rows)
  return rows.filter((r) => {
    // Skip aggregate/tracking-stats rows (they have no ep_id or series_id)
    if (!r.s_id && r.key?.includes('tracking-stats')) return false
    // Must have a valid watched episode reference
    return r.ep_id || (r.ep_no && r.s_no)
  })
}

function extractWatchDate(row: TrackingV2Row): string | null {
  const mapStr = row.most_recent_ep_watched
  if (!mapStr) return null
  const match = mapStr.match(/watch_date:([\d.e\+]+)/)
  if (!match) return null
  const timestampMs = parseFloat(match[1])
  if (isNaN(timestampMs)) return null
  return new Date(timestampMs).toISOString()
}

async function importEpisodeWatches(
  rows: TrackingV2Row[],
  showUuidMap: Map<number, string>,
  userId: string,
  onBatch: (count: number) => void
): Promise<{ warnings: string[] }> {
  const warnings: string[] = []
  const BATCH_SIZE = 200

  // Deduplicate by (show_id, season_number, episode_number) keeping the latest
  const dedupMap = new Map<string, TrackingV2Row>()

  for (const row of rows) {
    const tvdbId = parseInt(row.s_id, 10)
    if (isNaN(tvdbId)) continue

    // Determine season and episode number
    const seasonNumber = parseInt(row.season_number || row.s_no, 10)
    const episodeNumber = parseInt(row.episode_number || row.ep_no, 10)
    if (isNaN(seasonNumber) || isNaN(episodeNumber)) continue

    const key = `${tvdbId}:${seasonNumber}:${episodeNumber}`

    // Keep the one with the latest timestamp (created_at)
    const existing = dedupMap.get(key)
    if (!existing || row.created_at > existing.created_at) {
      dedupMap.set(key, row)
    }
  }

  const uniqueRows = [...dedupMap.values()]

  for (let i = 0; i < uniqueRows.length; i += BATCH_SIZE) {
    const batch = uniqueRows.slice(i, i + BATCH_SIZE)

    // Build batch upsert array
    const episodeInserts = batch
      .map((row) => {
        const tvdbId = parseInt(row.s_id, 10)
        if (isNaN(tvdbId)) return null

        const showUuid = showUuidMap.get(tvdbId)
        if (!showUuid) {
          warnings.push(`No UUID for show tvdb_id ${tvdbId} (${row.series_name || 'unknown'}) — skipping episode`)
          return null
        }

        const seasonNumber = parseInt(row.season_number || row.s_no, 10)
        const episodeNumber = parseInt(row.episode_number || row.ep_no, 10)
        
        // Use extracted watch date if available, otherwise fallback to created_at
        const watchedAt = extractWatchDate(row) || row.created_at || null

        return {
          show_id: showUuid,
          user_id: userId,
          season_number: seasonNumber,
          episode_number: episodeNumber,
          watched: true,
          watched_at: watchedAt,
        }
      })
      .filter(Boolean) as Array<{
        show_id: string
        user_id: string
        season_number: number
        episode_number: number
        watched: boolean
        watched_at: string | null
      }>

    if (episodeInserts.length > 0) {
      const { error: epError } = await supabase
        .from('user_episodes')
        .upsert(episodeInserts, { onConflict: 'show_id, season_number, episode_number, user_id' })

      if (epError) {
        warnings.push(`Failed to batch upsert episodes: ${epError.message}`)
      }
    }

    onBatch(Math.min(i + BATCH_SIZE, uniqueRows.length))
  }

  return { warnings }
}

async function importMovies(
  rows: TrackingProdRecordRow[],
  userId: string,
  onBatch: (count: number) => void
): Promise<{ warnings: string[] }> {
  const warnings: string[] = []
  const BATCH_SIZE = 50

  // Group by movie title+year to deduplicate
  const movieMap = new Map<string, TrackingProdRecordRow>()

  for (const row of rows) {
    const title = row.movie_name?.trim()
    if (!title) continue

    const year = row.release_date ? row.release_date.substring(0, 4) : ''
    const key = `${title}|${year}`

    // Prefer 'watch' type over 'follow' / 'towatch' — keep the most significant record
    const existing = movieMap.get(key)
    if (!existing) {
      movieMap.set(key, row)
    } else {
      // If existing is 'follow' and new is 'watch', upgrade
      if (existing.type === 'follow' && (row.type === 'watch' || row.type === 'towatch')) {
        movieMap.set(key, row)
      }
    }
  }

  const uniqueMovies = [...movieMap.values()]

  // Accumulate all movie IDs across batches for TMDb resolution
  const allMovieIds = new Map<string, string>()

  for (let i = 0; i < uniqueMovies.length; i += BATCH_SIZE) {
    const batch = uniqueMovies.slice(i, i + BATCH_SIZE)

    // Phase 1: Batch upsert movies and collect returned IDs
    const movieInserts = batch.map((row) => ({
      title: row.movie_name?.trim() || '',
      release_date: row.release_date || null,
      runtime: row.runtime ? parseInt(row.runtime, 10) || null : null,
    }))

    const { data: insertedMovies, error: insertError } = await supabase
      .from('movies')
      .upsert(movieInserts, { onConflict: 'title', ignoreDuplicates: true })
      .select('id, title')

    if (insertError) {
      warnings.push(`Failed to batch insert movies: ${insertError.message}`)
      onBatch(Math.min(i + BATCH_SIZE, uniqueMovies.length))
      continue
    }

    // Build title → id map
    const movieIdMap = new Map<string, string>()
    if (insertedMovies) {
      for (const m of insertedMovies) {
        movieIdMap.set(m.title, m.id)
      }
    }

    // Fetch IDs for movies that weren't returned (already existed)
    const missingTitles = movieInserts
      .map((m) => m.title)
      .filter((t) => !movieIdMap.has(t))
    if (missingTitles.length > 0) {
      const { data: existingMovies } = await supabase
        .from('movies')
        .select('id, title')
        .in('title', missingTitles)
      if (existingMovies) {
        for (const m of existingMovies) {
          movieIdMap.set(m.title, m.id)
        }
      }
    }

    // Phase 2: Batch upsert user_movies (deduped by movie_id)
    const userMovieInserts = Array.from(
      new Map(
        batch
          .map((row) => {
            const title = row.movie_name?.trim()
            if (!title) return null

            const movieId = movieIdMap.get(title)
            if (!movieId) return null

            const type = row.type
            const watched = type === 'watch' || type === 'rewatch' || type === 'rewatch_count'
            const watchedAt = row.created_at || null

            return [movieId, {
              movie_id: movieId,
              user_id: userId,
              watched,
              watched_at: watched ? watchedAt : null,
              is_watchlist: true,
            }]
          })
          .filter(Boolean) as Array<[string, { movie_id: string; user_id: string; watched: boolean; watched_at: string | null; is_watchlist: boolean }]>
      ).values()
    )

    if (userMovieInserts.length > 0) {
      const { error: umError } = await supabase
        .from('user_movies')
        .upsert(userMovieInserts, { onConflict: 'movie_id,user_id' })

      if (umError) {
        warnings.push(`Failed to batch upsert user_movies: ${umError.message}`)
      }
    }

    // Accumulate movie IDs for TMDb resolution
    for (const [title, id] of movieIdMap) {
      allMovieIds.set(title, id)
    }

    onBatch(Math.min(i + BATCH_SIZE, uniqueMovies.length))
  }

  // ── Phase 3: Resolve TMDb data (tmdb_id, poster_path) for all imported movies ──
  const titleYearList = uniqueMovies
    .map((row) => ({
      title: row.movie_name?.trim() || '',
      year: row.release_date ? row.release_date.substring(0, 4) : undefined,
    }))
    .filter((m) => m.title.length > 0)

  if (titleYearList.length > 0) {
    const resolutionMap = await resolveMoviesBatch(
      titleYearList,
      new Map(),
      (resolved) => {
        onBatch(uniqueMovies.length + Math.min(resolved, titleYearList.length))
      }
    )

    const movieUpdates: Array<{
      id: string
      title: string
      tmdb_id: number
      poster_path: string | null
      release_date: string | null
      genres: string[]
      runtime: number | null
    }> = []

    for (const [key, resolution] of resolutionMap.entries()) {
      // Key format is "title|year" — extract original title for DB lookup
      const originalTitle = key.substring(0, key.lastIndexOf('|'))
      const movieId = allMovieIds.get(originalTitle)
      if (!movieId) continue
      movieUpdates.push({
        id: movieId,
        title: resolution.title,
        tmdb_id: resolution.tmdb_id,
        poster_path: resolution.poster_path,
        release_date: resolution.release_date,
        genres: resolution.genres,
        runtime: resolution.runtime,
      })
    }

    // Batch upsert resolved data
    for (let i = 0; i < movieUpdates.length; i += BATCH_SIZE) {
      const batch = movieUpdates.slice(i, i + BATCH_SIZE)
      if (batch.length > 0) {
        const { error } = await supabase
          .from('movies')
          .upsert(batch, { onConflict: 'id' })
        if (error) {
          warnings.push(`Failed to batch update movies with TMDb data: ${error.message}`)
        }
      }
    }
  }

  return { warnings }
}

async function updateShowsWithTmdbData(
  resolutionMap: Map<number, ShowResolution>,
  showUuidMap: Map<number, string>
): Promise<void> {
  const BATCH_SIZE = 50
  const entries = [...resolutionMap.entries()]

  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE)

    // Build batch upsert with the id (primary key) to update existing rows
    const showUpdates = batch
      .map(([tvdbId, resolution]) => {
        const showUuid = showUuidMap.get(tvdbId)
        if (!showUuid) return null

        return {
          id: showUuid,
          tvdb_id: tvdbId, // include to avoid NOT NULL violation on insert
          tmdb_id: resolution.tmdb_id,
          name: resolution.name,
          poster_path: resolution.poster_path,
          status: resolution.status,
          total_episodes: resolution.total_episodes,
          last_air_date: resolution.last_air_date,
          average_runtime: resolution.average_runtime ?? null,
          // genres: resolution.genres, // Commented out until schema is updated
        }
      })
      .filter(Boolean) as Array<{
        id: string
        tvdb_id: number
        tmdb_id: number | null
        name: string
        poster_path: string | null
        status: string | null
        total_episodes: number | null
        last_air_date: string | null
        average_runtime: number | null
        // genres?: string[]
      }>

    if (showUpdates.length > 0) {
      const { error } = await supabase
        .from('shows')
        .upsert(showUpdates, { onConflict: 'id' })

      if (error) {
        console.error(`Failed to batch update shows with TMDb data: ${error.message}`)
      }
    }
  }
}
