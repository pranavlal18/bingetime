// ─── Upcoming Episodes — next_episode_to_air from TMDb ───

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { getShowBasicDetails } from '@/lib/tmdb'
import { useAuth } from '@/contexts/AuthContext'
import type { EpisodeCardData, EpisodeSection } from '@/types'

// ── Query keys ──

export const upcomingKeys = {
  all: ['upcoming'] as const,
  list: (userId: string) => ['upcoming', 'list', userId] as const,
}

// ── Helpers ──

function getDayLabel(airDate: Date, today: Date): string {
  const diffDays = Math.round((airDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'TODAY'
  if (diffDays === 1) return 'TOMORROW'

  // Within the next 7 days, show day name
  if (diffDays > 1 && diffDays < 7) {
    return airDate.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase()
  }

  // Beyond a week, show date
  return airDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).toUpperCase()
}

// ── Fetch upcoming episodes ──
const MAX_CONCURRENT = 2

const BATCH_DELAY = 2500 // ms between batches — keeps requests under TMDb's 40 req/10sec free-tier limit

interface ShowWithNextAir {
  showId: string
  showName: string
  posterPath: string | null
  seasonNumber: number
  episodeNumber: number
  episodeName: string | null
  airDate: string
  networkName: string | null
  isPremiere: boolean
}

async function fetchNextAirForShow(tmdbId: number): Promise<Omit<ShowWithNextAir, 'showId' | 'showName' | 'posterPath'> | null> {
  try {
    const details = await getShowBasicDetails(tmdbId)
    if (!details) return null

    const nextEp = details.next_episode_to_air
    if (!nextEp?.air_date) return null

    return {
      seasonNumber: nextEp.season_number,
      episodeNumber: nextEp.episode_number,
      episodeName: nextEp.name || null,
      airDate: nextEp.air_date,
      networkName: details.networks?.[0]?.name ?? null,
      isPremiere: nextEp.episode_number === 1,
    }
  } catch {
    return null
  }
}

async function fetchUpcomingEpisodes(userId: string): Promise<EpisodeSection[]> {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  // Fetch shows that have tmdb_id
  const { data: shows } = await supabase
    .from('shows')
    .select('id, tmdb_id, name, poster_path')
    .not('tmdb_id', 'is', null)
    .order('name', { ascending: true })

  if (!shows || shows.length === 0) return []

  // Join with user_shows to filter by watchlist
  const showIds = shows.map((s) => s.id)
  const { data: userShows } = await supabase
    .from('user_shows')
    .select('show_id')
    .eq('user_id', userId)
    .eq('is_watchlist', true)
    .not('archived', 'eq', true)
    .in('show_id', showIds)

  if (!userShows || userShows.length === 0) return []

  const userShowIds = new Set(userShows.map((us) => us.show_id))
  const followedShows = shows.filter((s) => userShowIds.has(s.id))

  // Batch fetch TMDb data for each show
  const results: ShowWithNextAir[] = []

  for (let i = 0; i < followedShows.length; i += MAX_CONCURRENT) {
    const batch = followedShows.slice(i, i + MAX_CONCURRENT)
    const batchResults = await Promise.all(
      batch.map(async (show) => {
        const airInfo = await fetchNextAirForShow(show.tmdb_id!)
        if (!airInfo) return null

        return {
          showId: show.id,
          showName: show.name,
          posterPath: show.poster_path,
          ...airInfo,
        }
      })
    )

    results.push(...batchResults.filter((r): r is ShowWithNextAir => r !== null))

    if (i + MAX_CONCURRENT < followedShows.length) {
      await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY))
    }
  }

  // Filter to future/today only and sort by air date
  const future = results
    .filter((r) => new Date(r.airDate) >= today)
    .sort((a, b) => new Date(a.airDate).getTime() - new Date(b.airDate).getTime())

  // Map to EpisodeCardData
  const cardData = future.map(
    (r): EpisodeCardData => ({
      showId: r.showId,
      showName: r.showName,
      posterPath: r.posterPath,
      seasonNumber: r.seasonNumber,
      episodeNumber: r.episodeNumber,
      episodeName: r.episodeName,
      totalEpisodes: null,
      isWatched: false,
      airTime: null, // TMDb doesn't provide time in next_episode_to_air
      network: r.networkName,
      isPremiere: r.isPremiere,
      isFinale: false,
      showStatus: null,
    })
  )

  // Group by day
  const sections = new Map<string, EpisodeCardData[]>()
  for (const card of cardData) {
    const epResult = future.find((r) => r.showId === card.showId)
    if (!epResult) continue

    const airDate = new Date(epResult.airDate)
    const label = getDayLabel(airDate, today)
    const existing = sections.get(label) ?? []
    existing.push(card)
    sections.set(label, existing)
  }

  // Build ordered sections: TODAY, TOMORROW, then chronological
  const sectionEntries: EpisodeSection[] = []
  const priorityDays = ['TODAY', 'TOMORROW']

  for (const day of priorityDays) {
    const eps = sections.get(day)
    if (eps && eps.length > 0) {
      sectionEntries.push({ kind: 'upcoming', title: day, episodes: eps })
      sections.delete(day)
    }
  }
  // Remaining days in chronological order
  for (const [title, eps] of sections) {
    sectionEntries.push({ kind: 'upcoming', title, episodes: eps })
  }

  return sectionEntries
}

export function useUpcomingEpisodes() {
  const { user } = useAuth()

  return useQuery({
    queryKey: upcomingKeys.list(user?.id ?? ''),
    queryFn: () => fetchUpcomingEpisodes(user?.id ?? ''),
    staleTime: 1000 * 60 * 60, // 1 hour — air dates don't change often
    gcTime: 1000 * 60 * 120, // 2 hours
    enabled: !!user,
  })
}
