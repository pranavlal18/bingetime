// ─── Shows Tab — React Query hooks ───

import { useQuery, useMutation, useQueryClient, QueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { getImageUrl, getShowBasicDetails } from '@/lib/tmdb'
import { useAuth } from '@/contexts/AuthContext'
import { showKeys, episodeKeys, type ShowWithUserData, type NextAirEpisode, profileKeys } from './sharedTypes'

export type { ShowWithUserData, NextAirEpisode }

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
    episodes_seen: us.episodes_seen ?? 0,
    is_following: us.is_following ?? true,
    is_favorited: us.is_favorited ?? false,
    is_watchlist: us.is_watchlist ?? false,
    last_watched_episode_data: us.last_watched_episode_data ?? null,
    created_at: us.created_at ?? null,
    next_air_episode: null, // Enriched later in fetchShows
  }
}

// ── Fetch all shows (with user data join) ───

async function fetchShows(
  userId: string,
  queryClient?: QueryClient
): Promise<ShowWithUserData[]> {
  // Query from user_shows (user's library) with join to shows
  // This ensures ALL shows in user's library are returned, not just is_watchlist=true
  let query = supabase
    .from('user_shows')
    .select(`
      episodes_seen,
      is_favorited,
      is_following,
      is_watchlist,
      last_watched_episode_data,
      created_at,
      shows!inner(
        id,
        tmdb_id,
        tvdb_id,
        name,
        status,
        poster_path,
        total_episodes,
        last_air_date,
        average_runtime
      )
    `)
    .eq('user_id', userId)

  const { data, error } = await query

  console.log('🔍 [fetchShows] Query result:', { dataLength: data?.length, error: error?.message })

  if (error) throw new Error(`Failed to fetch shows: ${error.message}`)
  if (!data) return []

  let result = data.map((row: any) => {
    const show = Array.isArray(row.shows) ? row.shows[0] : row.shows
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
      // User show data
      user_shows: row,
      episodes_seen: row.episodes_seen ?? 0,
      is_following: row.is_following ?? true,
      is_favorited: row.is_favorited ?? false,
      is_watchlist: row.is_watchlist ?? true, // Default to true for library visibility
      last_watched_episode_data: row.last_watched_episode_data ?? null,
      created_at: row.created_at ?? null,
      next_air_episode: null, // Enriched later if needed
    }
  })

  console.log('🔍 [fetchShows] After mapping:', { count: result.length, watchlist: result.filter(s => s.is_watchlist).length })

  // NO FILTER - show ALL shows in user's library (user_shows table IS the library)
  // The is_watchlist filter was hiding shows that were imported without that flag

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

      // Also patch the caches so the UI is consistent
      if (queryClient) {
        // Patch the main list cache
        const listCached = queryClient.getQueryData<ShowWithUserData[]>(showKeys.list(userId))
        if (listCached) {
          const listMap = new Map(result.map((s) => [s.id, s.episodes_seen]))
          let listChanged = false
          const listUpdated = listCached.map((s) => {
            const fixed = listMap.get(s.id)
            if (fixed !== undefined && fixed !== s.episodes_seen) {
              listChanged = true
              return { ...s, episodes_seen: fixed }
            }
            return s
          })
          if (listChanged) {
            queryClient.setQueryData(showKeys.list(userId), listUpdated)
          }
        }

        // Patch the continue-watching cache
        const cwCached = queryClient.getQueryData<ShowWithUserData[]>(showKeys.continueWatching(userId))
        if (cwCached) {
          const cwMap = new Map(result.map((s) => [s.id, s.episodes_seen]))
          let cwChanged = false
          const cwUpdated = cwCached.map((s) => {
            const fixed = cwMap.get(s.id)
            if (fixed !== undefined && fixed !== s.episodes_seen) {
              cwChanged = true
              return { ...s, episodes_seen: fixed }
            }
            return s
          })
          if (cwChanged) {
            queryClient.setQueryData(showKeys.continueWatching(userId), cwUpdated)
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
    enabled: !!user && !!id,
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

  // ── Enrich with TMDb next_episode_to_air (for "new season" detection) ──
  // Only 10 items max, so no batching needed
  const airCandidates = result.filter(s =>
    s.tmdb_id != null && s.episodes_seen > 0 &&
    (s.total_episodes == null || s.episodes_seen < s.total_episodes)
  )
  await Promise.all(
    airCandidates.map(async (show) => {
      try {
        const details = await getShowBasicDetails(show.tmdb_id!)
        const next = details?.next_episode_to_air
        if (next?.air_date) {
          show.next_air_episode = {
            season_number: next.season_number,
            episode_number: next.episode_number,
            name: next.name || null,
            air_date: next.air_date,
          }
        }
      } catch {
        // Silently ignore — badge just won't show
      }
    })
  )

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
      // Refresh stats (weekly chart, watch time, catch-up rate, etc.)
      queryClient.invalidateQueries({ queryKey: ['stats'] })
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

/** Check if a show hasn't been watched for 21+ days (or never started after 21 days) */
const HAVENT_WATCHED_THRESHOLD_DAYS = 21

export function isHaventWatched(show: ShowWithUserData): boolean {
  // Only consider shows in the user's watchlist
  if (!show.is_watchlist) return false

  // Never watched any episode
  if (show.episodes_seen === 0) {
    // Check if added 21+ days ago (never started) using created_at
    if (show.created_at) {
      const daysSinceAdded = (Date.now() - new Date(show.created_at).getTime()) / (1000 * 60 * 60 * 24)
      return daysSinceAdded >= HAVENT_WATCHED_THRESHOLD_DAYS
    }
    return false
  }

  // Has watched at least once - check 21-day gap since last watch
  const lastData = show.last_watched_episode_data
  if (!lastData) return false

  // Fall back to updated_at if watched_at isn't set (imported shows)
  const dateStr = lastData.watched_at || lastData.updated_at
  if (!dateStr) return false

  const watchedAt = new Date(dateStr)
  const daysSinceWatched = (Date.now() - watchedAt.getTime()) / (1000 * 60 * 60 * 24)
  return daysSinceWatched >= HAVENT_WATCHED_THRESHOLD_DAYS
}

// ── New Season Detection (async, non-blocking) ──

/**
 * Hook that batch-fetches TMDb next_episode_to_air for shows and returns
 * a list of showIds that have a new season premiere (episode 1 of a season
 * higher than what the user last watched).
 *
 * Runs independently — does NOT block initial render.
 */
export function useNewSeasonIds(): string[] {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const { data } = useQuery({
    queryKey: ['shows', 'new-season-ids', user?.id],
    queryFn: async () => {
      if (!user) return []

      const shows = queryClient.getQueryData<ShowWithUserData[]>(showKeys.list(user.id))
      if (!shows) return []

      // Only check shows being watched that aren't complete
      const candidates = shows.filter(s =>
        s.tmdb_id != null && s.episodes_seen > 0 &&
        (s.total_episodes == null || s.episodes_seen < s.total_episodes)
      )

      const newSeasonIds: string[] = []

      for (let i = 0; i < candidates.length; i += 4) {
        const batch = candidates.slice(i, i + 4)
        const results = await Promise.all(
          batch.map(async (show) => {
            try {
              const details = await getShowBasicDetails(show.tmdb_id!)
              const next = details?.next_episode_to_air
              if (!next?.air_date) return null
              if (next.episode_number !== 1) return null // Not a premiere
              if (next.season_number <= 1) return null // S01E01 is just starting

              const lastSeason = show.last_watched_episode_data?.season_number
              if (lastSeason == null) return null
              if (next.season_number <= lastSeason) return null

              return show.id
            } catch {
              return null
            }
          })
        )
        for (const id of results) {
          if (id) newSeasonIds.push(id)
        }
        if (i + 4 < candidates.length) {
          await new Promise(r => setTimeout(r, 1000))
        }
      }

      return newSeasonIds
    },
    staleTime: 1000 * 60 * 60, // 1 hour
    enabled: !!user,
  })

  return data ?? []
}

/** Derive "Watch Next" episodes from show list */
export function deriveWatchNextEpisodes(shows: ShowWithUserData[]): NextEpisodeInfo[] {
  return shows
    .filter((s) => !isHaventWatched(s)) // Exclude shows that belong in "Haven't Watched"
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