// ─── Movies Tab — React Query hooks ───

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { getImageUrl, getMovieDetails, searchMovie } from '@/lib/tmdb'
import type { Movie, UserMovie } from '@/types'

// ── Types for joined query result ──

export interface MovieWithUserData extends Movie {
  user_movies: UserMovie | null
  watched: boolean
  watched_at: string | null
  is_watchlist: boolean
}

function mapRow(row: any): MovieWithUserData {
  const um = row.user_movies || {}
  return {
    id: row.id,
    tmdb_id: row.tmdb_id,
    title: row.title,
    release_date: row.release_date,
    runtime: row.runtime,
    poster_path: row.poster_path,
    genres: row.genres ?? null,
    // User movie data
    user_movies: um,
    watched: um.watched ?? false,
    watched_at: um.watched_at ?? null,
    is_watchlist: um.is_watchlist ?? false,
  }
}

// ── Query keys ──

export const movieKeys = {
  all: ['movies'] as const,
  list: ['movies', 'list'] as const,
}

// ── Sorting ──

function sortMovies(movies: MovieWithUserData[]): MovieWithUserData[] {
  return [...movies].sort((a, b) => {
    // Recently watched first
    const aTime = a.watched_at ? new Date(a.watched_at).getTime() : 0
    const bTime = b.watched_at ? new Date(b.watched_at).getTime() : 0
    if (aTime !== bTime) return bTime - aTime
    // Then alphabetical by title
    return a.title.localeCompare(b.title)
  })
}

// ── Fetch all movies (with user data join) ──

async function fetchMovies(): Promise<MovieWithUserData[]> {
  const { data, error } = await supabase
    .from('movies')
    .select('*, user_movies(*)')

  if (error) throw new Error(`Failed to fetch movies: ${error.message}`)
  if (!data) return []

  let result = data.map(mapRow)
  // Filter: only show items that are in the user's library
  result = result.filter((m) => m.is_watchlist)
  return sortMovies(result)
}

export function useMovies() {
  return useQuery({
    queryKey: movieKeys.list,
    queryFn: fetchMovies,
    staleTime: 1000 * 60 * 5,
  })
}

// ── Fetch single movie by ID ──

async function fetchMovie(id: string): Promise<MovieWithUserData | null> {
  // Support both UUID and TMDb ID lookups
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)

  let query = supabase
    .from('movies')
    .select('*, user_movies(*)')

  if (isUuid) {
    query = query.eq('id', id)
  } else {
    const numId = parseInt(id, 10)
    if (isNaN(numId)) throw new Error(`Invalid movie identifier: ${id}`)
    query = query.eq('tmdb_id', numId)
  }

  const { data, error } = await query.single()

  if (error) {
    // PGRST116 = not found — return null for TMDB fallback
    if (error.code === 'PGRST116') return null
    throw new Error(`Failed to fetch movie: ${error.message}`)
  }

  return mapRow(data)
}

export function useMovie(id: string) {
  const queryClient = useQueryClient()

  return useQuery({
    queryKey: ['movies', 'detail', id],
    queryFn: () => fetchMovie(id),
    staleTime: 1000 * 60 * 5,
    // Use placeholderData (not initialData) so the query stays in pending state
    // when no cache is available — avoids React Query v5 treating undefined
    // initialData as a "success" state with no data.
    placeholderData: () => {
      const cached = queryClient.getQueryData<MovieWithUserData[]>(
        movieKeys.list
      )
      if (cached) {
        const found = cached.find((m) => m.id === id)
        if (found) return found
      }
      return undefined
    },
  })
}

// ── Mark movie as watched ──

export function useMarkMovieWatched() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (movieId: string) => {
      const { error } = await supabase.from('user_movies').upsert(
        {
          movie_id: movieId,
          watched: true,
          watched_at: new Date().toISOString(),
        },
        { onConflict: 'movie_id' }
      )
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: movieKeys.all })
      queryClient.invalidateQueries({ queryKey: ['profile'] })
    },
  })
}

// ── Toggle watched status ──

export function useToggleMovieWatched() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (movieId: string) => {
      const { data: existing } = await supabase
        .from('user_movies')
        .select('watched')
        .eq('movie_id', movieId)
        .single()

      const newWatched = !(existing?.watched ?? false)

      const { error } = await supabase.from('user_movies').upsert(
        {
          movie_id: movieId,
          watched: newWatched,
          watched_at: newWatched ? new Date().toISOString() : null,
        },
        { onConflict: 'movie_id' }
      )
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: movieKeys.all })
      queryClient.invalidateQueries({ queryKey: ['profile'] })
    },
  })
}

