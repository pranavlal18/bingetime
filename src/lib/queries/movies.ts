// ─── Movies Tab — React Query hooks ───

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { getImageUrl, getMovieDetails, searchMovie } from '@/lib/tmdb'
import { useAuth } from '@/contexts/AuthContext'
import type { Movie, UserMovie } from '@/types'

// ── Types for joined query result ──

export interface MovieWithUserData extends Movie {
  user_movies: UserMovie | null
  watched: boolean
  watched_at: string | null
  is_watchlist: boolean
  is_favorited: boolean
}

export interface FavoriteMovie extends Movie {
  watched: boolean
  favorited_at: string | null
}

function mapRow(row: any): MovieWithUserData {
  // PostgREST returns to-many relationships as arrays, even with !inner
  const umRaw = row.user_movies
  const um = Array.isArray(umRaw) ? (umRaw[0] ?? {}) : (umRaw ?? {})
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
    is_favorited: um.is_favorited ?? false,
  }
}

// ── Query keys ──

export const movieKeys = {
  all: ['movies'] as const,
  list: (userId: string) => ['movies', 'list', userId] as const,
  detail: (id: string) => ['movies', 'detail', id] as const,
  favorites: (userId: string) => ['movies', 'favorites', userId] as const,
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

async function fetchMovies(userId: string): Promise<MovieWithUserData[]> {
  const { data, error } = await supabase
    .from('movies')
    .select('*, user_movies!inner(*)')
    .eq('user_movies.user_id', userId)

  if (__DEV__) console.log('🔍 [fetchMovies] Query result:', { dataLength: data?.length, error: error?.message })

  if (error) throw new Error(`Failed to fetch movies: ${error.message}`)
  if (!data) return []

  let result = data.map(mapRow)
  if (__DEV__) console.log('🔍 [fetchMovies] After mapping:', { count: result.length, watchlist: result.filter(m => m.is_watchlist).length, watched: result.filter(m => m.watched).length })
  // Filter: only show items that are in the user's library
  result = result.filter((m) => m.is_watchlist)
  return sortMovies(result)
}

export function useMovies() {
  const { user } = useAuth()

  return useQuery({
    queryKey: movieKeys.list(user?.id ?? ''),
    queryFn: () => fetchMovies(user?.id ?? ''),
    staleTime: 1000 * 60 * 5,
    enabled: !!user,
  })
}

// ── Fetch single movie by ID ──

async function fetchMovie(
  id: string,
  userId: string
): Promise<MovieWithUserData | null> {
  // Support both UUID and TMDb ID lookups
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)

  let query = supabase
    .from('movies')
    .select('*, user_movies!inner(*)')
    .eq('user_movies.user_id', userId)

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
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useQuery({
    queryKey: movieKeys.detail(id),
    queryFn: () => fetchMovie(id, user?.id ?? ''),
    staleTime: 1000 * 60 * 5,
    enabled: !!user,
    placeholderData: () => {
      if (!user) return undefined
      const cached = queryClient.getQueryData<MovieWithUserData[]>(movieKeys.list(user.id))
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
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (movieId: string) => {
      if (!user) throw new Error('Not authenticated')
      const { error } = await supabase.from('user_movies').upsert(
        {
          movie_id: movieId,
          user_id: user.id,
          watched: true,
          watched_at: new Date().toISOString(),
          is_watchlist: true,
        },
        { onConflict: 'movie_id,user_id' }
      )
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: movieKeys.all })
      queryClient.invalidateQueries({ queryKey: ['profile'] })
      // Refresh stats (weekly chart, watch time, catch-up rate, etc.)
      queryClient.invalidateQueries({ queryKey: ['stats'] })
    },
  })
}

// ── Toggle watched status ──

export function useToggleMovieWatched() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (movieId: string) => {
      if (!user) throw new Error('Not authenticated')
      const { data: existing } = await supabase
        .from('user_movies')
        .select('watched')
        .eq('movie_id', movieId)
        .eq('user_id', user.id)
        .single()

      const newWatched = !(existing?.watched ?? false)

      const { error } = await supabase.from('user_movies').upsert(
        {
          movie_id: movieId,
          user_id: user.id,
          watched: newWatched,
          watched_at: newWatched ? new Date().toISOString() : null,
          ...(newWatched ? { is_watchlist: true } : {}),
        },
        { onConflict: 'movie_id,user_id' }
      )
      if (error) throw new Error(error.message)
    },

    onMutate: async (movieId: string) => {
      if (!user) return

      // Cancel in-flight refetches so optimistic write isn't clobbered
      await queryClient.cancelQueries({ queryKey: movieKeys.all })

      // Snapshot previous data for rollback
      const previousList = queryClient.getQueryData<MovieWithUserData[]>(movieKeys.list(user.id))

      // Optimistically toggle the movie
      if (previousList) {
        queryClient.setQueryData<MovieWithUserData[]>(
          movieKeys.list(user.id),
          previousList.map((m) =>
            m.id === movieId
              ? {
                  ...m,
                  watched: !m.watched,
                  watched_at: m.watched ? null : new Date().toISOString(),
                }
              : m
          )
        )
      }

      return { previousList }
    },

    onError: (_err, movieId, context) => {
      // Rollback optimistic update
      if (context?.previousList) {
        queryClient.setQueryData(movieKeys.list(user?.id ?? ''), context.previousList)
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: movieKeys.all })
      queryClient.invalidateQueries({ queryKey: ['profile'] })
      // Refresh stats (weekly chart, watch time, catch-up rate, etc.)
      queryClient.invalidateQueries({ queryKey: ['stats'] })
    },
  })
}

