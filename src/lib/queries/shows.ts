// ─── Shows Tab — React Query hooks ───

import { useQuery, useMutation, useQueryClient, QueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { getImageUrl } from '@/lib/tmdb'
import { useAuth } from '@/contexts/AuthContext'
import { episodeKeys } from './episodes'
import { profileKeys } from './profile'
import type { Show, UserShow } from '@/types'

// ── Types for joined query result ──

export interface ShowWithUserData extends Show {
  user_shows: UserShow | null
  episodes_seen: number
  is_following: boolean
  is_favorited: boolean
  is_watchlist: boolean
  last_watched_episode_data: UserShow['last_watched_episode_data']
}

function mapRow(row: any): ShowWithUserData {
  // PostgREST returns to-many relationships as arrays, even with !inner
  const usRaw = row.user_shows
  const us = Array.isArray(usRaw) ? (usRaw[0] ?? {}) : (usRaw ?? {})
  return {
    id: row.id,
    tmdb_id: row.tmdb_id,
    tvdb_id: row.tvdb_id,
    name: row.name,
    status: row.status,
    poster_path: row.poster_path,
    total_episodes: row.total_episodes,
    last_air_date: row.last_air_date,
    average_runtime: row.average_runtime ?? null,
    // User show data
    user_shows: us,
    episodes_seen: us.episodes_seen ?? 0,
    is_following: us.is_following ?? true,
    is_favorited: us.is_favorited ?? false,
    is_watchlist: us.is_watchlist ?? false,
    last_watched_episode_data: us.last_watched_episode_data ?? null,
  }
}

// ── Query keys ──

export const showKeys = {
  all: ['shows'] as const,
  list: (userId: string) => ['shows', 'list', userId] as const,
  continueWatching: (userId: string) => ['shows', 'continue-watching', userId] as const,
  detail: (id: string) => ['shows', 'detail', id] as const,
}

// ── Fetch all shows (with user data join) ──

async function fetchShows(
  userId: string,
  queryClient?: QueryClient
): Promise<ShowWithUserData[]> {
  // Use inner join to only get shows that have user_shows for this user
  let query = supabase
    .from('shows')
    .select('*, user_shows!inner(*)')
    .eq('user_shows.user_id', userId)

  const { data, error } = await query

  console.log('🔍 [fetchShows] Query result:', { dataLength: data?.length, error: error?.message })

  if (error) throw new Error(`Failed to fetch shows: ${error.message}`)
  if (!data) return []

  let result = data.map(mapRow)

  console.log('🔍 [fetchShows] After mapping:', { count: result.length, watchlist: result.filter(s => s.is_watchlist).length })

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
      .eq('user_id', userId)
      .in('show_id', showIds)

    const counts = new Map<string, number>()
    for (const row of watchedEps ?? []) {
      counts.set(row.show_id, (counts.get(row.show_id) ?? 0) + 1)
    }

    const updates: Promise<{ error: any }>[] = []
    for (const show of result) {
      const actual = counts.get(show.id) ?? 0
      // Only protect if we have no watched data in this app, but had imported count
      const newCount = (actual === 0 && show.episodes_seen > 0) ? show.episodes_seen : actual
      if (newCount !== show.episodes_seen) {
        show.episodes_seen = newCount
        // Wrap in Promise.resolve to handle PromiseLike from Postgrest
        updates.push(
          Promise.resolve(
            supabase
              .from('user_shows')
              .upsert({ show_id: show.id, episodes_seen: newCount, is_following: true, user_id: userId }, { onConflict: 'show_id,user_id' })
          ).then((r) => ({ error: r.error }))
        )
      }
    }
    if (updates.length > 0) {
      await Promise.all(updates)

      // Also patch the continue-watching cache so the UI is consistent
      if (queryClient) {
        const cwCached = queryClient.getQueryData<ShowWithUserData[]>(showKeys.continueWatching(userId))
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
            queryClient.setQueryData(showKeys.continueWatching(userId), updated)
          }
        }
      }
    }
  }

  // Sort: last watched first (by updated_at desc), then alphabetical
  return sortShows(result)
}

export function useShows() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useQuery({
    queryKey: showKeys.list(user?.id ?? ''),
    queryFn: ({ queryKey }) => {
      const [, , userId] = queryKey as unknown as [string, string, string]
      return fetchShows(userId, queryClient)
    },
    staleTime: 1000 * 60 * 2, // 2 min
    enabled: !!user,
  })
}

// ── Fetch single show by ID ──

