// ─── Episode Browser — season + episode queries ───

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { getSeasonDetails } from '@/lib/tmdb'
import type { TMDbSeasonDetails } from '@/types'
import type { ShowWithUserData } from './shows'

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
  season: (showId: string, tmdbId: number | null, seasonNumber: number) =>
    ['episodes', 'season', showId, tmdbId, seasonNumber] as const,
}

// ── Fetch season episodes + user watch status ──

async function fetchSeasonEpisodes(
  showId: string,
  tmdbId: number | null,
  seasonNumber: number
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
  return useQuery({
    queryKey: episodeKeys.season(showId, tmdbId, seasonNumber),
    queryFn: () => fetchSeasonEpisodes(showId, tmdbId, seasonNumber),
    enabled: !!showId || !!tmdbId,
    staleTime: 1000 * 60 * 5,
  })
}

// ── Toggle episode watched status ──

async function updateEpisodesSeen(showId: string, delta: number): Promise<void> {
  // Fetch current count from user_shows + total_episodes from shows
  const [usResult, showResult] = await Promise.all([
    supabase
      .from('user_shows')
      .select('episodes_seen')
      .eq('show_id', showId)
      .single(),
    supabase
      .from('shows')
      .select('total_episodes')
      .eq('id', showId)
      .single(),
  ])

  const current = usResult.data?.episodes_seen ?? 0
  const totalEps = showResult.data?.total_episodes ?? null
  const newCount = Math.max(0, totalEps ? Math.min(totalEps, current + delta) : current + delta)

  const { error } = await supabase
    .from('user_shows')
    .upsert(
      {
        show_id: showId,
        episodes_seen: newCount,
        is_following: true,
      },
      { onConflict: 'show_id' }
    )

  // PGRST116 means no row returned — that's fine, we upserted
  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to update episodes_seen: ${error.message}`)
  }
}

export function useToggleEpisodeWatched() {
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
      if (watched) {
        // Mark as watched
        const { error } = await supabase.from('user_episodes').upsert(
          {
            show_id: showId,
            season_number: seasonNumber,
            episode_number: episodeNumber,
            watched: true,
            watched_at: new Date().toISOString(),
          },
          { onConflict: 'show_id, season_number, episode_number' }
        )
        if (error) throw new Error(error.message)
      } else {
        // Mark as unwatched — delete the row
        const { error } = await supabase
          .from('user_episodes')
          .delete()
          .eq('show_id', showId)
          .eq('season_number', seasonNumber)
          .eq('episode_number', episodeNumber)
        if (error) throw new Error(error.message)
      }

      // Update user_shows.episodes_seen counter
      await updateEpisodesSeen(showId, watched ? 1 : -1)
    },
    onMutate: async ({ showId, watched }) => {
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
    onSettled: () => {
      // Refetch to reconcile
      queryClient.invalidateQueries({ queryKey: episodeKeys.all })
      queryClient.invalidateQueries({ queryKey: ['shows'] })
      queryClient.invalidateQueries({ queryKey: ['profile'] })
    },
  })
}

// ── Batch mark all unwatched episodes as watched ──

export function useBatchMarkWatched() {
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
      if (episodeNumbers.length === 0) return

      // 1. Upsert all as watched in one call
      const rows = episodeNumbers.map((ep) => ({
        show_id: showId,
        season_number: seasonNumber,
        episode_number: ep,
        watched: true,
        watched_at: new Date().toISOString(),
      }))

      const { error: upsertError } = await supabase
        .from('user_episodes')
        .upsert(rows, { onConflict: 'show_id, season_number, episode_number' })

      if (upsertError) throw new Error(upsertError.message)

      // 2. Update episodes_seen counter in one shot (capped at total_episodes)
      const [usResult, showResult] = await Promise.all([
        supabase
          .from('user_shows')
          .select('episodes_seen')
          .eq('show_id', showId)
          .single(),
        supabase
          .from('shows')
          .select('total_episodes')
          .eq('id', showId)
          .single(),
      ])

      const current = usResult.data?.episodes_seen ?? 0
      const totalEps = showResult.data?.total_episodes ?? null
      const added = totalEps ? Math.min(totalEps - current, episodeNumbers.length) : episodeNumbers.length

      const { error: updateError } = await supabase
        .from('user_shows')
        .upsert(
          {
            show_id: showId,
            episodes_seen: Math.max(0, current + added),
            is_following: true,
          },
          { onConflict: 'show_id' }
        )

      if (updateError) throw new Error(`Failed to batch update episodes_seen: ${updateError.message}`)
    },
    onMutate: async ({ showId, episodeNumbers }) => {
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
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: episodeKeys.all })
      queryClient.invalidateQueries({ queryKey: ['shows'] })
      queryClient.invalidateQueries({ queryKey: ['profile'] })
    },
  })
}