// ── Toggle watchlist ──

export function useToggleMovieWatchlist() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ movieId, isWatchlist }: { movieId: string; isWatchlist: boolean }) => {
      if (!user) throw new Error('Not authenticated')
      const { error } = await supabase.from('user_movies').upsert(
        {
          movie_id: movieId,
          user_id: user.id,
          is_watchlist: isWatchlist,
        },
        { onConflict: 'movie_id,user_id' }
      )
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: movieKeys.all })
      queryClient.invalidateQueries({ queryKey: ['profile'] })
      // Refresh stats (tab counts, remaining, watch time, etc.)
      queryClient.invalidateQueries({ queryKey: ['stats'] })
    },
  })
}

// ── Refresh missing poster_path for existing movies ──

export function useRefreshMoviePosters() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated')
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

// ── Refresh missing/incorrect release_date for existing movies ──

export function useRefreshMovieReleaseDates() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated')
      // 1. Fetch movies in user's watchlist that have tmdb_id (release_date may be null or wrong)
      const { data: movies, error: fetchError } = await supabase
        .from('movies')
        .select('id, title, tmdb_id, release_date')
        .eq('user_movies.user_id', user.id)
        .eq('user_movies.is_watchlist', true)
        .not('tmdb_id', 'is', null)

      if (fetchError) throw new Error(`Failed to fetch movies: ${fetchError.message}`)
      if (!movies || movies.length === 0) return { updated: 0, checked: 0 }

      const BATCH_SIZE = 5
      const updates: Array<{ id: string; release_date: string | null }> = []

      // 2. Resolve release_date for each movie from TMDb
      for (let i = 0; i < movies.length; i += BATCH_SIZE) {
        const batch = movies.slice(i, i + BATCH_SIZE)
        const results = await Promise.allSettled(
          batch.map(async (movie) => {
            let releaseDate: string | null = null

            if (movie.tmdb_id) {
              try {
                const details = await getMovieDetails(movie.tmdb_id)
                releaseDate = details.release_date
              } catch {
                // TMDb fetch failed
              }
            }

            return { id: movie.id, tmdbReleaseDate: releaseDate, currentReleaseDate: movie.release_date }
          })
        )

        for (const result of results) {
          if (result.status === 'fulfilled' && result.value.tmdbReleaseDate) {
            const { id, tmdbReleaseDate, currentReleaseDate } = result.value
            // Only update if TMDb has a date and it differs from what we have
            if (tmdbReleaseDate !== currentReleaseDate) {
              updates.push({ id, release_date: tmdbReleaseDate })
            }
          }
        }
      }

      // 3. Batch update release_date in database
      if (updates.length > 0) {
        const { error: updateError } = await supabase
          .from('movies')
          .upsert(updates, { onConflict: 'id' })

        if (updateError) throw new Error(`Failed to update release dates: ${updateError.message}`)
      }

      return { updated: updates.length, checked: movies.length }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: movieKeys.all })
      queryClient.invalidateQueries({ queryKey: ['profile'] })
    },
  })
}

// ── Batch-fetch genres for movies missing them ──

export function useRefreshMovieGenres() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated')
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

// ── Toggle movie favorite ──

async function toggleMovieFavorite(movieId: string, userId: string): Promise<void> {
  const { data: um } = await supabase
    .from('user_movies')
    .select('is_favorited')
    .eq('movie_id', movieId)
    .eq('user_id', userId)
    .single()

  const current = um?.is_favorited ?? false
  const newValue = !current

  await supabase
    .from('user_movies')
    .update({
      is_favorited: newValue,
      favorited_at: newValue ? new Date().toISOString() : null,
    })
    .eq('movie_id', movieId)
    .eq('user_id', userId)
}

export function useToggleMovieFavorite() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (movieId: string) => toggleMovieFavorite(movieId, user?.id ?? ''),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: movieKeys.all })
    },
  })
}

// ── Fetch favorite movies ──

async function fetchFavoriteMovies(userId: string): Promise<FavoriteMovie[]> {
  const { data, error } = await supabase
    .from('user_movies')
    .select('watched, favorited_at, movies(*)')
    .eq('user_id', userId)
    .eq('is_favorited', true)
    .order('favorited_at', { ascending: false })

  if (error) throw new Error(error.message)
  if (!data) return []

  return data.map((row: any) => {
    const movie = row.movies
    return {
      id: movie.id,
      tmdb_id: movie.tmdb_id,
      title: movie.title,
      release_date: movie.release_date,
      runtime: movie.runtime,
      poster_path: movie.poster_path,
      genres: movie.genres ?? null,
      watched: row.watched,
      favorited_at: row.favorited_at ?? null,
    }
  })
}

export function useFavoriteMovies() {
  const { user } = useAuth()

  return useQuery({
    queryKey: movieKeys.favorites(user?.id ?? ''),
    queryFn: () => fetchFavoriteMovies(user?.id ?? ''),
    staleTime: 1000 * 60 * 5,
    enabled: !!user,
  })
}

export { getImageUrl }