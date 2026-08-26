// ─── Onboarding wizard queries ───

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import * as tmdb from '@/lib/tmdb'
import type { TMDbSearchResponse } from '@/types'
import type { DiscoverResult } from './discover'

function toDiscoverResults(raw: TMDbSearchResponse | { results: any[] }, mediaType: 'tv' | 'movie'): DiscoverResult[] {
  return (raw.results as any[]).map((item) => {
    const release = mediaType === 'movie' ? item.release_date : item.first_air_date
    return {
      tmdbId: item.id,
      mediaType,
      title: mediaType === 'movie' ? item.title : item.name,
      poster_path: item.poster_path ?? null,
      year: release?.slice(0, 4) ?? null,
      releaseDate: release ?? null,
      overview: item.overview ?? null,
      inLibrary: false,
    }
  })
}

async function enrichWithLibrary(results: DiscoverResult[], userId: string): Promise<DiscoverResult[]> {
  if (!userId || results.length === 0) return results
  const tvIds = results.filter((r) => r.mediaType === 'tv').map((r) => r.tmdbId)
  const movieIds = results.filter((r) => r.mediaType === 'movie').map((r) => r.tmdbId)
  const [existingShows, existingMovies] = await Promise.all([
    tvIds.length > 0
      ? supabase
          .from('shows')
          .select('id, tmdb_id, user_shows!inner(is_watchlist)')
          .in('tmdb_id', tvIds)
          .not('tmdb_id', 'is', null)
          .eq('user_shows.user_id', userId)
          .eq('user_shows.is_watchlist', true)
      : Promise.resolve({ data: [] as any[] }),
    movieIds.length > 0
      ? supabase
          .from('movies')
          .select('id, tmdb_id, user_movies!inner(is_watchlist)')
          .in('tmdb_id', movieIds)
          .not('tmdb_id', 'is', null)
          .eq('user_movies.user_id', userId)
          .eq('user_movies.is_watchlist', true)
      : Promise.resolve({ data: [] as any[] }),
  ])
  const showSet = new Set<number>()
  if (existingShows?.data) for (const s of existingShows.data) if (s.tmdb_id) showSet.add(s.tmdb_id)
  const movieSet = new Set<number>()
  if (existingMovies?.data) for (const m of existingMovies.data) if (m.tmdb_id) movieSet.add(m.tmdb_id)

  return results
    .map((r) => {
      const inLib = r.mediaType === 'tv' ? showSet.has(r.tmdbId) : movieSet.has(r.tmdbId)
      return { ...r, inLibrary: inLib }
    })
    // hide already-in-library so onboarding never suggests duplicates
    .filter((r) => !r.inLibrary)
}

/**
 * Suggestions for onboarding picks step.
 * - tvGenreIds / movieGenreIds are combined with OR (comma) for discover.
 * - When neither list provided → trending fallback.
 * - Returns up to 24 interleaved results, filtered to not-in-library.
 */
export function useOnboardingSuggestions(tvGenreIds: number[], movieGenreIds: number[]) {
  const { user } = useAuth()
  const userId = user?.id ?? ''

  // stable key: sorted joined strings
  const tvKey = [...tvGenreIds].sort((a, b) => a - b).join(',')
  const movieKey = [...movieGenreIds].sort((a, b) => a - b).join(',')

  return useQuery({
    queryKey: ['onboarding', 'suggestions', tvKey, movieKey, userId] as const,
    queryFn: async (): Promise<DiscoverResult[]> => {
      const hasTv = tvGenreIds.length > 0
      const hasMovie = movieGenreIds.length > 0

      let tvResults: DiscoverResult[] = []
      let movieResults: DiscoverResult[] = []

      if (!hasTv && !hasMovie) {
        // No picks → trending
        const [tvTrending, movieTrending] = await Promise.all([
          tmdb.getTrending('tv').then((r) => toDiscoverResults(r, 'tv')).catch(() => [] as DiscoverResult[]),
          tmdb.getTrending('movie').then((r) => toDiscoverResults(r, 'movie')).catch(() => [] as DiscoverResult[]),
        ])
        tvResults = tvTrending.slice(0, 12)
        movieResults = movieTrending.slice(0, 12)
      } else {
        // Discover by picked genres (OR within each media type)
        const tvIds = hasTv ? tvGenreIds.join(',') : null
        const movieIds = hasMovie ? movieGenreIds.join(',') : null

        const promises: Promise<DiscoverResult[]>[] = []
        if (tvIds) {
          promises.push(
            (tmdb.discoverTitles('tv', 'genre', tvIds, 1, 'popularity.desc') as Promise<any>)
              .then((r) => toDiscoverResults(r, 'tv'))
              .catch(() => [] as DiscoverResult[])
          )
        }
        if (movieIds) {
          promises.push(
            (tmdb.discoverTitles('movie', 'genre', movieIds, 1, 'popularity.desc') as Promise<any>)
              .then((r) => toDiscoverResults(r, 'movie'))
              .catch(() => [] as DiscoverResult[])
          )
        }
        // When only one media type picked, pad the other half with trending
        if (!tvIds && movieIds) {
          promises.push(
            tmdb.getTrending('tv').then((r) => toDiscoverResults(r, 'tv').slice(0, 8)).catch(() => [] as DiscoverResult[])
          )
          // first promise is movie discover, second is tv trending
          const [movies, tvTrending] = await Promise.all(promises)
          movieResults = movies.slice(0, 12)
          tvResults = tvTrending.slice(0, 12)
        } else if (tvIds && !movieIds) {
          const [tvs, movieTrending] = await Promise.all([
            promises[0],
            tmdb.getTrending('movie').then((r) => toDiscoverResults(r, 'movie').slice(0, 8)).catch(() => [] as DiscoverResult[]),
          ])
          tvResults = tvs.slice(0, 12)
          movieResults = movieTrending.slice(0, 12)
        } else {
          const [tvs, movies] = await Promise.all(promises)
          tvResults = tvs.slice(0, 12)
          movieResults = movies.slice(0, 12)
        }
      }

      // Interleave tv + movie for variety
      const merged: DiscoverResult[] = []
      const max = Math.max(tvResults.length, movieResults.length)
      for (let i = 0; i < max; i++) {
        if (i < tvResults.length) merged.push(tvResults[i])
        if (i < movieResults.length) merged.push(movieResults[i])
      }

      const trimmed = merged.slice(0, 24)
      // Filter out already-in-library
      return enrichWithLibrary(trimmed, userId)
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 60,
  })
}
