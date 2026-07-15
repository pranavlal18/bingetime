// ─── Profile Tab — React Query hooks ───

import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useAppStore } from '@/stores/appStore'
import type { Show, UserShow, Movie, UserMovie, List } from '@/types'

// ── Types ──

export interface ProfileStats {
  totalShows: number
  totalMovies: number
  totalEpisodes: number
  totalHours: number
  favoritedShows: number
  watchlistShows: number
  watchlistMovies: number
  customLists: number
}

export interface FavoriteShow extends Show {
  episodes_seen: number
  favorited_at: string | null
  average_runtime: number | null
}

export interface WatchlistShow extends Show {
  episodes_seen: number
  average_runtime: number | null
}

export interface WatchlistMovie extends Movie {
  watched: boolean
}

// ── Query keys ──

export const profileKeys = {
  stats: (userId: string) => ['profile', 'stats', userId] as const,
  favorites: (userId: string) => ['profile', 'favorites', userId] as const,
  watchlist: (userId: string) => ['profile', 'watchlist', userId] as const,
  lists: (userId: string) => ['profile', 'lists', userId] as const,
}

// ── Fetch stats ──

async function fetchStats(userId: string): Promise<ProfileStats> {
  // Fetch user_shows with show details including average_runtime
  const { data: userShows, error: showsError } = await supabase
    .from('user_shows')
    .select(`
      episodes_seen,
      is_favorited,
      is_watchlist,
      shows!inner(average_runtime)
    `)
    .eq('user_id', userId)

  const { data: userMovies, error: moviesError } = await supabase
    .from('user_movies')
    .select('watched, is_watchlist, movies!inner(runtime)')
    .eq('user_id', userId)

  const { count: listsCount, error: listsError } = await supabase
    .from('lists')
    .select('id', { count: 'exact', head: true })

  if (showsError) throw new Error(showsError.message)
  if (moviesError) throw new Error(moviesError.message)
  if (listsError) throw new Error(listsError.message)

  const totalShows = userShows?.length ?? 0
  const favoritedShows = userShows?.filter((s) => s.is_favorited).length ?? 0
  const watchlistShows = userShows?.filter((s) => s.is_watchlist).length ?? 0

  // Calculate total episodes and total watch time using actual average_runtime per show
  let totalEpisodes = 0
  let totalShowSeconds = 0

  if (userShows) {
    for (const us of userShows) {
      const episodesSeen = us.episodes_seen ?? 0
      totalEpisodes += episodesSeen

      // PostgREST returns to-many relationships as arrays, even with !inner
      const show = Array.isArray(us.shows) ? us.shows[0] : us.shows
      const showRuntime = show?.average_runtime ?? null
      if (showRuntime && episodesSeen > 0) {
        totalShowSeconds += showRuntime * episodesSeen
      }
    }
  }

  const totalMovies = userMovies?.length ?? 0
  const watchedMovies = userMovies?.filter((m) => m.watched).length ?? 0
  const watchlistMovies = userMovies?.filter((m) => m.is_watchlist).length ?? 0
  const customLists = listsCount ?? 0

  // Calculate total movie watch time using actual runtime from movies table
  // Fall back to 2h estimate if runtime is null
  let movieSeconds = 0
  if (userMovies) {
    for (const um of userMovies) {
      if (!um.watched) continue
      const movie = Array.isArray(um.movies) ? um.movies[0] : um.movies
      const runtime = movie?.runtime ?? null
      if (runtime) {
        movieSeconds += runtime
      } else {
        movieSeconds += 2 * 3600 // fallback: 2 hours in seconds
      }
    }
  }

  const totalHours = Math.round((totalShowSeconds + movieSeconds) / 3600)

  return {
    totalShows,
    totalMovies,
    totalEpisodes,
    totalHours,
    favoritedShows,
    watchlistShows,
    watchlistMovies,
    customLists,
  }
}

export function useProfileStats() {
  const { user } = useAuth()

  return useQuery({
    queryKey: profileKeys.stats(user?.id ?? ''),
    queryFn: () => fetchStats(user?.id ?? ''),
    staleTime: 1000 * 60 * 5,
    enabled: !!user,
  })
}

