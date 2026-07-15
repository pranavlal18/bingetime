// ─── Statistics Page — React Query hooks ───

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { getShowDetails } from '@/lib/tmdb'
import type { Show } from '@/types'

// ── Types ──

export interface PerShowStat {
  showId: string
  name: string
  posterPath: string | null
  status: string | null
  episodesSeen: number
  totalEpisodes: number | null
  averageRuntime: number | null // seconds
  hours: number
}

export interface MonthlyActivity {
  month: string // YYYY-MM
  episodeCount: number
  totalSeconds: number
  hours: number
}

export interface StreakData {
  currentStreak: number
  longestStreak: number
}

export interface DayOfWeekStat {
  day: string // Mon, Tue, ...
  dayIndex: number // 0-6
  episodeCount: number
  totalSeconds: number
  hours: number
}

export interface GenreStat {
  genre: string
  count: number
  totalSeconds: number
  hours: number
}

export interface ShowStatusBreakdown {
  status: string
  count: number
}

export interface WatchedMovieEntry {
  movieId: string
  title: string
  posterPath: string | null
  runtime: number | null
  watchedAt: string | null
}

// ── Helpers ──

const ESTIMATED_RUNTIME = 42 * 60 // fallback: 42 minutes in seconds

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function hoursFromSeconds(s: number): number {
  return Math.round((s / 3600) * 10) / 10 // one decimal
}

function parseDate(d: string): Date {
  return new Date(d)
}

// ── Query keys ──

export const statsKeys = {
  all: ['stats'] as const,
  perShow: (uid: string) => ['stats', 'perShow', uid] as const,
  monthly: (uid: string) => ['stats', 'monthly', uid] as const,
  streaks: (uid: string) => ['stats', 'streaks', uid] as const,
  dayOfWeek: (uid: string) => ['stats', 'dayOfWeek', uid] as const,
  movieGenres: (uid: string) => ['stats', 'movieGenres', uid] as const,
  showStatus: (uid: string) => ['stats', 'showStatus', uid] as const,
  movieHistory: (uid: string) => ['stats', 'movieHistory', uid] as const,
}

// ── 1. Per-show stats (top shows by watch time) ──

async function fetchPerShowStats(userId: string): Promise<PerShowStat[]> {
  const { data, error } = await supabase
    .from('user_shows')
    .select(`
      episodes_seen,
      shows!inner(
        id, name, poster_path, average_runtime, status, total_episodes
      )
    `)
    .eq('user_id', userId)
    .gt('episodes_seen', 0)

  if (error) throw new Error(error.message)
  if (!data) return []

  const stats: PerShowStat[] = data.map((row: any) => {
    const show = Array.isArray(row.shows) ? row.shows[0] : row.shows
    const rt = show.average_runtime ?? ESTIMATED_RUNTIME
    const eps = row.episodes_seen ?? 0
    return {
      showId: show.id as string,
      name: show.name as string,
      posterPath: show.poster_path as string | null,
      status: show.status as string | null,
      episodesSeen: eps,
      totalEpisodes: show.total_episodes as number | null,
      averageRuntime: show.average_runtime as number | null,
      hours: hoursFromSeconds(rt * eps),
    }
  })

  // Sort by hours descending, take top 20
  return stats.sort((a, b) => b.hours - a.hours).slice(0, 20)
}

export function usePerShowStats() {
  const { user } = useAuth()
  return useQuery({
    queryKey: statsKeys.perShow(user?.id ?? ''),
    queryFn: () => fetchPerShowStats(user?.id ?? ''),
    staleTime: 1000 * 60 * 5,
    enabled: !!user,
  })
}

// ── 2. Monthly activity ──

async function fetchMonthlyActivity(userId: string): Promise<MonthlyActivity[]> {
  const { data, error } = await supabase
    .from('user_episodes')
    .select(`
      watched_at,
      shows!inner(average_runtime)
    `)
    .eq('user_id', userId)
    .eq('watched', true)
    .not('watched_at', 'is', null)
    .order('watched_at', { ascending: true })

  if (error) throw new Error(error.message)
  if (!data || data.length === 0) return []

  // Group by year-month on the client
  const monthMap = new Map<string, { episodeCount: number; totalSeconds: number }>()

  for (const row of data) {
    const d = parseDate(row.watched_at as string)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

    const show = Array.isArray(row.shows) ? row.shows[0] : row.shows
    const rt = show?.average_runtime ?? ESTIMATED_RUNTIME

    const entry = monthMap.get(key) ?? { episodeCount: 0, totalSeconds: 0 }
    entry.episodeCount++
    entry.totalSeconds += rt
    monthMap.set(key, entry)
  }

  // Include last 12 months (fill gaps with zero)
  const now = new Date()
  const result: MonthlyActivity[] = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const entry = monthMap.get(key)
    result.push({
      month: key,
      episodeCount: entry?.episodeCount ?? 0,
      totalSeconds: entry?.totalSeconds ?? 0,
      hours: hoursFromSeconds(entry?.totalSeconds ?? 0),
    })
  }

  return result
}

export function useMonthlyActivity() {
  const { user } = useAuth()
  return useQuery({
    queryKey: statsKeys.monthly(user?.id ?? ''),
    queryFn: () => fetchMonthlyActivity(user?.id ?? ''),
    staleTime: 1000 * 60 * 5,
    enabled: !!user,
  })
}

// ── 3. Watch streaks ──

