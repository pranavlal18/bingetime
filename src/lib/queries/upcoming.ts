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

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).toUpperCase()
}

function getDayLabel(airDate: Date, today: Date): string {
  const diffDays = Math.round((airDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return `TODAY (${formatDate(airDate)})`
  if (diffDays === 1) return `TOMORROW (${formatDate(airDate)})`

  // Within the next 7 days, show day name + date
  if (diffDays > 1 && diffDays < 7) {
    const dayName = airDate.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase()
    return `${dayName} (${formatDate(airDate)})`
  }

  // Beyond a week, show full date only (already detailed)
  return formatDate(airDate)
}

// ── Fetch upcoming episodes ──
const MAX_CONCURRENT = 8

// No artificial delay - TMDb free tier: 40 req/10s = 4 req/s sustained
// 8 concurrent with immediate next batch = ~8 req/s burst, then settles to 4/s
// This is well within limits and much faster

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
    const details = await Promise.race([
      getShowBasicDetails(tmdbId),
      new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error('TMDb timeout')), 10000)
      ),
    ])
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

  // Fetch only user's watchlisted shows that have tmdb_id
  const { data: shows } = await supabase
    .from('shows')
    .select('id, tmdb_id, name, poster_path, status, user_shows!inner(show_id)')
    .not('tmdb_id', 'is', null)
    .eq('user_shows.user_id', userId)
    .eq('user_shows.is_watchlist', true)
    .order('name', { ascending: true })

  if (!shows || shows.length === 0) return []

  // Skip shows that are ended/canceled — they won't have upcoming episodes
  const activeShows = shows.filter(
    (s) => s.status && !['Ended', 'Canceled'].includes(s.status)
  )

  if (activeShows.length === 0) return []

  // Batch fetch TMDb data for each show (no artificial delay — TMDb allows 40 req/10s)
  const results: ShowWithNextAir[] = []

  for (let i = 0; i < activeShows.length; i += MAX_CONCURRENT) {
    const batch = activeShows.slice(i, i + MAX_CONCURRENT)
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
  }

  // Filter to future/today only and sort by air date
  const future = results
    .filter((r) => new Date(r.airDate) >= today)
    .sort((a, b) => new Date(a.airDate).getTime() - new Date(b.airDate).getTime())

  // Map to EpisodeCardData
  const cardData = future.map(
    (r): EpisodeCardData => {
      // Create air time at 9 PM local time on the air date
      const airDate = new Date(r.airDate);
      airDate.setHours(21, 0, 0, 0); // 9 PM local time
      
        return {
          showId: r.showId,
          showName: r.showName,
          posterPath: r.posterPath,
          seasonNumber: r.seasonNumber,
          episodeNumber: r.episodeNumber,
          episodeName: r.episodeName,
          airDate: r.airDate,
          totalEpisodes: null,
          episodesRemaining: null,
          isWatched: false,
          airTime: airDate.toISOString(), // Include time for notification scheduling
          network: r.networkName,
          isPremiere: r.isPremiere,
          isFinale: false,
          showStatus: null,
        };
      }
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
    staleTime: 1000 * 60 * 60 * 24, // 24h — air dates shift once per day
    gcTime: 1000 * 60 * 60 * 24 * 14, // 14 days — survives long tab inactivity
    enabled: !!user,
  })
}
