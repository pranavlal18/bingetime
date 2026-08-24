import { QueryClient } from '@tanstack/react-query'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { mmkvAsyncStorage } from './mmkv'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 60 * 24,
      retry: 2,
      networkMode: 'offlineFirst',
    },
  },
})

// MMKV persister — sync reads, ~30MB limit, fast. The async adapter lazily
// migrates legacy AsyncStorage cache on first read.
export const mmkvPersister = createAsyncStoragePersister({
  storage: mmkvAsyncStorage,
  throttleTime: 1000,
})

// Slim projection for shows:list to keep persisted size < 2MB
export function slimShowsForPersist(data: any): any {
  if (!Array.isArray(data)) return data
  // Keep only fields needed for Watch Next rendering
  return data.map((s: any) => ({
    id: s.id,
    tmdb_id: s.tmdb_id,
    tvdb_id: s.tvdb_id,
    name: s.name,
    status: s.status,
    poster_path: s.poster_path,
    total_episodes: s.total_episodes,
    last_air_date: s.last_air_date,
    average_runtime: s.average_runtime,
    genres: s.genres,
    episodes_seen: s.episodes_seen,
    is_following: s.is_following,
    is_favorited: s.is_favorited,
    is_watchlist: s.is_watchlist,
    last_watched_episode_data: s.last_watched_episode_data,
    created_at: s.created_at,
    // keep next_air_episode if already enriched
    next_air_episode: s.next_air_episode ?? null,
  }))
}