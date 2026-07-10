// ─── Shows Tab — React Query hooks ───

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { getImageUrl } from '@/lib/tmdb'
import type { Show, UserShow } from '@/types'

// ── Types for joined query result ──

export interface ShowWithUserData extends Show {
  user_shows: UserShow | null
  episodes_seen: number
  is_following: boolean
  is_favorited: boolean
  is_watchlist: boolean
  archived: boolean
  last_watched_episode_data: UserShow['last_watched_episode_data']
}

function mapRow(row: any): ShowWithUserData {
  const us = row.user_shows || {}
  return {
    id: row.id,
    tmdb_id: row.tmdb_id,
    tvdb_id: row.tvdb_id,
    name: row.name,
    status: row.status,
    poster_path: row.poster_path,
    total_episodes: row.total_episodes,
    last_air_date: row.last_air_date,
    // User show data
    user_shows: us,
    episodes_seen: us.episodes_seen ?? 0,
    is_following: us.is_following ?? true,
    is_favorited: us.is_favorited ?? false,
    is_watchlist: us.is_watchlist ?? false,
    archived: us.archived ?? false,
    last_watched_episode_data: us.last_watched_episode_data ?? null,
  }
}

// ── Query keys ──

export const showKeys = {
  all: ['shows'] as const,
  list: (showArchived: boolean) => ['shows', 'list', { showArchived }] as const,
  continueWatching: ['shows', 'continue-watching'] as const,
}

// ── Fetch all shows (with user data join) ──

async function fetchShows(showArchived: boolean): Promise<ShowWithUserData[]> {
  let query = supabase
    .from('shows')
    .select('*, user_shows(*)')

  if (!showArchived) {
    // Only show non-archived shows
    query = query.not('user_shows.archived', 'eq', true)
    // Also include shows without user_shows entry (archived defaults to false)
  }

  const { data, error } = await query

  if (error) throw new Error(`Failed to fetch shows: ${error.message}`)
  if (!data) return []

  let result = data.map(mapRow)

  // Filter: if not showing archived, exclude archived
  if (!showArchived) {
    result = result.filter((s) => !s.archived)
  }

  // Sort: last watched first (by updated_at desc), then alphabetical
  return sortShows(result)
}

export function useShows(showArchived: boolean) {
  return useQuery({
    queryKey: showKeys.list(showArchived),
    queryFn: () => fetchShows(showArchived),
    staleTime: 1000 * 60 * 2, // 2 min
  })
}

// ── Fetch single show by ID ──

async function fetchShow(id: string): Promise<ShowWithUserData> {
  const { data, error } = await supabase
    .from('shows')
    .select('*, user_shows(*)')
    .eq('id', id)
    .single()

  if (error) throw new Error(`Failed to fetch show: ${error.message}`)
  return mapRow(data)
}

export function useShow(id: string) {
  const queryClient = useQueryClient()

  return useQuery({
    queryKey: ['shows', 'detail', id],
    queryFn: () => fetchShow(id),
    staleTime: 1000 * 60 * 2,
    // Use placeholderData (not initialData) so the query stays in pending state
    // when no cache is available — avoids React Query v5 treating undefined
    // initialData as a "success" state with no data.
    placeholderData: () => {
      // Check both archived filter states
      for (const archived of [true, false]) {
        const cached = queryClient.getQueryData<ShowWithUserData[]>(
          showKeys.list(archived)
        )
        if (cached) {
          const found = cached.find((s) => s.id === id)
          if (found) return found
        }
      }
      // Also check continue watching cache
      const cwCached = queryClient.getQueryData<ShowWithUserData[]>(
        showKeys.continueWatching
      )
      if (cwCached) {
        const found = cwCached.find((s) => s.id === id)
        if (found) return found
      }
      return undefined
    },
  })
}

// ── Sort: last watched first (by updated_at desc), then alphabetical ──

