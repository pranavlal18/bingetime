// ─── Episode Browser — season + episode queries ───

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { getSeasonDetails } from '@/lib/tmdb'
import { useAuth } from '@/contexts/AuthContext'
import type { TMDbSeasonDetails, EpisodeCardData } from '@/types'
import { showKeys, type ShowWithUserData } from './shows'

// ── Types ──

export interface EpisodeWithStatus {
  episodeNumber: number
  title: string
  overview: string | null
  airDate: string | null
  stillPath: string | null
  watched: boolean
  watchedAt: string | null
}

export interface SeasonWithEpisodes {
  seasonNumber: number
  seasonName: string
  seasonOverview: string | null
  episodes: EpisodeWithStatus[]
}

// ── Query keys ──

export const episodeKeys = {
  all: ['episodes'] as const,
  season: (showId: string, tmdbId: number | null, seasonNumber: number, userId: string) =>
    ['episodes', 'season', showId, tmdbId, seasonNumber, userId] as const,
}

// ── Fetch season episodes + user watch status ──

async function fetchSeasonEpisodes(
  showId: string,
  tmdbId: number | null,
  seasonNumber: number,
  userId: string
): Promise<SeasonWithEpisodes> {
  // 1. Get TMDb season data
  let tmdbData: TMDbSeasonDetails | null = null
  if (tmdbId) {
    try {
      tmdbData = await getSeasonDetails(tmdbId, seasonNumber)
    } catch {
      // TMDb may not have this season — proceed with empty data
    }
  }

  // 2. Get user_episodes for this show and season (only if showId is a UUID)
  const watchedMap = new Map<number, { watched: boolean; watched_at: string | null }>()
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(showId)
  if (isUuid) {
    const { data: userEpisodes } = await supabase
      .from('user_episodes')
      .select('season_number, episode_number, watched, watched_at')
      .eq('show_id', showId)
      .eq('season_number', seasonNumber)
      .eq('user_id', userId)

    if (userEpisodes) {
      for (const ep of userEpisodes) {
        watchedMap.set(ep.episode_number, {
          watched: ep.watched,
          watched_at: ep.watched_at,
        })
      }
    }
  }

  // 3. Merge TMDb episodes with watched status
  const episodes: EpisodeWithStatus[] =
    tmdbData?.episodes?.map((ep) => {
      const userData = watchedMap.get(ep.episode_number)
      return {
        episodeNumber: ep.episode_number,
        title: ep.name || `Episode ${ep.episode_number}`,
        overview: ep.overview,
        airDate: ep.air_date,
        stillPath: ep.still_path,
        watched: userData?.watched ?? false,
        watchedAt: userData?.watched_at ?? null,
      }
    }) ?? []

  // Sort by episode number
  episodes.sort((a, b) => a.episodeNumber - b.episodeNumber)

  return {
    seasonNumber,
    seasonName: tmdbData?.name || `Season ${seasonNumber}`,
    seasonOverview: tmdbData?.overview ?? null,
    episodes,
  }
}

export function useSeasonEpisodes(
  showId: string,
  tmdbId: number | null,
  seasonNumber: number
) {
  const { user } = useAuth()

  return useQuery({
    queryKey: episodeKeys.season(showId, tmdbId, seasonNumber, user?.id ?? ''),
    queryFn: () => fetchSeasonEpisodes(showId, tmdbId, seasonNumber, user?.id ?? ''),
    enabled: !!user && (!!showId || !!tmdbId),
    staleTime: 1000 * 60 * 5,
  })
}

// ── Toggle episode watched status ──