async function fetchStreaks(userId: string): Promise<StreakData> {
  const { data, error } = await supabase
    .from('user_episodes')
    .select('watched_at')
    .eq('user_id', userId)
    .eq('watched', true)
    .not('watched_at', 'is', null)
    .order('watched_at', { ascending: false })

  if (error) throw new Error(error.message)
  if (!data || data.length === 0) return { currentStreak: 0, longestStreak: 0 }

  // Get distinct dates (date only, no time)
  const dateSet = new Set<string>()
  for (const row of data) {
    const d = new Date(row.watched_at as string)
    dateSet.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
  }

  // Sort descending
  const sortedDates = [...dateSet].sort().reverse()

  // Compute current streak (consecutive days backward from today)
  // Convert to Date objects for comparison
  const dateObjs = sortedDates.map((d) => new Date(d))

  // Current streak: count consecutive days ending at today or most recent watch
  let currentStreak = 0
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Check if most recent watch is today or yesterday (otherwise streak is 0)
  if (dateObjs.length > 0) {
    const mostRecent = dateObjs[0]
    const diffMs = today.getTime() - mostRecent.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    if (diffDays > 1) {
      currentStreak = 0
    } else {
      currentStreak = 1
      for (let i = 1; i < dateObjs.length; i++) {
        const prev = dateObjs[i - 1]
        const curr = dateObjs[i]
        const gapMs = prev.getTime() - curr.getTime()
        const gapDays = Math.round(gapMs / (1000 * 60 * 60 * 24))
        if (gapDays === 1) {
          currentStreak++
        } else {
          break
        }
      }
    }
  }

  // Longest streak: scan ascending
  const ascending = [...dateObjs].sort((a, b) => a.getTime() - b.getTime())
  let longestStreak = 0
  let run = 1
  for (let i = 1; i < ascending.length; i++) {
    const prev = ascending[i - 1]
    const curr = ascending[i]
    const gapMs = curr.getTime() - prev.getTime()
    const gapDays = Math.round(gapMs / (1000 * 60 * 60 * 24))
    if (gapDays === 1) {
      run++
    } else {
      longestStreak = Math.max(longestStreak, run)
      run = 1
    }
  }
  longestStreak = Math.max(longestStreak, run)

  return { currentStreak, longestStreak }
}

export function useWatchStreaks() {
  const { user } = useAuth()
  return useQuery({
    queryKey: statsKeys.streaks(user?.id ?? ''),
    queryFn: () => fetchStreaks(user?.id ?? ''),
    staleTime: 1000 * 60 * 5,
    enabled: !!user,
  })
}

// ── 4. Day of week stats ──

async function fetchDayOfWeekStats(userId: string): Promise<DayOfWeekStat[]> {
  const { data, error } = await supabase
    .from('user_episodes')
    .select(`
      watched_at,
      shows!inner(average_runtime)
    `)
    .eq('user_id', userId)
    .eq('watched', true)
    .not('watched_at', 'is', null)

  if (error) throw new Error(error.message)
  if (!data || data.length === 0) return []

  const dowMap = new Map<number, { episodeCount: number; totalSeconds: number }>()

  for (const row of data) {
    const d = parseDate(row.watched_at as string)
    const dayIndex = d.getDay() // 0=Sun, 1=Mon, ...

    const show = Array.isArray(row.shows) ? row.shows[0] : row.shows
    const rt = show?.average_runtime ?? ESTIMATED_RUNTIME

    const entry = dowMap.get(dayIndex) ?? { episodeCount: 0, totalSeconds: 0 }
    entry.episodeCount++
    entry.totalSeconds += rt
    dowMap.set(dayIndex, entry)
  }

  return DAY_NAMES.map((day, i) => {
    const entry = dowMap.get(i)
    return {
      day,
      dayIndex: i,
      episodeCount: entry?.episodeCount ?? 0,
      totalSeconds: entry?.totalSeconds ?? 0,
      hours: hoursFromSeconds(entry?.totalSeconds ?? 0),
    }
  })
}

export function useDayOfWeekStats() {
  const { user } = useAuth()
  return useQuery({
    queryKey: statsKeys.dayOfWeek(user?.id ?? ''),
    queryFn: () => fetchDayOfWeekStats(user?.id ?? ''),
    staleTime: 1000 * 60 * 5,
    enabled: !!user,
  })
}

// ── 5. Movie genre breakdown ──

async function fetchMovieGenreStats(userId: string): Promise<GenreStat[]> {
  const { data, error } = await supabase
    .from('user_movies')
    .select(`
      watched,
      movies!inner(genres, runtime)
    `)
    .eq('user_id', userId)
    .eq('watched', true)

  if (error) throw new Error(error.message)
  if (!data) return []

  const genreMap = new Map<string, { count: number; totalSeconds: number }>()

  for (const row of data) {
    const movie = Array.isArray(row.movies) ? row.movies[0] : row.movies
    const genres: string[] | null = movie?.genres ?? null
    const runtime: number | null = movie?.runtime ?? null

    const seconds = runtime ?? 2 * 3600 // fallback 2h

    if (genres && genres.length > 0) {
      for (const genre of genres) {
        const entry = genreMap.get(genre) ?? { count: 0, totalSeconds: 0 }
        entry.count++
        entry.totalSeconds += seconds
        genreMap.set(genre, entry)
      }
    } else {
      // Uncategorized
      const entry = genreMap.get('Other') ?? { count: 0, totalSeconds: 0 }
      entry.count++
      entry.totalSeconds += seconds
      genreMap.set('Other', entry)
    }
  }

  return [...genreMap.entries()]
    .map(([genre, data]) => ({
      genre,
      count: data.count,
      totalSeconds: data.totalSeconds,
      hours: hoursFromSeconds(data.totalSeconds),
    }))
    .sort((a, b) => b.hours - a.hours)
}

export function useMovieGenreStats() {
  const { user } = useAuth()
  return useQuery({
    queryKey: statsKeys.movieGenres(user?.id ?? ''),
    queryFn: () => fetchMovieGenreStats(user?.id ?? ''),
    staleTime: 1000 * 60 * 5,
    enabled: !!user,
  })
}

// ── 6. Show status breakdown ──

