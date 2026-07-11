// ─── Profile Tab — React Query hooks ───

import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { getImageUrl } from '@/lib/tmdb'
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
  favorited_at?: string
}

export interface WatchlistShow extends Show {
  episodes_seen: number
}

export interface WatchlistMovie extends Movie {
  watched: boolean
}

// ── Query keys ──

export const profileKeys = {
  stats: ['profile', 'stats'] as const,
  favorites: ['profile', 'favorites'] as const,
  watchlist: ['profile', 'watchlist'] as const,
  lists: ['profile', 'lists'] as const,
}

// ── Fetch stats ──

async function fetchStats(): Promise<ProfileStats> {
  const [showsResult, moviesResult, listsResult] = await Promise.all([
    supabase.from('user_shows').select('episodes_seen, is_favorited, is_watchlist'),
    supabase.from('user_movies').select('watched, is_watchlist'),
    supabase.from('lists').select('id', { count: 'exact', head: true }),
  ])

  if (showsResult.error) throw new Error(showsResult.error.message)
  if (moviesResult.error) throw new Error(moviesResult.error.message)

  const totalShows = showsResult.data.length
  const totalEpisodes = showsResult.data.reduce((sum, s) => sum + (s.episodes_seen ?? 0), 0)
  const favoritedShows = showsResult.data.filter((s) => s.is_favorited).length
  const watchlistShows = showsResult.data.filter((s) => s.is_watchlist).length
  const totalMovies = moviesResult.data.length
  const watchedMovies = moviesResult.data.filter((m) => m.watched).length
  const watchlistMovies = moviesResult.data.filter((m) => m.is_watchlist).length
  const customLists = listsResult.count ?? 0

  // Estimate watched hours: episodes avg 25min (0.42h) + movies avg 2h
  const totalHours = Math.round(totalEpisodes * 0.42 + watchedMovies * 2)

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
  return useQuery({
    queryKey: profileKeys.stats,
    queryFn: fetchStats,
    staleTime: 1000 * 60 * 5,
  })
}

// ── Fetch favorites ──

async function fetchFavorites(): Promise<FavoriteShow[]> {
  const { data, error } = await supabase
    .from('user_shows')
    .select('episodes_seen, shows(*)')
    .eq('is_favorited', true)

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
      episodes_seen: row.episodes_seen ?? 0,
    }
  })
}

export function useFavorites() {
  return useQuery({
    queryKey: profileKeys.favorites,
    queryFn: fetchFavorites,
    staleTime: 1000 * 60 * 5,
  })
}

// ── Fetch watchlist ──

async function fetchWatchlistShows(): Promise<WatchlistShow[]> {
  const { data, error } = await supabase
    .from('user_shows')
    .select('episodes_seen, shows(*)')
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
      episodes_seen: row.episodes_seen ?? 0,
    }
  })
}

async function fetchWatchlistMovies(): Promise<WatchlistMovie[]> {
  const { data, error } = await supabase
    .from('user_movies')
    .select('watched, movies(*)')
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
      watched: row.watched,
    }
  })
}

export function useWatchlist() {
  return useQuery({
    queryKey: profileKeys.watchlist,
    queryFn: async () => {
      const [shows, movies] = await Promise.all([
        fetchWatchlistShows(),
        fetchWatchlistMovies(),
      ])
      return { shows, movies }
    },
    staleTime: 1000 * 60 * 5,
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
  return useQuery({
    queryKey: profileKeys.lists,
    queryFn: fetchLists,
    staleTime: 1000 * 60 * 5,
  })
}

// ── Mark show watched (reuse from shows.ts) ──

export function useMarkWatched() {
  const queryClient = useQueryClient()
  const setImportStarted = useAppStore((s) => s.setImportStarted)

  return useMutation({
    mutationFn: async (showId: string) => {
      // Increment episodes_seen
      const { data: current } = await supabase
        .from('user_shows')
        .select('episodes_seen')
        .eq('show_id', showId)
        .single()

      const newCount = (current?.episodes_seen ?? 0) + 1

      const { error } = await supabase
        .from('user_shows')
        .upsert(
          {
            show_id: showId,
            episodes_seen: newCount,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'show_id' }
        )

      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shows'] })
      queryClient.invalidateQueries({ queryKey: ['profile'] })
    },
  })
}