async function fetchShow(
  id: string,
  userId: string,
  queryClient?: QueryClient
): Promise<ShowWithUserData | null> {
  // Support both UUID and TMDb ID lookups
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)

  let query = supabase
    .from('shows')
    .select('*, user_shows!inner(*)')
    .eq('user_shows.user_id', userId)

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
    .eq('user_id', userId)
    .eq('watched', true)

  const count = rawCount ?? 0

  const usDetail = Array.isArray(data.user_shows) ? (data.user_shows[0] ?? {}) : (data.user_shows ?? {})
  if (usDetail) {
    // Only protect if we have no watched data in this app, but had imported count
    const newCount = (count === 0 && (usDetail.episodes_seen ?? 0) > 0) ? (usDetail.episodes_seen ?? 0) : count
    if (newCount !== usDetail.episodes_seen) {
      await supabase
        .from('user_shows')
        .update({ episodes_seen: newCount })
        .eq('show_id', data.id)
        .eq('user_id', userId)
      usDetail.episodes_seen = newCount
      data.user_shows = usDetail

      // Propagate the fix to all cached list copies
      if (queryClient) {
        const cached = queryClient.getQueryData<ShowWithUserData[]>(showKeys.list(userId))
        if (cached) {
          const updated = cached.map((s) =>
            s.id === data.id ? { ...s, episodes_seen: newCount } : s
          )
          queryClient.setQueryData(showKeys.list(userId), updated)
        }
        const cwCached = queryClient.getQueryData<ShowWithUserData[]>(showKeys.continueWatching(userId))
        if (cwCached) {
          const updated = cwCached.map((s) =>
            s.id === data.id ? { ...s, episodes_seen: newCount } : s
          )
          queryClient.setQueryData(showKeys.continueWatching(userId), updated)
        }
      }
    }
  }

  return mapRow(data)
}