async function fetchShowStatusBreakdown(userId: string): Promise<ShowStatusBreakdown[]> {
  const { data, error } = await supabase
    .from('user_shows')
    .select(`
      shows!inner(status)
    `)
    .eq('user_id', userId)

  if (error) throw new Error(error.message)
  if (!data) return []

  const statusMap = new Map<string, number>()
  for (const row of data) {
    const show = Array.isArray(row.shows) ? row.shows[0] : row.shows
    const status = show?.status || 'Unknown'
    statusMap.set(status, (statusMap.get(status) ?? 0) + 1)
  }

  return [...statusMap.entries()]
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count)
}

export function useShowStatusBreakdown() {
  const { user } = useAuth()
  return useQuery({
    queryKey: statsKeys.showStatus(user?.id ?? ''),
    queryFn: () => fetchShowStatusBreakdown(user?.id ?? ''),
    staleTime: 1000 * 60 * 5,
    enabled: !!user,
  })
}

// ── 7. Movie watched history ──

async function fetchMovieWatchedHistory(userId: string): Promise<WatchedMovieEntry[]> {
  const { data, error } = await supabase
    .from('user_movies')
    .select(`
      watched_at,
      movies!inner(id, title, poster_path, runtime)
    `)
    .eq('user_id', userId)
    .eq('watched', true)
    .not('watched_at', 'is', null)
    .order('watched_at', { ascending: false })
    .limit(20)

  if (error) throw new Error(error.message)
  if (!data) return []

  return data.map((row: any) => {
    const movie = Array.isArray(row.movies) ? row.movies[0] : row.movies
    return {
      movieId: movie.id as string,
      title: movie.title as string,
      posterPath: movie.poster_path as string | null,
      runtime: movie.runtime as number | null,
      watchedAt: row.watched_at as string | null,
    }
  })
}

export function useMovieWatchedHistory() {
  const { user } = useAuth()
  return useQuery({
    queryKey: statsKeys.movieHistory(user?.id ?? ''),
    queryFn: () => fetchMovieWatchedHistory(user?.id ?? ''),
    staleTime: 1000 * 60 * 5,
    enabled: !!user,
  })
}

// ── 8. Repair runtime (mutation) ──
// Finds shows with null average_runtime, fetches from TMDb, updates DB.

// Genre → typical runtime in minutes (used when episode_run_time is empty)
const GENRE_RUNTIME_ESTIMATES: Record<string, number> = {
  'Comedy': 22,
  'Animation': 22,
  'Kids': 22,
  'Family': 22,
  'Talk': 60,
  'Reality': 60,
  'Documentary': 44,
  'News': 30,
  'Drama': 42,
  'Soap': 30,
  'Sci-Fi & Fantasy': 42,
  'Action & Adventure': 42,
  'Mystery': 42,
  'Crime': 42,
  'War & Politics': 42,
  'Western': 42,
  'Romance': 42,
  'Thriller': 42,
}

const DEFAULT_RUNTIME_SECONDS = 42 * 60 // 42 minutes

interface RepairResult {
  fixed: number
  total: number
  skipped: number
}

export function useRepairRuntime(onProgress?: (fixed: number, total: number) => void) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (): Promise<RepairResult> => {
      // 1. Find shows with null average_runtime
      const { data: shows, error } = await supabase
        .from('shows')
        .select('id, tmdb_id, name')
        .is('average_runtime', null)
        .not('tmdb_id', 'is', null)

      if (error) throw new Error(`Failed to fetch shows: ${error.message}`)
      if (!shows || shows.length === 0) {
        return { fixed: 0, total: 0, skipped: 0 }
      }

      const total = shows.length
      let fixed = 0
      let skipped = 0

      // 2. Process each show (sequential to respect rate limits)
      for (let i = 0; i < shows.length; i++) {
        const show = shows[i]
        try {
          const details = await getShowDetails(show.tmdb_id!)

          let runtimeSeconds: number | null = null

          // Strategy 1: Use episode_run_time from TMDb
          if (details.episode_run_time && details.episode_run_time.length > 0) {
            const sum = details.episode_run_time.reduce((acc, val) => acc + val, 0)
            const avgMinutes = sum / details.episode_run_time.length
            runtimeSeconds = Math.round(avgMinutes * 60)
          }

          // Strategy 2: Estimate from genres
          if (runtimeSeconds === null && details.genres && details.genres.length > 0) {
            const firstGenre = details.genres[0].name
            const estMinutes = GENRE_RUNTIME_ESTIMATES[firstGenre] ?? DEFAULT_RUNTIME_SECONDS / 60
            runtimeSeconds = estMinutes * 60
          }

          // Strategy 3: Use global default
          if (runtimeSeconds === null) {
            runtimeSeconds = DEFAULT_RUNTIME_SECONDS
          }

          // Update the show
          const { error: updateError } = await supabase
            .from('shows')
            .update({ average_runtime: runtimeSeconds })
            .eq('id', show.id)

          if (updateError) {
            console.error(`Failed to update ${show.name}:`, updateError)
            skipped++
          } else {
            fixed++
          }
        } catch (err) {
          console.error(`Error processing ${show.name}:`, err)
          skipped++
        }

        onProgress?.(fixed + skipped, total)

        // Rate limit: 200ms between requests
        if (i < shows.length - 1) {
          await new Promise((r) => setTimeout(r, 200))
        }
      }

      return { fixed, total, skipped }
    },
    onSuccess: (result) => {
      // Invalidate all stats queries so they refetch with new runtime data
      queryClient.invalidateQueries({ queryKey: statsKeys.all })
      queryClient.invalidateQueries({ queryKey: ['profile'] })
    },
  })
}

// ── 9. Repair show genres (mutation) ──
// Finds shows with null genres, fetches from TMDb, updates DB.

export interface GenresRepairResult {
  fixed: number
  total: number
  skipped: number
}

