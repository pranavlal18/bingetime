// ─── TMDb Resolver — resolves TVDB IDs to TMDb IDs (shows) and searches movies by title ───

import { findByExternalId, searchMovieAgnostic, searchTv, getShowDetails, getMovieDetails, getImageUrl } from '@/lib/tmdb'
import type { ShowResolution, MovieResolution } from './types'

interface ResolutionStats {
  total: number
  resolved: number
  failed: number
  failedItems: Array<{ id: number | string; reason: string }>
}

// ─── Helpers ───

function logFailure(stats: ResolutionStats, id: number | string, reason: string): void {
  stats.failed++
  stats.failedItems.push({ id, reason })
  console.warn(`[TMDb] Failed to resolve ${id}: ${reason}`)
}

function logSuccess(stats: ResolutionStats): void {
  stats.resolved++
}

function printSummary(stats: ResolutionStats, entityType: 'shows' | 'movies'): void {
  const rate = stats.total > 0 ? ((stats.resolved / stats.total) * 100).toFixed(1) : '0'
  console.log(`\n[TMDb] ${entityType.toUpperCase()} Resolution Summary:`)
  console.log(`  Total: ${stats.total} | Resolved: ${stats.resolved} | Failed: ${stats.failed} | Rate: ${rate}%`)
  if (stats.failedItems.length > 0) {
    console.log(`  Failed items:`)
    for (const item of stats.failedItems) {
      console.log(`    - ${item.id}: ${item.reason}`)
    }
  }
  console.log('')
}

function containsNonLatinScript(text: string): boolean {
  // Detect non-Latin scripts: Chinese, Japanese, Korean, Arabic, Cyrillic, etc.
  return /[\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF\u0600-\u06FF\u0400-\u04FF]/.test(text)
}