export function useShow(id: string) {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useQuery({
    queryKey: showKeys.detail(id),
    queryFn: () => fetchShow(id, user?.id ?? '', queryClient),
    staleTime: 1000 * 60 * 2,
    enabled: !!user,
    // Use placeholderData (not initialData) so the query stays in pending state
    // when no cache is available — avoids React Query v5 treating undefined
    // initialData as a "success" state with no data.
    placeholderData: () => {
      if (!user) return undefined
      // Check the list cache
      const cached = queryClient.getQueryData<ShowWithUserData[]>(
        showKeys.list(user.id)
      )
      if (cached) {
        const found = cached.find((s) => s.id === id)
        if (found) return found
      }
      // Also check continue watching cache
      const cwCached = queryClient.getQueryData<ShowWithUserData[]>(
        showKeys.continueWatching(user.id)
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

async function fetchContinueWatching(userId: string): Promise<ShowWithUserData[]> {
  const { data, error } = await supabase
    .from('shows')
    .select('*, user_shows!inner(*)')
    .eq('user_shows.user_id', userId)
    .not('user_shows.last_watched_episode_data', 'is', null)
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
      .eq('user_id', userId)
      .in('show_id', showIds)

    const counts = new Map<string, number>()
    for (const row of watchedEps ?? []) {
      counts.set(row.show_id, (counts.get(row.show_id) ?? 0) + 1)
    }

    for (const show of result) {
      const actual = counts.get(show.id) ?? 0
      // Only protect if we have no watched data in this app, but had imported count
      const newCount = (actual === 0 && show.episodes_seen > 0) ? show.episodes_seen : actual
      if (newCount !== show.episodes_seen) {
        show.episodes_seen = newCount
        supabase
          .from('user_shows')
          .upsert({ show_id: show.id, episodes_seen: newCount, is_following: true, user_id: userId }, { onConflict: 'show_id,user_id' })
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

  return result
}

export function useContinueWatching() {
  const { user } = useAuth()

  return useQuery({
    queryKey: showKeys.continueWatching(user?.id ?? ''),
    queryFn: () => fetchContinueWatching(user?.id ?? ''),
    staleTime: 1000 * 60 * 2,
    enabled: !!user,
  })
}

// ── Mark next episode as watched ──

async function markEpisodeWatched(
  showId: string,
  userId: string,
  seasonNumber?: number,
  episodeNumber?: number
): Promise<void> {
  // 1. Get current episodes_seen + last_watched_episode_data
  const { data: us, error: fetchError } = await supabase
    .from('user_shows')
    .select('episodes_seen, last_watched_episode_data')
    .eq('show_id', showId)
    .eq('user_id', userId)
    .single()

  if (fetchError && fetchError.code !== 'PGRST116') {
    throw new Error(`Failed to fetch user_shows: ${fetchError.message}`)
  }

  const currentSeen = us?.episodes_seen ?? 0

  // 2. Determine effective season/episode
  //    If caller provided them (EpisodeCard), use those.
  //    Otherwise infer from last_watched_episode_data (ShowCard fallback).
  const effSeason = seasonNumber ?? us?.last_watched_episode_data?.season_number ?? 0
  const effEpisode =
    episodeNumber ??
    (us?.last_watched_episode_data?.episode_number != null
      ? us.last_watched_episode_data.episode_number + 1
      : currentSeen + 1)

  // 3. Insert user_episodes row FIRST (before incrementing episodes_seen)
  //    Uses upsert so duplicate calls are idempotent.
  const { error: insertError } = await supabase.from('user_episodes').upsert(
    {
      show_id: showId,
      user_id: userId,
      season_number: effSeason,
      episode_number: effEpisode,
      watched: true,
      watched_at: new Date().toISOString(),
    },
    { onConflict: 'show_id, season_number, episode_number, user_id' }
  )

  if (insertError) {
    console.warn(`Failed to insert user_episode: ${insertError.message}`)
    // Don't throw — the episodes_seen increment will reconcile on next sync
  }

  // 4. Increment episodes_seen + set last_watched_episode_data
  //    Done after the insert so the counter never inflates on duplicate calls.
  const { error: updateError } = await supabase
    .from('user_shows')
    .upsert(
      {
        show_id: showId,
        user_id: userId,
        episodes_seen: currentSeen + 1,
        last_watched_episode_data: {
          season_number: effSeason,
          episode_number: effEpisode,
          watched_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        is_following: true,
        is_watchlist: true,
      },
      { onConflict: 'show_id,user_id' }
    )

  if (updateError) throw new Error(`Failed to update episodes_seen: ${updateError.message}`)
}

export function useMarkWatched() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      showId,
      seasonNumber,
      episodeNumber,
    }: {
      showId: string
      seasonNumber?: number
      episodeNumber?: number
    }) => markEpisodeWatched(showId, user?.id ?? '', seasonNumber, episodeNumber),

    onMutate: async ({ showId, seasonNumber, episodeNumber }) => {
      if (!user) return

      // Cancel in-flight refetches so they don't clobber our optimistic write
      await queryClient.cancelQueries({ queryKey: showKeys.all })

      // Snapshot previous data for rollback
      const snapshot: { key: unknown[] | readonly unknown[]; data: ShowWithUserData[] | undefined }[] = []
      const key = showKeys.list(user.id)
      const prev = queryClient.getQueryData<ShowWithUserData[]>(key)
      snapshot.push({ key, data: prev })
      if (prev) {
        queryClient.setQueryData<ShowWithUserData[]>(
          key,
          prev.map((s) =>
            s.id === showId
              ? {
                  ...s,
                  episodes_seen: s.episodes_seen + 1,
                  last_watched_episode_data:
                    seasonNumber != null && episodeNumber != null
                      ? {
                          season_number: seasonNumber,
                          episode_number: episodeNumber,
                          watched_at: new Date().toISOString(),
                          updated_at: new Date().toISOString(),
                        }
                      : s.last_watched_episode_data,
                }
              : s
          )
        )
      }

      // Also snapshot continue-watching cache
      const cwKey = showKeys.continueWatching(user.id)
      const cwPrev = queryClient.getQueryData<ShowWithUserData[]>(cwKey)
      snapshot.push({ key: cwKey, data: cwPrev })
      if (cwPrev) {
        queryClient.setQueryData<ShowWithUserData[]>(
          cwKey,
          cwPrev.map((s) =>
            s.id === showId
              ? {
                  ...s,
                  episodes_seen: s.episodes_seen + 1,
                  last_watched_episode_data:
                    seasonNumber != null && episodeNumber != null
                      ? {
                          season_number: seasonNumber,
                          episode_number: episodeNumber,
                          watched_at: new Date().toISOString(),
                          updated_at: new Date().toISOString(),
                        }
                      : s.last_watched_episode_data,
                }
              : s
          )
        )
      }

      return { snapshot }
    },

    onError: (_err, _vars, context) => {
      if (!context?.snapshot) return
      for (const { key, data } of context.snapshot) {
        if (data) {
          queryClient.setQueryData(key, data)
        }
      }
    },

    onSettled: (_data, _error, { showId }) => {
      const uid = user?.id ?? ''
      // Refetch to reconcile with server
      queryClient.invalidateQueries({ queryKey: showKeys.list(uid) })
      queryClient.invalidateQueries({ queryKey: showKeys.continueWatching(uid) })
      // Also sync the detail page cache so checkmarks show correctly
      queryClient.invalidateQueries({ queryKey: showKeys.detail(showId) })
      // Refresh watched history so new entry appears at top
      queryClient.invalidateQueries({ queryKey: episodeKeys.all })
    },
  })
}

// ── Toggle favorite ──

async function toggleFavorite(showId: string, userId: string): Promise<void> {
  const { data: us } = await supabase
    .from('user_shows')
    .select('is_favorited')
    .eq('show_id', showId)
    .eq('user_id', userId)
    .single()

  const current = us?.is_favorited ?? false
  const newValue = !current

  await supabase
    .from('user_shows')
    .update({
      is_favorited: newValue,
      favorited_at: newValue ? new Date().toISOString() : null,
    })
    .eq('show_id', showId)
    .eq('user_id', userId)
}

export function useToggleFavorite() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (showId: string) => toggleFavorite(showId, user?.id ?? ''),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: showKeys.all })
      if (user) {
        queryClient.invalidateQueries({ queryKey: profileKeys.favorites(user.id) })
      }
    },
  })
}

