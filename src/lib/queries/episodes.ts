// ─── Episode Browser — season + episode queries ───

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { getSeasonDetails } from '@/lib/tmdb'
import type { TMDbSeasonDetails } from '@/types'

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

  // 2. Get user_episodes for this show and season
  const { data: userEpisodes } = await supabase
    .from('user_episodes')
    .select('season_number, episode_number, watched, watched_at')
    .eq('show_id', showId)
    .eq('season_number', seasonNumber)

  // Build lookup: "episode_number" → watched status
  const watchedMap = new Map<number, { watched: boolean; watched_at: string | null }>()
  if (userEpisodes) {
    for (const ep of userEpisodes) {
      watchedMap.set(ep.episode_number, {
        watched: ep.watched,
        watched_at: ep.watched_at,
      })
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
    enabled: !!showId,
    staleTime: 1000 * 60 * 5,
  })
}

// ── Toggle episode watched status ──

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
    },
    onSuccess: () => {
      // Invalidate all episode queries + shows queries (episodes_seen changes)
      queryClient.invalidateQueries({ queryKey: episodeKeys.all })
      queryClient.invalidateQueries({ queryKey: ['shows'] })
      queryClient.invalidateQueries({ queryKey: ['profile'] })
    },
  })
}