export async function resolveShowByTvdbId(tvdbId: number, showName?: string, stats?: ResolutionStats): Promise<ShowResolution | null> {
  // First attempt: /find by TVDB ID
  try {
    const findResult = await findByExternalId(tvdbId)

    if (findResult.tv_results && findResult.tv_results.length > 0) {
      const match = findResult.tv_results[0]
      const tmdbId = match.id

      // Get full details including seasons
      let details
      try {
        details = await getShowDetails(tmdbId)
      } catch {
        // If details fail, return basic info from find result
        stats && logSuccess(stats)
        return {
          tvdb_id: tvdbId,
          tmdb_id: tmdbId,
          name: match.name,
          poster_path: match.poster_path,
          status: null,
          total_episodes: null,
          last_air_date: match.first_air_date,
          average_runtime: null,
          genres: [],
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

      stats && logSuccess(stats)
      return {
        tvdb_id: tvdbId,
        tmdb_id: tmdbId,
        name: details.name,
        poster_path: details.poster_path,
        status: details.status,
        total_episodes: details.number_of_episodes,
        last_air_date: details.last_air_date,
        average_runtime: averageRuntime,
        genres: details.genres?.map(g => g.name) || [],
        seasons: (details.seasons || [])
          .filter((s) => s.season_number > 0) // exclude specials (season 0)
          .map((s) => ({
            season_number: s.season_number,
            episode_count: s.episode_count,
          })),
      }
    }
  } catch (error) {
    console.warn(`[TMDb] /find failed for TVDB ID ${tvdbId}:`, error)
  }

  // Fallback: Search by name if provided
  if (showName) {
    try {
      const searchResult = await searchTv(showName)
      if (searchResult.results && searchResult.results.length > 0) {
        const match = searchResult.results[0]
        const tmdbId = match.id

        // Skip similarity check for non-Latin script titles (they get translated)
        const shouldCheckSimilarity = !containsNonLatinScript(showName)
        if (shouldCheckSimilarity) {
          const similarity = calculateSimilarity(showName.toLowerCase(), match.name?.toLowerCase() || '')
          if (similarity < 0.3) {
            stats && logFailure(stats, tvdbId, `Fallback search found low-similarity match: "${match.name || 'unknown'}" (${similarity * 100}%)`)
            return null
          }
        }

        let details
        try {
          details = await getShowDetails(tmdbId)
        } catch {
          stats && logSuccess(stats)
          return {
            tvdb_id: tvdbId,
            tmdb_id: tmdbId,
            name: match.name || showName,
            poster_path: match.poster_path,
            status: null,
            total_episodes: null,
            last_air_date: match.first_air_date || null,
            average_runtime: null,
            genres: [],
            seasons: [],
          }
        }

        let averageRuntime: number | null = null
        if (details.episode_run_time && details.episode_run_time.length > 0) {
          const sum = details.episode_run_time.reduce((acc, val) => acc + val, 0)
          const avgMinutes = sum / details.episode_run_time.length
          averageRuntime = Math.round(avgMinutes * 60)
        }

        stats && logSuccess(stats)
        console.log(`[TMDb] Fallback search succeeded for TVDB ID ${tvdbId} → "${details.name}" (TMDb ID: ${tmdbId})`)
        return {
          tvdb_id: tvdbId,
          tmdb_id: tmdbId,
          name: details.name,
          poster_path: details.poster_path,
          status: details.status,
          total_episodes: details.number_of_episodes,
          last_air_date: details.last_air_date,
          average_runtime: averageRuntime,
          genres: details.genres?.map(g => g.name) || [],
          seasons: (details.seasons || [])
            .filter((s) => s.season_number > 0)
            .map((s) => ({
              season_number: s.season_number,
              episode_count: s.episode_count,
            })),
        }
      }
    } catch (error) {
      console.warn(`[TMDb] Fallback search failed for "${showName}":`, error)
    }
  }

  stats && logFailure(stats, tvdbId, showName ? 'No match via /find or fallback search' : 'No TMDb match via /find (no name for fallback)')
  return null
}

function calculateSimilarity(a: string, b: string): number {
  // Simple Jaccard similarity on word sets
  const wordsA = new Set(a.split(/\s+/))
  const wordsB = new Set(b.split(/\s+/))
  const intersection = new Set([...wordsA].filter(x => wordsB.has(x)))
  const union = new Set([...wordsA, ...wordsB])
  return intersection.size / union.size
}

/**
 * Search TMDb for a movie by title + optional year.
 * If title+year fails, falls back to title-only search.
 * Returns the best match, or null if no good match found.
 * Uses language-agnostic search to handle non-English titles.
 */
export async function resolveMovieByTitle(
  title: string,
  year?: string,
  stats?: ResolutionStats
): Promise<MovieResolution | null> {
  const attempts: Array<{ title: string; year?: string }> = [
    { title, year },
    { title, year: undefined }, // Fallback: title only
  ]

  for (const attempt of attempts) {
    try {
      const searchResult = await searchMovieAgnostic(attempt.title, attempt.year)

      if (searchResult.results && searchResult.results.length > 0) {
        const match = searchResult.results[0]
        
        // Skip similarity check for non-Latin script titles (they get translated)
        const shouldCheckSimilarity = !containsNonLatinScript(attempt.title)
        if (shouldCheckSimilarity) {
          const similarity = calculateSimilarity(attempt.title.toLowerCase(), match.title?.toLowerCase() || '')
          if (similarity < 0.3 && attempt.year) {
            console.warn(`[TMDb] Low similarity match for "${attempt.title}" (${attempt.year}): "${match.title || 'unknown'}" (${similarity * 100}%)`)
            continue // Try next attempt
          }
        }

        const details = await getMovieDetails(match.id)

        stats && logSuccess(stats)
        console.log(`[TMDb] Resolved movie: "${attempt.title}" (${attempt.year || 'no year'}) → "${details.title}" (TMDb ID: ${details.id})`)
        return {
          title: details.title || title,
          year: details.release_date ? details.release_date.substring(0, 4) : attempt.year,
          tmdb_id: details.id,
          poster_path: details.poster_path,
          release_date: details.release_date || null,
          runtime: details.runtime ? details.runtime * 60 : null, // Convert minutes to seconds
          genres: details.genres?.map(g => g.name) || [],
        }
      }
    } catch (error) {
      console.warn(`[TMDb] Search failed for "${attempt.title}" (${attempt.year || 'no year'}):`, error)
    }
  }

  stats && logFailure(stats, title, 'No match found in any search attempt')
  return null
}

/**
 * Resolve a batch of TVDB IDs to TMDb IDs with concurrency control.
 * Skips IDs that are already in the resolution map.
 * Uses fallback search by name if /find fails.
 */
export async function resolveShowsBatch(
  tvdbIds: number[],
  existingMap: Map<number, ShowResolution>,
  tvdbIdToName: Map<number, string>,
  onProgress?: (resolved: number, total: number) => void
): Promise<Map<number, ShowResolution>> {
  const result = new Map(existingMap)
  const toResolve = [...new Set(tvdbIds.filter((id) => !result.has(id)))]

  const CONCURRENCY = 10
  let resolved = 0
  const stats: ResolutionStats = { total: toResolve.length, resolved: 0, failed: 0, failedItems: [] }

  for (let i = 0; i < toResolve.length; i += CONCURRENCY) {
    const batch = toResolve.slice(i, i + CONCURRENCY)
    const promises = batch.map((id) => {
      const name = tvdbIdToName.get(id)
      return resolveShowByTvdbId(id, name, stats)
    })

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

  printSummary(stats, 'shows')
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
  const stats: ResolutionStats = { total: toResolve.length, resolved: 0, failed: 0, failedItems: [] }

  for (let i = 0; i < toResolve.length; i += CONCURRENCY) {
    const batch = toResolve.slice(i, i + CONCURRENCY)
    const promises = batch.map((m) => resolveMovieByTitle(m.title, m.year, stats))

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

  printSummary(stats, 'movies')
  return result
}

export { getImageUrl, searchMovieAgnostic }