export function useRepairShowGenres(onProgress?: (fixed: number, total: number) => void) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (): Promise<GenresRepairResult> => {
      // 1. Find shows with null genres
      const { data: shows, error } = await supabase
        .from('shows')
        .select('id, tmdb_id, name')
        .is('genres', null)
        .not('tmdb_id', 'is', null)

      if (error) throw new Error(`Failed to fetch shows: ${error.message}`)
      if (!shows || shows.length === 0) {
        return { fixed: 0, total: 0, skipped: 0 }
      }

      const total = shows.length
      let fixed = 0
      let skipped = 0

      // 2. Process each show (sequential to respect rate limits)
      for (let i = 0; i < shows.length; i++) {
        const show = shows[i]
        try {
          const details = await getShowDetails(show.tmdb_id!)

          const genreNames = details.genres?.map((g) => g.name) ?? []

          // Update the show
          const { error: updateError } = await supabase
            .from('shows')
            .update({ genres: genreNames })
            .eq('id', show.id)

          if (updateError) {
            console.error(`Failed to update genres for ${show.name}:`, updateError)
            skipped++
          } else {
            fixed++
          }
        } catch (err) {
          console.error(`Error processing ${show.name}:`, err)
          skipped++
        }

        onProgress?.(fixed + skipped, total)

        // Rate limit: 200ms between requests
        if (i < shows.length - 1) {
          await new Promise((r) => setTimeout(r, 200))
        }
      }

      return { fixed, total, skipped }
    },
    onSuccess: () => {
      // Invalidate genre stats so they refetch
      queryClient.invalidateQueries({ queryKey: ['stats'] })
    },
  })
}

// ══════════════════════════════════════════════════════════════════
// ── NEW STATS QUERIES (TV Time-style redesign) ──
// ══════════════════════════════════════════════════════════════════

// ── Types ──

export interface BucketData {
  label: string // ISO week (e.g. "2026-W28") or ISO month (e.g. "2026-07")
  value: number
}

export interface MarathonSession {
  showId: string
  name: string
  posterPath: string | null
  episodeCount: number
  totalSeconds: number
  startLabel: string // "S03E12"
  endLabel: string   // "S03E18"
}

export interface FutureProjection {
  label: string // month label e.g. "Aug"
  value: number  // projected hours
}

export interface CatchUpData {
  ratePerWeek: number     // episodes or movies per week
  unit: string            // "episodes" | "movies"
  timeToWatchHours: number
  projectedFinishDate: string | null // ISO date string or null if no rate
}

export interface UpcomingEntry {
  key: string
  title: string
  subtitle: string
  dateLabel: string
  posterPath: string | null
  weekLabel: string // for bucketing
}

// ── Query keys ──

export const newStatsKeys = {
  tabCounts: (uid: string) => ['stats', 'new', 'tabCounts', uid] as const,
  weeklyWatch: (uid: string, kind: string, metric: string, period: string) =>
    ['stats', 'new', 'weeklyWatch', uid, kind, metric, period] as const,
  marathons: (uid: string) => ['stats', 'new', 'marathons', uid] as const,
  upcoming: (uid: string) => ['stats', 'new', 'upcoming', uid] as const,
  catchUp: (uid: string, kind: string) => ['stats', 'new', 'catchUp', uid, kind] as const,
  timeToWatch: (uid: string, kind: string) => ['stats', 'new', 'timeToWatch', uid, kind] as const,
  futureBars: (uid: string) => ['stats', 'new', 'futureBars', uid] as const,
  finishDate: (uid: string, kind: string) => ['stats', 'new', 'finishDate', uid, kind] as const,
}

// ══════════════════════════════════════════════════════════════════
//  1. Tab counts — total shows/movies added
// ══════════════════════════════════════════════════════════════════

async function fetchTabCounts(userId: string): Promise<{ showsAdded: number; moviesAdded: number }> {
  const [showsRes, moviesRes] = await Promise.all([
    supabase.from('user_shows').select('show_id').eq('user_id', userId),
    supabase.from('user_movies').select('movie_id').eq('user_id', userId),
  ])
  return {
    showsAdded: showsRes.data?.length ?? 0,
    moviesAdded: moviesRes.data?.length ?? 0,
  }
}

export function useTabCounts() {
  const { user } = useAuth()
  return useQuery({
    queryKey: newStatsKeys.tabCounts(user?.id ?? ''),
    queryFn: () => fetchTabCounts(user?.id ?? ''),
    staleTime: 1000 * 60 * 5,
    enabled: !!user,
  })
}

// ══════════════════════════════════════════════════════════════════
//  2. Weekly/Monthly watch data (hours or count bucketed)
// ══════════════════════════════════════════════════════════════════