async function updateEpisodesSeen(
  showId: string,
  userId: string,
  lastWatched?: { season_number: number; episode_number: number } | null
): Promise<void> {
  // Count watched episodes from the source of truth
  const { count, error: countError } = await supabase
    .from('user_episodes')
    .select('*', { count: 'exact', head: true })
    .eq('show_id', showId)
    .eq('user_id', userId)
    .eq('watched', true)

  if (countError) throw new Error(`Failed to count watched episodes: ${countError.message}`)

  // Build upsert payload
  const upsertData: Record<string, unknown> = {
    show_id: showId,
    user_id: userId,
    episodes_seen: count ?? 0,
    is_following: true,
    is_watchlist: true,
  }

  if (lastWatched) {
    upsertData.last_watched_episode_data = {
      season_number: lastWatched.season_number,
      episode_number: lastWatched.episode_number,
      watched_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
  } else {
    // Unwatching — find the new latest watched episode so Watch Next recalculates correctly
    const { data: latest } = await supabase
      .from('user_episodes')
      .select('season_number, episode_number, watched_at')
      .eq('show_id', showId)
      .eq('user_id', userId)
      .eq('watched', true)
      .order('watched_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (latest) {
      upsertData.last_watched_episode_data = {
        season_number: latest.season_number,
        episode_number: latest.episode_number,
        watched_at: latest.watched_at,
        updated_at: new Date().toISOString(),
      }
    } else {
      // No watched episodes left — clear it so computeNextEpisode falls back to S01E01
      upsertData.last_watched_episode_data = null
    }
  }

  const { error } = await supabase
    .from('user_shows')
    .upsert(upsertData, { onConflict: 'show_id,user_id' })

  // PGRST116 means no row returned — that's fine, we upserted
  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to update episodes_seen: ${error.message}`)
  }
}

export function useToggleEpisodeWatched() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      showId,
      seasonNumber,
      episodeNumber,
      watched,
    }: {
      showId: string
      seasonNumber: number
      episodeNumber: number
      watched: boolean
    }) => {
      if (!user) throw new Error('Not authenticated')

      if (watched) {
        // Mark as watched
        const { error } = await supabase.from('user_episodes').upsert(
          {
            show_id: showId,
            user_id: user.id,
            season_number: seasonNumber,
            episode_number: episodeNumber,
            watched: true,
            watched_at: new Date().toISOString(),
          },
          { onConflict: 'show_id, season_number, episode_number, user_id' }
        )
        if (error) throw new Error(error.message)
      } else {
        // Mark as unwatched — delete the row
        const { error } = await supabase
          .from('user_episodes')
          .delete()
          .eq('show_id', showId)
          .eq('user_id', user.id)
          .eq('season_number', seasonNumber)
          .eq('episode_number', episodeNumber)
        if (error) throw new Error(error.message)
      }

      // Update user_shows.episodes_seen counter + last watched data
      await updateEpisodesSeen(showId, user.id, watched ? { season_number: seasonNumber, episode_number: episodeNumber } : null)
    },
    onMutate: async ({ showId, watched }) => {
      if (!user) return

      // Cancel refetches so optimistic write doesn't get clobbered
      await queryClient.cancelQueries({ queryKey: ['shows', 'detail', showId] })

      // Snapshot previous data
      const previousData = queryClient.getQueryData<ShowWithUserData>(['shows', 'detail', showId])

      // Optimistically patch episodes_seen (capped at total_episodes)
      if (previousData) {
        const totalEps = previousData.total_episodes
        const delta = watched ? 1 : -1
        const next = (previousData.episodes_seen ?? 0) + delta
        const capped = totalEps ? Math.max(0, Math.min(totalEps, next)) : Math.max(0, next)
        queryClient.setQueryData<ShowWithUserData>(['shows', 'detail', showId], {
          ...previousData,
          episodes_seen: capped,
        })
      }

      return { previousData }
    },
    onError: (_err, { showId }, context) => {
      // Rollback optimistic update
      if (context?.previousData) {
        queryClient.setQueryData(['shows', 'detail', showId], context.previousData)
      }
    },
    onSettled: (_data, _error, { showId }) => {
      // Refetch to reconcile — target only the affected show
      queryClient.invalidateQueries({ queryKey: showKeys.detail(showId) })
      queryClient.invalidateQueries({ queryKey: episodeKeys.all })
      // Also sync list caches so the Shows tab Watch Next updates
      const uid = user?.id ?? ''
      queryClient.invalidateQueries({ queryKey: showKeys.list(uid) })
      queryClient.invalidateQueries({ queryKey: showKeys.continueWatching(uid) })
    },
  })
}

// ── Batch mark all unwatched episodes as watched ──

export function useBatchMarkWatched() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      showId,
      seasonNumber,
      episodeNumbers,
    }: {
      showId: string
      seasonNumber: number
      episodeNumbers: number[]
    }) => {
      if (!user) throw new Error('Not authenticated')
      if (episodeNumbers.length === 0) return

      // 1. Upsert all as watched in one call
      const rows = episodeNumbers.map((ep) => ({
        show_id: showId,
        user_id: user.id,
        season_number: seasonNumber,
        episode_number: ep,
        watched: true,
        watched_at: new Date().toISOString(),
      }))

      const { error: upsertError } = await supabase
        .from('user_episodes')
        .upsert(rows, { onConflict: 'show_id, season_number, episode_number, user_id' })

      if (upsertError) throw new Error(upsertError.message)

      // 2. Update episodes_seen counter from the source of truth
      const { count, error: countError } = await supabase
        .from('user_episodes')
        .select('*', { count: 'exact', head: true })
        .eq('show_id', showId)
        .eq('user_id', user.id)
        .eq('watched', true)

      if (countError) throw new Error(`Failed to count watched episodes: ${countError.message}`)

      // Build upsert payload with last watched episode data
      const upsertData: Record<string, unknown> = {
        show_id: showId,
        user_id: user.id,
        episodes_seen: count ?? 0,
        is_following: true,
        is_watchlist: true,
      }

      upsertData.last_watched_episode_data = {
        season_number: seasonNumber,
        episode_number: Math.max(...episodeNumbers),
        updated_at: new Date().toISOString(),
      }

      const { error: updateError } = await supabase
        .from('user_shows')
        .upsert(upsertData, { onConflict: 'show_id,user_id' })

      if (updateError) throw new Error(`Failed to batch update episodes_seen: ${updateError.message}`)
    },
    onMutate: async ({ showId, episodeNumbers }) => {
      if (!user) return

      await queryClient.cancelQueries({ queryKey: ['shows', 'detail', showId] })

      const previousData = queryClient.getQueryData<ShowWithUserData>(['shows', 'detail', showId])

      if (previousData) {
        const totalEps = previousData.total_episodes
        const maxAdd = totalEps ? Math.min(totalEps - (previousData.episodes_seen ?? 0), episodeNumbers.length) : episodeNumbers.length
        queryClient.setQueryData<ShowWithUserData>(['shows', 'detail', showId], {
          ...previousData,
          episodes_seen: (previousData.episodes_seen ?? 0) + Math.max(0, maxAdd),
        })
      }

      return { previousData }
    },
    onError: (_err, { showId }, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['shows', 'detail', showId], context.previousData)
      }
    },
    onSettled: (_data, _error, { showId }) => {
      queryClient.invalidateQueries({ queryKey: showKeys.detail(showId) })
      queryClient.invalidateQueries({ queryKey: episodeKeys.all })
      // Also sync list caches
      const uid = user?.id ?? ''
      queryClient.invalidateQueries({ queryKey: showKeys.list(uid) })
      queryClient.invalidateQueries({ queryKey: showKeys.continueWatching(uid) })
    },
  })
}

// ── Watched Episodes History ──

const WATCHED_HISTORY_LIMIT = 20

async function fetchWatchedHistory(userId: string): Promise<EpisodeCardData[]> {
  // 1. Fetch user_episodes watched
  const { data: episodes, error } = await supabase
    .from('user_episodes')
    .select('show_id, season_number, episode_number, watched_at')
    .eq('user_id', userId)
    .eq('watched', true)
    .not('watched_at', 'is', null)
    .order('watched_at', { ascending: false })
    .limit(WATCHED_HISTORY_LIMIT)

  if (error) throw new Error(`Failed to fetch watched history: ${error.message}`)
  if (!episodes || episodes.length === 0) return []

  // 2. Fetch show data for all referenced shows
  const showIds = [...new Set(episodes.map((e) => e.show_id))]
  const { data: shows, error: showsError } = await supabase
    .from('shows')
    .select('id, name, poster_path, status, total_episodes')
    .in('id', showIds)

  if (showsError) throw new Error(`Failed to fetch shows: ${showsError.message}`)
  const showMap = new Map(shows?.map((s) => [s.id, s]) ?? [])

  // 3. Merge episode + show data
  return episodes
    .filter((ep) => showMap.has(ep.show_id))
    .map((ep) => {
      const show = showMap.get(ep.show_id)!
      return {
        showId: ep.show_id,
        showName: show.name,
        posterPath: show.poster_path,
        seasonNumber: ep.season_number,
        episodeNumber: ep.episode_number,
        episodeName: null, // No episode name in Supabase — loaded lazily
        totalEpisodes: show.total_episodes,
        episodesRemaining: null, // Unknown in this context
        isWatched: true,
        watchedAt: ep.watched_at ?? undefined,
        showStatus: show.status,
      }
    })
}

export function useWatchedEpisodesHistory() {
  const { user } = useAuth()

  return useQuery({
    queryKey: [...episodeKeys.all, 'watched-history', user?.id] as const,
    queryFn: () => fetchWatchedHistory(user?.id ?? ''),
    staleTime: 1000 * 60 * 2, // 2 min
    enabled: !!user,
  })
}