// ── Update show average_runtime ──

async function updateShowRuntime(showId: string, averageRuntime: number): Promise<void> {
  const { error } = await supabase
    .from('shows')
    .update({ average_runtime: averageRuntime })
    .eq('id', showId)

  if (error) throw new Error(`Failed to update show runtime: ${error.message}`)
}

export function useUpdateShowRuntime() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ showId, averageRuntime }: { showId: string; averageRuntime: number }) =>
      updateShowRuntime(showId, averageRuntime),
    onSuccess: (_data, { showId }) => {
      queryClient.invalidateQueries({ queryKey: showKeys.detail(showId) })
    },
  })
}

export { getImageUrl }

// ── Section Derivation Helpers ──

export interface NextEpisodeInfo {
  showId: string
  showName: string
  posterPath: string | null
  seasonNumber: number
  episodeNumber: number
  showStatus: string | null
  totalEpisodes: number | null
  tmdbId: number | null
  episodesRemaining: number | null
  airDate?: string | null // Added
}

/**
 * Compute the next unwatched episode for a show.
 * Returns null if the show is complete (all episodes watched, status Ended/Canceled).
 */
export function computeNextEpisode(show: ShowWithUserData): NextEpisodeInfo | null {
  const totalEps = show.total_episodes

  // If show is complete (ended/canceled and all episodes seen), no next episode
  // totalEps > 0 prevents shows with unpopulated episode counts (temporary 0) from disappearing
  if ((show.status === 'Ended' || show.status === 'Canceled') && totalEps != null && totalEps > 0 && show.episodes_seen >= totalEps) {
    return null
  }

  // If the show has exceeded its total episodes somehow, no next episode
  if (totalEps != null && totalEps > 0 && show.episodes_seen >= totalEps) {
    return null
  }

  // Calculate remaining episodes
  const episodesRemaining = totalEps != null ? Math.max(0, totalEps - show.episodes_seen) : null

  // If nothing watched yet, start at S01E01
  if (show.episodes_seen === 0) {
    return {
      showId: show.id,
      showName: show.name,
      posterPath: show.poster_path,
      seasonNumber: 1,
      episodeNumber: 1,
      showStatus: show.status,
      totalEpisodes: totalEps,
      tmdbId: show.tmdb_id,
      episodesRemaining,
    }
  }

  // Use last_watched_episode_data for precise next episode
  const lastData = show.last_watched_episode_data
  if (lastData?.season_number != null && lastData?.episode_number != null) {
    return {
      showId: show.id,
      showName: show.name,
      posterPath: show.poster_path,
      seasonNumber: lastData.season_number,
      episodeNumber: lastData.episode_number + 1,
      showStatus: show.status,
      totalEpisodes: totalEps,
      tmdbId: show.tmdb_id,
      episodesRemaining,
    }
  }

  // Fallback: use episodes_seen as episode number with season 0 (unknown)
  // This is imprecise but preserves the UI
  return {
    showId: show.id,
    showName: show.name,
    posterPath: show.poster_path,
    seasonNumber: 0,
    episodeNumber: show.episodes_seen + 1,
    showStatus: show.status,
    totalEpisodes: totalEps,
    tmdbId: show.tmdb_id,
    episodesRemaining,
  }
}

/** Check if a show hasn't been watched for 14+ days (or never watched) */
export function isHaventWatched(show: ShowWithUserData): boolean {
  // Never watched — definitely "haven't watched"
  if (show.episodes_seen === 0) return true

  // Not just added but never started — check last_watched timestamp
  if (!show.last_watched_episode_data?.watched_at) return false

  const watchedAt = new Date(show.last_watched_episode_data.watched_at)
  const daysSinceWatched = (Date.now() - watchedAt.getTime()) / (1000 * 60 * 60 * 24)
  return daysSinceWatched >= 14
}

/** Derive "Watch Next" episodes from show list */
export function deriveWatchNextEpisodes(shows: ShowWithUserData[]): NextEpisodeInfo[] {
  return shows
    .map(computeNextEpisode)
    .filter((ep): ep is NextEpisodeInfo => ep !== null)
}

/** Derive "Haven't Watched" episodes from show list */
export function deriveHaventWatchedEpisodes(shows: ShowWithUserData[]): NextEpisodeInfo[] {
  return shows
    .filter(isHaventWatched)
    .map(computeNextEpisode)
    .filter((ep): ep is NextEpisodeInfo => ep !== null)
}