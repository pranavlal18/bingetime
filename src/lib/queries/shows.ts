// ─── Shows Tab — React Query hooks ───

import { useQuery, useMutation, useQueryClient, QueryClient } from '@tanstack/react-query'
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

async function fetchShows(showArchived: boolean, queryClient?: QueryClient): Promise<ShowWithUserData[]> {
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

  // Filter: only show items that are in the user's library
  result = result.filter((s) => s.is_watchlist)

  // ── Batch sync episodes_seen ──
  // Uses Math.max to NEVER decrease the counter:
  //   - Imported shows (counter > 0, no user_episodes rows) → protected
  //   - Toggled shows (counter = 0, user_episodes rows exist) → fixed
  const showIds = result.map((s) => s.id)
  if (showIds.length > 0) {
    const { data: watchedEps } = await supabase
      .from('user_episodes')
      .select('show_id')
      .eq('watched', true)
      .in('show_id', showIds)

    const counts = new Map<string, number>()
    for (const row of watchedEps ?? []) {
      counts.set(row.show_id, (counts.get(row.show_id) ?? 0) + 1)
    }

    const updates: Promise<{ error: any }>[] = []
    for (const show of result) {
      const actual = counts.get(show.id) ?? 0
      const newCount = Math.max(show.episodes_seen, actual)
      if (newCount !== show.episodes_seen) {
        show.episodes_seen = newCount
        updates.push(
          supabase
            .from('user_shows')
            .upsert({ show_id: show.id, episodes_seen: newCount, is_following: true }, { onConflict: 'show_id' })
        )
      }
    }
    if (updates.length > 0) {
      await Promise.all(updates)

      // Also patch the continue-watching cache so the UI is consistent
      if (queryClient) {
        const cwCached = queryClient.getQueryData<ShowWithUserData[]>(showKeys.continueWatching)
        if (cwCached) {
          const cwMap = new Map(result.map((s) => [s.id, s.episodes_seen]))
          let changed = false
          const updated = cwCached.map((s) => {
            const fixed = cwMap.get(s.id)
            if (fixed !== undefined && fixed !== s.episodes_seen) {
              changed = true
              return { ...s, episodes_seen: fixed }
            }
            return s
          })
          if (changed) {
            queryClient.setQueryData(showKeys.continueWatching, updated)
          }
        }
      }
    }
  }

  // Sort: last watched first (by updated_at desc), then alphabetical
  return sortShows(result)
}

export function useShows(showArchived: boolean) {
  const queryClient = useQueryClient()

  return useQuery({
    queryKey: showKeys.list(showArchived),
    queryFn: ({ queryKey }) => fetchShows(showArchived, queryClient),
    staleTime: 1000 * 60 * 2, // 2 min
  })
}

// ── Fetch single show by ID ──

async function fetchShow(id: string, queryClient?: QueryClient): Promise<ShowWithUserData | null> {
  // Support both UUID and TMDb ID lookups
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)

  let query = supabase
    .from('shows')
    .select('*, user_shows(*)')

  if (isUuid) {
    query = query.eq('id', id)
  } else {
    const numId = parseInt(id, 10)
    if (isNaN(numId)) throw new Error(`Invalid show identifier: ${id}`)
    query = query.eq('tmdb_id', numId)
  }

  const { data, error } = await query.single()

  if (error) {
    // PGRST116 = not found — return null for TMDB fallback
    if (error.code === 'PGRST116') return null
    throw new Error(`Failed to fetch show: ${error.message}`)
  }

  // ── Sync episodes_seen ──
  // Uses Math.max to NEVER decrease the counter.
  const { count: rawCount } = await supabase
    .from('user_episodes')
    .select('*', { count: 'exact', head: true })
    .eq('show_id', data.id)
    .eq('watched', true)

  const count = rawCount ?? 0

  if (data.user_shows) {
    const newCount = Math.max(data.user_shows.episodes_seen ?? 0, count)
    if (newCount !== data.user_shows.episodes_seen) {
      await supabase
        .from('user_shows')
        .update({ episodes_seen: newCount })
        .eq('show_id', data.id)
      data.user_shows.episodes_seen = newCount

      // Propagate the fix to all cached list copies
      if (queryClient) {
        for (const archived of [true, false]) {
          const cached = queryClient.getQueryData<ShowWithUserData[]>(showKeys.list(archived))
          if (cached) {
            const updated = cached.map((s) =>
              s.id === data.id ? { ...s, episodes_seen: newCount } : s
            )
            queryClient.setQueryData(showKeys.list(archived), updated)
          }
        }
        const cwCached = queryClient.getQueryData<ShowWithUserData[]>(showKeys.continueWatching)
        if (cwCached) {
          const updated = cwCached.map((s) =>
            s.id === data.id ? { ...s, episodes_seen: newCount } : s
          )
          queryClient.setQueryData(showKeys.continueWatching, updated)
        }
      }
    }
  }

  return mapRow(data)
}

export function useShow(id: string) {
  const queryClient = useQueryClient()

  return useQuery({
    queryKey: ['shows', 'detail', id],
    queryFn: () => fetchShow(id, queryClient),
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

  let result = data.map(mapRow)

  // Only include items still in the user's library
  result = result.filter((s) => s.is_watchlist)

  // Batch sync episodes_seen — Math.max protects imported data
  const showIds = result.map((s) => s.id)
  if (showIds.length > 0) {
    const { data: watchedEps } = await supabase
      .from('user_episodes')
      .select('show_id')
      .eq('watched', true)
      .in('show_id', showIds)

    const counts = new Map<string, number>()
    for (const row of watchedEps ?? []) {
      counts.set(row.show_id, (counts.get(row.show_id) ?? 0) + 1)
    }

    for (const show of result) {
      const actual = counts.get(show.id) ?? 0
      const newCount = Math.max(show.episodes_seen, actual)
      if (newCount !== show.episodes_seen) {
        show.episodes_seen = newCount
        supabase
          .from('user_shows')
          .upsert({ show_id: show.id, episodes_seen: newCount, is_following: true }, { onConflict: 'show_id' })
          .then() // fire-and-forget, no await
      }
    }
  }

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
