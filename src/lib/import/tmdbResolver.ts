// ─── TMDb Resolver — resolves TVDB IDs to TMDb IDs (shows) and searches movies by title ───

import { findByExternalId, searchMovieAgnostic, getShowDetails, getImageUrl } from '@/lib/tmdb'
import type { ShowResolution, MovieResolution } from './types'

/**
 * Resolve a TheTVDB ID → TMDb show record using TMDb's `/find/{tvdb_id}?external_source=tvdb_id`.
 * Returns null if no match found.
 */
export async function resolveShowByTvdbId(tvdbId: number): Promise<ShowResolution | null> {
  try {
    const findResult = await findByExternalId(tvdbId)

    if (!findResult.tv_results || findResult.tv_results.length === 0) {
      console.warn(`No TMDb match for TVDB ID ${tvdbId}`)
      return null
    }

    const match = findResult.tv_results[0]
    const tmdbId = match.id

    // Get full details including seasons
    let details
    try {
      details = await getShowDetails(tmdbId)
    } catch {
      // If details fail, return basic info from find result
      return {
        tvdb_id: tvdbId,
        tmdb_id: tmdbId,
        name: match.name,
        poster_path: match.poster_path,
        status: null,
        total_episodes: null,
        last_air_date: match.first_air_date,
        average_runtime: null,
        seasons: [],
      }
    }

    // Calculate average runtime from episode_run_time array (TMDb returns minutes, convert to seconds)
    let averageRuntime: number | null = null
    if (details.episode_run_time && details.episode_run_time.length > 0) {
      const sum = details.episode_run_time.reduce((acc, val) => acc + val, 0)
      const avgMinutes = sum / details.episode_run_time.length
      averageRuntime = Math.round(avgMinutes * 60) // convert to seconds
    }

    return {
      tvdb_id: tvdbId,
      tmdb_id: tmdbId,
      name: details.name,
      poster_path: details.poster_path,
      status: details.status,
      total_episodes: details.number_of_episodes,
      last_air_date: details.last_air_date,
      average_runtime: averageRuntime,
      seasons: (details.seasons || [])
        .filter((s) => s.season_number > 0) // exclude specials (season 0)
        .map((s) => ({
          season_number: s.season_number,
          episode_count: s.episode_count,
        })),
    }
  } catch (error) {
    console.error(`Error resolving show TVDB ID ${tvdbId}:`, error)
    return null
  }
}

/**
   * Search TMDb for a movie by title + optional year.
   * Returns the best match, or null if no good match found.
   * Uses language-agnostic search to handle non-English titles.
   */
  export async function resolveMovieByTitle(
    title: string,
    year?: string
  ): Promise<MovieResolution | null> {
    try {
      const searchResult = await searchMovieAgnostic(title, year)

      if (!searchResult.results || searchResult.results.length === 0) {
        console.warn(`No TMDb match for movie: "${title}" (${year || 'no year'})`)
        return null
      }

      const match = searchResult.results[0]
      return {
        title: match.title || title,
        year: match.release_date ? match.release_date.substring(0, 4) : year,
        tmdb_id: match.id,
        poster_path: match.poster_path,
        release_date: match.release_date || null
      }
    } catch (error) {
      console.error(`Error searching movie "${title}" (${year}):`, error)
      return null
    }
  }

/**
 * Resolve a batch of TVDB IDs to TMDb IDs with concurrency control.
 * Skips IDs that are already in the resolution map.
 */
export async function resolveShowsBatch(
  tvdbIds: number[],
  existingMap: Map<number, ShowResolution>,
  onProgress?: (resolved: number, total: number) => void
): Promise<Map<number, ShowResolution>> {
  const result = new Map(existingMap)
  const toResolve = [...new Set(tvdbIds.filter((id) => !result.has(id)))]

  const CONCURRENCY = 10
  let resolved = 0

  for (let i = 0; i < toResolve.length; i += CONCURRENCY) {
    const batch = toResolve.slice(i, i + CONCURRENCY)
    const promises = batch.map((id) => resolveShowByTvdbId(id))

    const outcomes = await Promise.allSettled(promises)

    for (const outcome of outcomes) {
      if (outcome.status === 'fulfilled' && outcome.value) {
        result.set(outcome.value.tvdb_id, outcome.value)
      }
      resolved++
    }

    onProgress?.(resolved, toResolve.length)

    // Delay between batches to stay under TMDb's 50 req/10s free tier limit (5 req/s)
    if (i + CONCURRENCY < toResolve.length) {
      await new Promise((r) => setTimeout(r, 2000))
    }
  }

  return result
}

/**
 * Resolve a batch of movies by title + year.
 */
export async function resolveMoviesBatch(
  movies: Array<{ title: string; year?: string }>,
  existingMap: Map<string, MovieResolution>,
  onProgress?: (resolved: number, total: number) => void
): Promise<Map<string, MovieResolution>> {
  const result = new Map(existingMap)
  const toResolve = movies.filter((m) => {
    const key = `${m.title}|${m.year || ''}`
    return !result.has(key)
  })

  const CONCURRENCY = 5
  let resolved = 0

  for (let i = 0; i < toResolve.length; i += CONCURRENCY) {
    const batch = toResolve.slice(i, i + CONCURRENCY)
    const promises = batch.map((m) => resolveMovieByTitle(m.title, m.year))

    const outcomes = await Promise.allSettled(promises)

    for (let j = 0; j < outcomes.length; j++) {
      const outcome = outcomes[j]
      if (outcome.status === 'fulfilled' && outcome.value) {
        const key = `${batch[j].title}|${batch[j].year || ''}`
        result.set(key, outcome.value)
      }
      resolved++
    }

    onProgress?.(resolved, toResolve.length)

    // Rate-limit delay
    if (i + CONCURRENCY < toResolve.length) {
      await new Promise((r) => setTimeout(r, 2000))
    }
  }

  return result
}

export { getImageUrl, searchMovieAgnostic }