function getWeekId(date: Date): string {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  // Move to Thursday (ISO week rule)
  const dayNum = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - dayNum + 3)
  const jan4 = new Date(d.getFullYear(), 0, 4)
  const weekNum = Math.round(((d.getTime() - jan4.getTime()) / 86400000 + jan4.getDay() + 1) / 7)
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`
}

function getMonthId(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function formatWeekLabel(weekId: string): string {
  // "2026-W28" → "W28"
  return `W${weekId.slice(-2)}`
}

function formatMonthLabel(monthId: string): string {
  // "2026-07" → "Jul"
  const d = new Date(monthId + '-01')
  return d.toLocaleDateString('en-US', { month: 'short' })
}

async function fetchWeeklyWatch(
  userId: string,
  kind: 'shows' | 'movies',
  metric: 'hours' | 'count',
  period: 'week' | 'month'
): Promise<BucketData[]> {
  if (kind === 'shows') {
    // Fetch watched episodes with runtime
    const { data, error } = await supabase
      .from('user_episodes')
      .select('watched_at, shows!inner(average_runtime)')
      .eq('user_id', userId)
      .eq('watched', true)
      .not('watched_at', 'is', null)

    if (error) throw new Error(error.message)
    if (!data || data.length === 0) return []

    const bucketMap = new Map<string, { count: number; totalSeconds: number }>()

    for (const row of data) {
      const d = new Date(row.watched_at as string)
      const key = period === 'week' ? getWeekId(d) : getMonthId(d)
      const show = Array.isArray(row.shows) ? row.shows[0] : row.shows
      const rt = show?.average_runtime ?? ESTIMATED_RUNTIME

      const entry = bucketMap.get(key) ?? { count: 0, totalSeconds: 0 }
      entry.count++
      entry.totalSeconds += rt
      bucketMap.set(key, entry)
    }

    // Generate N buckets (7 weeks or 12 months)
    const now = new Date()
    const result: BucketData[] = []
    const count = period === 'week' ? 7 : 12

    for (let i = count - 1; i >= 0; i--) {
      const d = period === 'week'
        ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - i * 7)
        : new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = period === 'week' ? getWeekId(d) : getMonthId(d)
      const entry = bucketMap.get(key)

      result.push({
        label: period === 'week' ? formatWeekLabel(key) : formatMonthLabel(key),
        value: metric === 'hours'
          ? Math.round(((entry?.totalSeconds ?? 0) / 3600) * 10) / 10
          : (entry?.count ?? 0),
      })
    }

    return result
  } else {
    // Movies
    const { data, error } = await supabase
      .from('user_movies')
      .select('watched_at, movies!inner(runtime)')
      .eq('user_id', userId)
      .eq('watched', true)
      .not('watched_at', 'is', null)

    if (error) throw new Error(error.message)
    if (!data || data.length === 0) return []

    const bucketMap = new Map<string, { count: number; totalSeconds: number }>()

    for (const row of data) {
      const d = new Date(row.watched_at as string)
      const key = period === 'week' ? getWeekId(d) : getMonthId(d)
      const movie = Array.isArray(row.movies) ? row.movies[0] : row.movies
      const rt = movie?.runtime ?? 2 * 3600

      const entry = bucketMap.get(key) ?? { count: 0, totalSeconds: 0 }
      entry.count++
      entry.totalSeconds += rt
      bucketMap.set(key, entry)
    }

    const now = new Date()
    const result: BucketData[] = []
    const count = period === 'week' ? 7 : 12

    for (let i = count - 1; i >= 0; i--) {
      const d = period === 'week'
        ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - i * 7)
        : new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = period === 'week' ? getWeekId(d) : getMonthId(d)
      const entry = bucketMap.get(key)

      result.push({
        label: period === 'week' ? formatWeekLabel(key) : formatMonthLabel(key),
        value: metric === 'hours'
          ? Math.round(((entry?.totalSeconds ?? 0) / 3600) * 10) / 10
          : (entry?.count ?? 0),
      })
    }

    return result
  }
}

export function useWeeklyWatch(kind: 'shows' | 'movies', metric: 'hours' | 'count', period: 'week' | 'month') {
  const { user } = useAuth()
  return useQuery({
    queryKey: newStatsKeys.weeklyWatch(user?.id ?? '', kind, metric, period),
    queryFn: () => fetchWeeklyWatch(user?.id ?? '', kind, metric, period),
    staleTime: 1000 * 60 * 2,
    enabled: !!user,
  })
}

// ══════════════════════════════════════════════════════════════════
//  3. Marathons — biggest watching sessions
// ══════════════════════════════════════════════════════════════════

const SESSION_GAP_MS = 2 * 60 * 60 * 1000 // 2 hours

async function fetchMarathons(userId: string, limit = 5): Promise<MarathonSession[]> {
  const { data, error } = await supabase
    .from('user_episodes')
    .select('show_id, season_number, episode_number, watched_at')
    .eq('user_id', userId)
    .eq('watched', true)
    .not('watched_at', 'is', null)
    .order('watched_at', { ascending: true })

  if (error) throw new Error(error.message)
  if (!data || data.length < 2) return []

  // Get show names/posters
  const showIds = [...new Set(data.map((r) => r.show_id))]
  const { data: shows } = await supabase
    .from('shows')
    .select('id, name, poster_path')
    .in('id', showIds)

  const showMap = new Map(shows?.map((s) => [s.id, s]) ?? [])

  // Sessionize: new session when gap > 2h or show changes
  const sessions: Array<{
    showId: string
    episodes: typeof data
    totalSeconds: number
  }> = []

  let currentSession: typeof data = [data[0]]

  for (let i = 1; i < data.length; i++) {
    const prev = data[i - 1]
    const curr = data[i]
    const gap = new Date(curr.watched_at!).getTime() - new Date(prev.watched_at!).getTime()
    const showChanged = curr.show_id !== prev.show_id

    if (gap > SESSION_GAP_MS || showChanged) {
      // Calculate total runtime (estimate: 42min per episode per show)
      const totalSeconds = currentSession.length * ESTIMATED_RUNTIME
      sessions.push({
        showId: currentSession[0].show_id,
        episodes: [...currentSession],
        totalSeconds,
      })
      currentSession = [curr]
    } else {
      currentSession.push(curr)
    }
  }

  // Flush last session
  if (currentSession.length > 0) {
    const totalSeconds = currentSession.length * ESTIMATED_RUNTIME
    sessions.push({
      showId: currentSession[0].show_id,
      episodes: [...currentSession],
      totalSeconds,
    })
  }

  // Sort by totalSeconds desc and take top N
  const top = sessions.sort((a, b) => b.totalSeconds - a.totalSeconds).slice(0, limit)

  return top.map((s) => {
    const show = showMap.get(s.showId)
    const first = s.episodes[0]
    const last = s.episodes[s.episodes.length - 1]
    return {
      showId: s.showId,
      name: show?.name ?? 'Unknown',
      posterPath: show?.poster_path ?? null,
      episodeCount: s.episodes.length,
      totalSeconds: s.totalSeconds,
      startLabel: `S${String(first.season_number).padStart(2, '0')}E${String(first.episode_number).padStart(2, '0')}`,
      endLabel: `S${String(last.season_number).padStart(2, '0')}E${String(last.episode_number).padStart(2, '0')}`,
    }
  })
}

export function useMarathons(limit = 5) {
  const { user } = useAuth()
  return useQuery({
    queryKey: [...newStatsKeys.marathons(user?.id ?? ''), limit],
    queryFn: () => fetchMarathons(user?.id ?? '', limit),
    staleTime: 1000 * 60 * 5,
    enabled: !!user,
  })
}

// ══════════════════════════════════════════════════════════════════
//  4. Upcoming episodes (TMDb-derived)
// ══════════════════════════════════════════════════════════════════

// In-memory cache for show details to avoid refetching within same session
const showDetailsCache = new Map<number, Awaited<ReturnType<typeof getShowDetails>>>()

async function fetchUpcomingEpisodes(userId: string, weeks = 12): Promise<UpcomingEntry[]> {
  // Get shows with tmdb_id that we follow
  const { data: userShows, error } = await supabase
    .from('user_shows')
    .select('show_id, episodes_seen, shows!inner(id, tmdb_id, name, poster_path)')
    .eq('user_id', userId)
    .eq('is_watchlist', true)
    .not('shows.tmdb_id', 'is', null)

  if (error) throw new Error(error.message)
  if (!userShows || userShows.length === 0) return []

  const now = new Date()
  const endDate = new Date(now.getTime() + weeks * 7 * 24 * 60 * 60 * 1000)
  const entries: UpcomingEntry[] = []

  // Process each show with concurrency cap
  const BATCH_SIZE = 4
  const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

  for (let i = 0; i < userShows.length; i += BATCH_SIZE) {
    const batch = userShows.slice(i, i + BATCH_SIZE)
    const results = await Promise.allSettled(
      batch.map(async (us) => {
        const show = Array.isArray(us.shows) ? us.shows[0] : us.shows
        const tmdbId = show.tmdb_id
        if (!tmdbId) return null

        // Check cache
        let details = showDetailsCache.get(tmdbId)
        if (!details) {
          details = await getShowDetails(tmdbId)
          showDetailsCache.set(tmdbId, details)
        }

        const nextEp = details.next_episode_to_air
        if (!nextEp?.air_date) return null

        const airDate = new Date(nextEp.air_date)
        if (airDate < now || airDate > endDate) return null

        const weekId = getWeekId(airDate)
        const dayName = airDate.toLocaleDateString('en-US', { weekday: 'short' })
        const dateStr = airDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

        return {
          key: `${show.id}-S${nextEp.season_number}E${nextEp.episode_number}`,
          title: show.name,
          subtitle: `S${nextEp.season_number} · E${nextEp.episode_number}${nextEp.name ? ` · ${nextEp.name}` : ''}`,
          dateLabel: `${dayName}, ${dateStr}`,
          posterPath: show.poster_path,
          weekLabel: weekId,
        } as UpcomingEntry
      })
    )

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        entries.push(result.value)
      }
    }

    if (i + BATCH_SIZE < userShows.length) {
      await delay(300)
    }
  }

  // Sort by air date
  return entries.sort((a, b) => {
    const dateA = new Date(a.dateLabel)
    const dateB = new Date(b.dateLabel)
    return dateA.getTime() - dateB.getTime()
  })
}

export function useUpcomingEpisodes() {
  const { user } = useAuth()
  return useQuery({
    queryKey: newStatsKeys.upcoming(user?.id ?? ''),
    queryFn: () => fetchUpcomingEpisodes(user?.id ?? ''),
    staleTime: 1000 * 60 * 30, // 30 min — TMDb data doesn't change often
    gcTime: 1000 * 60 * 60,    // 1h cache
    enabled: !!user,
  })
}

// ══════════════════════════════════════════════════════════════════
//  5. Catch-up rate (episodes/movies per week over last 60 days)
// ══════════════════════════════════════════════════════════════════

async function fetchCatchUpRate(userId: string, kind: 'shows' | 'movies'): Promise<CatchUpData> {
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()

  if (kind === 'shows') {
    const { data, error } = await supabase
      .from('user_episodes')
      .select('id')
      .eq('user_id', userId)
      .eq('watched', true)
      .gte('watched_at', sixtyDaysAgo)

    if (error) throw new Error(error.message)
    const count = data?.length ?? 0
    const ratePerWeek = Math.round((count / 60) * 7 * 100) / 100 // normalize to weekly

    return {
      ratePerWeek,
      unit: 'episodes',
      timeToWatchHours: 0, // filled by separate query
      projectedFinishDate: null,
    }
  } else {
    const { data, error } = await supabase
      .from('user_movies')
      .select('movie_id')
      .eq('user_id', userId)
      .eq('watched', true)
      .gte('watched_at', sixtyDaysAgo)

    if (error) throw new Error(error.message)
    const count = data?.length ?? 0
    const ratePerWeek = Math.round((count / 60) * 7 * 100) / 100

    return {
      ratePerWeek,
      unit: 'movies',
      timeToWatchHours: 0,
      projectedFinishDate: null,
    }
  }
}

export function useCatchUpRate(kind: 'shows' | 'movies') {
  const { user } = useAuth()
  return useQuery({
    queryKey: newStatsKeys.catchUp(user?.id ?? '', kind),
    queryFn: () => fetchCatchUpRate(user?.id ?? '', kind),
    staleTime: 1000 * 60 * 2,
    enabled: !!user,
  })
}

// ══════════════════════════════════════════════════════════════════
//  6. Time to watch (remaining hours in queue)
// ══════════════════════════════════════════════════════════════════

async function fetchTimeToWatchHours(userId: string, kind: 'shows' | 'movies'): Promise<number> {
  if (kind === 'shows') {
    // For shows: sum(remaining_episodes * average_runtime) where is_watchlist = true
    const { data, error } = await supabase
      .from('user_shows')
      .select('episodes_seen, shows!inner(total_episodes, average_runtime)')
      .eq('user_id', userId)
      .eq('is_watchlist', true)
      .not('shows.total_episodes', 'is', null)

    if (error) throw new Error(error.message)
    if (!data) return 0

    let totalSeconds = 0
    for (const row of data) {
      const show = Array.isArray(row.shows) ? row.shows[0] : row.shows
      const totalEps = show.total_episodes ?? 0
      const seenEps = row.episodes_seen ?? 0
      const remaining = Math.max(0, totalEps - seenEps)
      const rt = show.average_runtime ?? ESTIMATED_RUNTIME
      totalSeconds += remaining * rt
    }

    return Math.round(totalSeconds / 3600)
  } else {
    // For movies: sum(runtime) where is_watchlist = true AND watched = false
    const { data, error } = await supabase
      .from('user_movies')
      .select('watched, movies!inner(runtime)')
      .eq('user_id', userId)
      .eq('is_watchlist', true)
      .eq('watched', false)

    if (error) throw new Error(error.message)
    if (!data) return 0

    let totalSeconds = 0
    for (const row of data) {
      const movie = Array.isArray(row.movies) ? row.movies[0] : row.movies
      totalSeconds += movie?.runtime ?? 2 * 3600
    }

    return Math.round(totalSeconds / 3600)
  }
}

export function useTimeToWatchHours(kind: 'shows' | 'movies') {
  const { user } = useAuth()
  return useQuery({
    queryKey: newStatsKeys.timeToWatch(user?.id ?? '', kind),
    queryFn: () => fetchTimeToWatchHours(user?.id ?? '', kind),
    staleTime: 1000 * 60 * 5,
    enabled: !!user,
  })
}

// ══════════════════════════════════════════════════════════════════
//  7. Future watch time bars (projection for movies tab)
// ══════════════════════════════════════════════════════════════════

async function fetchFutureWatchTimeBars(userId: string, months = 12): Promise<FutureProjection[]> {
  // Get time-to-watch and weekly rate to project
  const hoursToWatch = await fetchTimeToWatchHours(userId, 'movies')
  const rate = await fetchCatchUpRate(userId, 'movies')
  const hoursPerWeek = rate.ratePerWeek * 2 // assume ~2h per movie

  if (hoursPerWeek <= 0) {
    // No rate yet — just return flat months
    const now = new Date()
    const result: FutureProjection[] = []
    for (let i = 0; i < months; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
      result.push({
        label: d.toLocaleDateString('en-US', { month: 'short' }),
        value: 0,
      })
    }
    return result
  }

  const hoursPerMonth = hoursPerWeek * 4.33
  const remaining = hoursToWatch

  const now = new Date()
  const result: FutureProjection[] = []
  let remainingHours = remaining

  for (let i = 0; i < months; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
    const projected = Math.min(remainingHours, hoursPerMonth)
    result.push({
      label: d.toLocaleDateString('en-US', { month: 'short' }),
      value: Math.round(projected * 10) / 10,
    })
    remainingHours -= projected
    if (remainingHours <= 0) break
  }

  return result
}

export function useFutureWatchTimeBars() {
  const { user } = useAuth()
  return useQuery({
    queryKey: newStatsKeys.futureBars(user?.id ?? ''),
    queryFn: () => fetchFutureWatchTimeBars(user?.id ?? ''),
    staleTime: 1000 * 60 * 5,
    enabled: !!user,
  })
}

// ══════════════════════════════════════════════════════════════════
//  8. Projected finish date
// ══════════════════════════════════════════════════════════════════

async function fetchProjectedFinishDate(userId: string, kind: 'shows' | 'movies'): Promise<string | null> {
  const hoursToWatch = await fetchTimeToWatchHours(userId, kind)
  if (hoursToWatch <= 0) return null

  const rate = await fetchCatchUpRate(userId, kind)

  // Convert rate to hours per week
  let hoursPerWeek: number
  if (kind === 'shows') {
    hoursPerWeek = rate.ratePerWeek * (ESTIMATED_RUNTIME / 3600) // episodes * avg episode hours
  } else {
    hoursPerWeek = rate.ratePerWeek * 2 // assume ~2h per movie
  }

  if (hoursPerWeek <= 0) return null

  const weeksToFinish = Math.ceil(hoursToWatch / hoursPerWeek)
  const finishDate = new Date()
  finishDate.setDate(finishDate.getDate() + weeksToFinish * 7)

  return finishDate.toISOString().split('T')[0] // YYYY-MM-DD
}

export function useProjectedFinishDate(kind: 'shows' | 'movies') {
  const { user } = useAuth()
  return useQuery({
    queryKey: newStatsKeys.finishDate(user?.id ?? '', kind),
    queryFn: () => fetchProjectedFinishDate(user?.id ?? '', kind),
    staleTime: 1000 * 60 * 5,
    enabled: !!user,
  })
}

// ══════════════════════════════════════════════════════════════════
//  9. Show genre stats (mirrors useMovieGenreStats but for shows)
// ══════════════════════════════════════════════════════════════════

async function fetchShowGenreStats(userId: string): Promise<GenreStat[]> {
  const { data, error } = await supabase
    .from('user_shows')
    .select(`
      episodes_seen,
      shows!inner(genres, average_runtime)
    `)
    .eq('user_id', userId)
    .gt('episodes_seen', 0)

  if (error) throw new Error(error.message)
  if (!data) return []

  const genreMap = new Map<string, { count: number; totalSeconds: number }>()

  for (const row of data) {
    const show = Array.isArray(row.shows) ? row.shows[0] : row.shows
    const genres: string[] | null = show?.genres ?? null
    const rt = show?.average_runtime ?? ESTIMATED_RUNTIME
    const eps = row.episodes_seen ?? 0
    const totalSec = rt * eps

    if (genres && genres.length > 0) {
      for (const genre of genres) {
        const entry = genreMap.get(genre) ?? { count: 0, totalSeconds: 0 }
        entry.count++
        entry.totalSeconds += totalSec
        genreMap.set(genre, entry)
      }
    } else {
      const entry = genreMap.get('Other') ?? { count: 0, totalSeconds: 0 }
      entry.count++
      entry.totalSeconds += totalSec
      genreMap.set('Other', entry)
    }
  }

  return [...genreMap.entries()]
    .map(([genre, data]) => ({
      genre,
      count: data.count,
      totalSeconds: data.totalSeconds,
      hours: Math.round(data.totalSeconds / 3600),
    }))
    .sort((a, b) => b.hours - a.hours)
}

export function useShowGenreStats() {
  const { user } = useAuth()
  return useQuery({
    queryKey: [...newStatsKeys.tabCounts(user?.id ?? ''), 'showGenres'] as const,
    queryFn: () => fetchShowGenreStats(user?.id ?? ''),
    staleTime: 1000 * 60 * 5,
    enabled: !!user,
  })
}

// ══════════════════════════════════════════════════════════════════
//  10a. Remaining counts (episodes or movies left in queue)
// ══════════════════════════════════════════════════════════════════

export interface RemainingCounts {
  count: number
}

async function fetchRemainingCounts(userId: string, kind: 'shows' | 'movies'): Promise<RemainingCounts> {
  if (kind === 'shows') {
    const { data, error } = await supabase
      .from('user_shows')
      .select('episodes_seen, shows!inner(total_episodes)')
      .eq('user_id', userId)
      .eq('is_watchlist', true)
      .not('shows.total_episodes', 'is', null)

    if (error) throw new Error(error.message)
    if (!data) return { count: 0 }

    let total = 0
    for (const row of data) {
      const show = Array.isArray(row.shows) ? row.shows[0] : row.shows
      const remaining = Math.max(0, (show.total_episodes ?? 0) - (row.episodes_seen ?? 0))
      total += remaining
    }
    return { count: total }
  } else {
    const { data, error } = await supabase
      .from('user_movies')
      .select('movie_id')
      .eq('user_id', userId)
      .eq('is_watchlist', true)
      .eq('watched', false)

    if (error) throw new Error(error.message)
    return { count: data?.length ?? 0 }
  }
}

export function useRemainingCounts(kind: 'shows' | 'movies') {
  const { user } = useAuth()
  return useQuery({
    queryKey: [...newStatsKeys.tabCounts(user?.id ?? ''), 'remaining', kind] as const,
    queryFn: () => fetchRemainingCounts(user?.id ?? '', kind),
    staleTime: 1000 * 60 * 5,
    enabled: !!user,
  })
}

// ══════════════════════════════════════════════════════════════════
//  10b. Total watch time breakdown (for the hero block)
// ══════════════════════════════════════════════════════════════════

export interface WatchTimeBreakdown {
  showEpisodes: number
  showSeconds: number
  showHours: number
  showDays: number
  movieCount: number
  movieSeconds: number
  movieHours: number
  movieDays: number
}

async function fetchWatchTimeBreakdown(userId: string): Promise<WatchTimeBreakdown> {
  // Shows
  const { data: showData, error: showErr } = await supabase
    .from('user_shows')
    .select('episodes_seen, shows!inner(average_runtime)')
    .eq('user_id', userId)

  if (showErr) throw new Error(showErr.message)

  let showEpisodes = 0
  let showSeconds = 0
  if (showData) {
    for (const row of showData) {
      const show = Array.isArray(row.shows) ? row.shows[0] : row.shows
      const eps = row.episodes_seen ?? 0
      showEpisodes += eps
      if (show.average_runtime && eps > 0) {
        showSeconds += show.average_runtime * eps
      }
    }
  }

  // Movies
  const { data: movieData, error: movieErr } = await supabase
    .from('user_movies')
    .select('watched, movies!inner(runtime)')
    .eq('user_id', userId)
    .eq('watched', true)

  if (movieErr) throw new Error(movieErr.message)

  let movieCount = 0
  let movieSeconds = 0
  if (movieData) {
    for (const row of movieData) {
      movieCount++
      const movie = Array.isArray(row.movies) ? row.movies[0] : row.movies
      movieSeconds += movie?.runtime ?? 2 * 3600
    }
  }

  return {
    showEpisodes,
    showSeconds,
    showHours: Math.round(showSeconds / 3600),
    showDays: Math.floor(showSeconds / 86400),
    movieCount,
    movieSeconds,
    movieHours: Math.round(movieSeconds / 3600),
    movieDays: Math.floor(movieSeconds / 86400),
  }
}

export function useWatchTimeBreakdown() {
  const { user } = useAuth()
  return useQuery({
    queryKey: [...newStatsKeys.tabCounts(user?.id ?? ''), 'watchTime'] as const,
    queryFn: () => fetchWatchTimeBreakdown(user?.id ?? ''),
    staleTime: 1000 * 60 * 5,
    enabled: !!user,
  })
}

// ══════════════════════════════════════════════════════════════════
//  Repair User IDs — backfill NULL user_ids on imported data
// ══════════════════════════════════════════════════════════════════

export interface RepairUserIdsResult {
  success: boolean
  shows_fixed: number
  movies_fixed: number
  episodes_fixed: number
  error?: string
}

export function useRepairUserIds() {
  return useMutation({
    mutationFn: async (): Promise<RepairUserIdsResult> => {
      const { data, error } = await supabase.rpc('backfill_user_ids')

      if (error) {
        // If the RPC doesn't exist yet, guide the user
        if (error.message?.includes('function "backfill_user_ids" does not exist')) {
          throw new Error(
            'Run the migration first:\n\n' +
            '1. Open Supabase Dashboard > SQL Editor\n' +
            '2. Run supabase/migrations/00011_backfill_user_ids.sql\n' +
            '3. Then tap this button again'
          )
        }
        throw new Error(`Failed to repair user IDs: ${error.message}`)
      }

      return data as RepairUserIdsResult
    },
  })
}