function sortShows(shows: ShowWithUserData[]): ShowWithUserData[] {
  return [...shows].sort((a, b) => {
    const aDate = a.last_watched_episode_data?.updated_at
    const bDate = b.last_watched_episode_data?.updated_at
    if (aDate && !bDate) return -1
    if (!aDate && bDate) return 1
    if (aDate && bDate) {
      const cmp = bDate.localeCompare(aDate)
      if (cmp !== 0) return cmp
    }
    return a.name.localeCompare(b.name)
  })
}

// ── Fetch continue-watching shows ──

async function fetchContinueWatching(): Promise<ShowWithUserData[]> {
  const { data, error } = await supabase
    .from('shows')
    .select('*, user_shows(*)')
    .not('user_shows.last_watched_episode_data', 'is', null)
    .not('user_shows.archived', 'eq', true)
    .order('name', { ascending: true })
    .limit(10)

  if (error) throw new Error(`Failed to fetch continue watching: ${error.message}`)
  if (!data) return []

  const result = data.map(mapRow)

  // Sort by most recent last_watched_episode_data.updated_at
  result.sort((a, b) => {
    const aDate = a.last_watched_episode_data?.updated_at
    const bDate = b.last_watched_episode_data?.updated_at
    if (!aDate && !bDate) return 0
    if (!aDate) return 1
    if (!bDate) return -1
    return bDate.localeCompare(aDate)
  })

  return result.filter((s) => !s.archived)
}

export function useContinueWatching() {
  return useQuery({
    queryKey: showKeys.continueWatching,
    queryFn: fetchContinueWatching,
    staleTime: 1000 * 60 * 2,
  })
}

// ── Mark next episode as watched ──

async function markEpisodeWatched(showId: string): Promise<void> {
  // 1. Get current episodes_seen
  const { data: us, error: fetchError } = await supabase
    .from('user_shows')
    .select('episodes_seen')
    .eq('show_id', showId)
    .single()

  if (fetchError && fetchError.code !== 'PGRST116') {
    throw new Error(`Failed to fetch user_shows: ${fetchError.message}`)
  }

  const currentSeen = us?.episodes_seen ?? 0

  // 2. Increment episodes_seen
  const { error: updateError } = await supabase
    .from('user_shows')
    .upsert(
      {
        show_id: showId,
        episodes_seen: currentSeen + 1,
        is_following: true,
      },
      { onConflict: 'show_id' }
    )

  if (updateError) throw new Error(`Failed to update episodes_seen: ${updateError.message}`)

  // 3. Insert a user_episodes row (we don't know exact season/ep without episodes table,
  //    so we store a placeholder row with current timestamp)
  //    Later when we have the episodes table populated, we can reconcile.
  const { error: insertError } = await supabase.from('user_episodes').insert({
    show_id: showId,
    season_number: 0,
    episode_number: currentSeen + 1,
    watched: true,
    watched_at: new Date().toISOString(),
    rewatch_count: 0,
  })

  if (insertError) {
    // Non-fatal — the episodes_seen count is the important part
    console.warn(`Failed to insert user_episode: ${insertError.message}`)
  }
}

export function useMarkWatched() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (showId: string) => markEpisodeWatched(showId),
    onSuccess: () => {
      // Invalidate all shows queries to refresh
      queryClient.invalidateQueries({ queryKey: showKeys.all })
    },
  })
}

// ── Toggle favorite ──

async function toggleFavorite(showId: string): Promise<void> {
  const { data: us } = await supabase
    .from('user_shows')
    .select('is_favorited')
    .eq('show_id', showId)
    .single()

  const current = us?.is_favorited ?? false

  await supabase
    .from('user_shows')
    .update({ is_favorited: !current })
    .eq('show_id', showId)
}

export function useToggleFavorite() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (showId: string) => toggleFavorite(showId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: showKeys.all })
    },
  })
}

// ── Toggle archive ──

async function toggleArchive(showId: string): Promise<void> {
  const { data: us } = await supabase
    .from('user_shows')
    .select('archived')
    .eq('show_id', showId)
    .single()

  const current = us?.archived ?? false

  await supabase
    .from('user_shows')
    .update({ archived: !current })
    .eq('show_id', showId)
}

export function useToggleArchive() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (showId: string) => toggleArchive(showId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: showKeys.all })
    },
  })
}

export { getImageUrl }