// ── Fetch favorites ──

async function fetchFavorites(userId: string): Promise<FavoriteShow[]> {
  const { data, error } = await supabase
    .from('user_shows')
    .select('episodes_seen, favorited_at, shows(*)')
    .eq('user_id', userId)
    .eq('is_favorited', true)
    .order('favorited_at', { ascending: false })

  if (error) throw new Error(error.message)
  if (!data) return []

  return data.map((row: any) => {
    const show = row.shows
    return {
      id: show.id,
      tmdb_id: show.tmdb_id,
      tvdb_id: show.tvdb_id,
      name: show.name,
      status: show.status,
      poster_path: show.poster_path,
      total_episodes: show.total_episodes,
      last_air_date: show.last_air_date,
      average_runtime: show.average_runtime ?? null,
      episodes_seen: row.episodes_seen ?? 0,
      favorited_at: row.favorited_at ?? null,
    }
  })
}

export function useFavorites() {
  const { user } = useAuth()

  return useQuery({
    queryKey: profileKeys.favorites(user?.id ?? ''),
    queryFn: () => fetchFavorites(user?.id ?? ''),
    staleTime: 1000 * 60 * 5,
    enabled: !!user,
  })
}

// ── Fetch watchlist ──

async function fetchWatchlistShows(userId: string): Promise<WatchlistShow[]> {
  const { data, error } = await supabase
    .from('user_shows')
    .select('episodes_seen, shows(*)')
    .eq('user_id', userId)
    .eq('is_watchlist', true)

  if (error) throw new Error(error.message)
  if (!data) return []

  return data.map((row: any) => {
    const show = row.shows
    return {
      id: show.id,
      tmdb_id: show.tmdb_id,
      tvdb_id: show.tvdb_id,
      name: show.name,
      status: show.status,
      poster_path: show.poster_path,
      total_episodes: show.total_episodes,
      last_air_date: show.last_air_date,
      average_runtime: show.average_runtime ?? null,
      episodes_seen: row.episodes_seen ?? 0,
    }
  })
}

async function fetchWatchlistMovies(userId: string): Promise<WatchlistMovie[]> {
  const { data, error } = await supabase
    .from('user_movies')
    .select('watched, movies(*)')
    .eq('user_id', userId)
    .eq('is_watchlist', true)

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
    }
  })
}

export function useWatchlist() {
  const { user } = useAuth()

  return useQuery({
    queryKey: profileKeys.watchlist(user?.id ?? ''),
    queryFn: async () => {
      if (!user) return { shows: [], movies: [] }
      const [shows, movies] = await Promise.all([
        fetchWatchlistShows(user.id),
        fetchWatchlistMovies(user.id),
      ])
      return { shows, movies }
    },
    staleTime: 1000 * 60 * 5,
    enabled: !!user,
  })
}

// ── Fetch custom lists ──

async function fetchLists(): Promise<List[]> {
  const { data, error } = await supabase
    .from('lists')
    .select('*')
    .order('name')

  if (error) throw new Error(error.message)
  return data ?? []
}

export function useCustomLists() {
  const { user } = useAuth()

  return useQuery({
    queryKey: profileKeys.lists(user?.id ?? ''),
    queryFn: fetchLists,
    staleTime: 1000 * 60 * 5,
    enabled: !!user,
  })
}

// ── Mark show watched ──

export function useMarkWatched() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const setImportStarted = useAppStore((s) => s.setImportStarted)

  return useMutation({
    mutationFn: async (showId: string) => {
      if (!user) throw new Error('Not authenticated')
      // Increment episodes_seen
      const { data: current } = await supabase
        .from('user_shows')
        .select('episodes_seen')
        .eq('show_id', showId)
        .eq('user_id', user.id)
        .single()

      const newCount = (current?.episodes_seen ?? 0) + 1

      const { error } = await supabase
        .from('user_shows')
        .upsert(
          {
            show_id: showId,
            user_id: user.id,
            episodes_seen: newCount,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'show_id,user_id' }
        )

      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shows'] })
      queryClient.invalidateQueries({ queryKey: ['profile'] })
    },
  })
}