// ── Toggle watchlist ──

export function useToggleMovieWatchlist() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ movieId, isWatchlist }: { movieId: string; isWatchlist: boolean }) => {
      const { error } = await supabase.from('user_movies').upsert(
        {
          movie_id: movieId,
          is_watchlist: isWatchlist,
        },
        { onConflict: 'movie_id' }
      )
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: movieKeys.all })
      queryClient.invalidateQueries({ queryKey: ['profile'] })
    },
  })
}

// ── Refresh missing poster_path for existing movies ──

export function useRefreshMoviePosters() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      // 1. Fetch movies where poster_path is null
      const { data: movies, error: fetchError } = await supabase
        .from('movies')
        .select('id, title, tmdb_id, release_date')
        .is('poster_path', null)

      if (fetchError) throw new Error(`Failed to fetch movies: ${fetchError.message}`)
      if (!movies || movies.length === 0) return { updated: 0 }

      const BATCH_SIZE = 5
      const updates: Array<{ id: string; poster_path: string | null; tmdb_id: number | null }> = []

      // 2. Resolve poster_path for each movie
      for (let i = 0; i < movies.length; i += BATCH_SIZE) {
        const batch = movies.slice(i, i + BATCH_SIZE)
        const results = await Promise.allSettled(
          batch.map(async (movie) => {
            let posterPath: string | null = null

            if (movie.tmdb_id) {
              // Fetch poster from TMDb using tmdb_id
              try {
                const details = await getMovieDetails(movie.tmdb_id)
                posterPath = details.poster_path
              } catch {
                // TMDb fetch failed, try search as fallback
              }
            }

            if (!posterPath) {
              // Search TMDb by title + year
              const year = movie.release_date?.substring(0, 4)
              try {
                const searchResult = await searchMovie(movie.title, year)
                if (searchResult.results?.length > 0) {
                  posterPath = searchResult.results[0].poster_path
                }
              } catch {
                // Search failed
              }
            }

            return { id: movie.id, poster_path: posterPath, tmdb_id: movie.tmdb_id }
          })
        )

        for (const result of results) {
          if (result.status === 'fulfilled' && result.value.poster_path) {
            updates.push(result.value)
          }
        }
      }

      // 3. Batch update poster_path in database
      if (updates.length > 0) {
        const { error: updateError } = await supabase
          .from('movies')
          .upsert(updates, { onConflict: 'id' })

        if (updateError) throw new Error(`Failed to update posters: ${updateError.message}`)
      }

      return { updated: updates.length }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: movieKeys.all })
      queryClient.invalidateQueries({ queryKey: ['profile'] })
    },
  })
}

export { getImageUrl }

// ── Batch-fetch genres for movies missing them ──

export function useRefreshMovieGenres() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      // 1. Fetch movies where genres is null
      const { data: movies, error: fetchError } = await supabase
        .from('movies')
        .select('id, tmdb_id')
        .is('genres', null)
        .not('tmdb_id', 'is', null)

      if (fetchError) throw new Error(`Failed to fetch movies: ${fetchError.message}`)
      if (!movies || movies.length === 0) return { updated: 0 }

      const BATCH_SIZE = 5
      const updates: Array<{ id: string; genres: string[] }> = []

      // 2. Fetch genres from TMDb for each movie
      for (let i = 0; i < movies.length; i += BATCH_SIZE) {
        const batch = movies.slice(i, i + BATCH_SIZE)
        const results = await Promise.allSettled(
          batch.map(async (movie) => {
            const details = await getMovieDetails(movie.tmdb_id!)
            const genres = (details.genres || []).map((g: { id: number; name: string }) => g.name)
            return { id: movie.id, genres }
          })
        )

        for (const result of results) {
          if (result.status === 'fulfilled' && result.value.genres.length > 0) {
            updates.push(result.value)
          }
        }
      }

      // 3. Batch update genres in database
      if (updates.length > 0) {
        const { error: updateError } = await supabase
          .from('movies')
          .upsert(updates, { onConflict: 'id' })

        if (updateError) throw new Error(`Failed to update genres: ${updateError.message}`)
      }

      return { updated: updates.length }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: movieKeys.all })
    },
  })
}
