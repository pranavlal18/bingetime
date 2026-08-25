// ─── Discover Tab — TMDb search + trending + add-to-library ───

import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import * as tmdb from '@/lib/tmdb'
import { upcomingKeys } from './upcoming'

// ── Unified result type for the Discover tab ──

export type MediaFilter = 'all' | 'tv' | 'movie'

export interface DiscoverResult {
  tmdbId: number
  mediaType: 'tv' | 'movie'
  title: string
  poster_path: string | null
  year: string | null
  releaseDate: string | null
  overview: string | null
  inLibrary: boolean
  libraryId?: string
}

// ── Query keys ──

export const discoverKeys = {
  all: ['discover'] as const,
  trending: (filter: MediaFilter, userId: string) => ['discover', 'trending', { filter, userId }] as const,
  search: (query: string, filter: MediaFilter, userId: string) => ['discover', 'search', { query, filter, userId }] as const,
}

// ── Helpers ──

function mapResult(item: any): DiscoverResult {
  const isMovie = item.media_type === 'movie'
  const release = isMovie ? item.release_date : item.first_air_date
  return {
    tmdbId: item.id,
    mediaType: isMovie ? 'movie' : 'tv',
    title: isMovie ? item.title : item.name,
    poster_path: item.poster_path ?? null,
    year: release?.slice(0, 4) ?? null,
    releaseDate: release ?? null,
    overview: item.overview ?? null,
    inLibrary: false,
  }
}

async function enrichWithLibraryStatus(
  results: DiscoverResult[],
  userId: string
): Promise<DiscoverResult[]> {
  if (results.length === 0 || !userId) return []

  // Split IDs by media type — tv 123 and movie 123 are different titles, so
  // each table should only be queried with its own IDs (in parallel).
  const tvIds = results.filter((r) => r.mediaType === 'tv').map((r) => r.tmdbId)
  const movieIds = results.filter((r) => r.mediaType === 'movie').map((r) => r.tmdbId)

  const [existingShows, existingMovies] = await Promise.all([
    tvIds.length > 0
      ? supabase
          .from('shows')
          .select('id, tmdb_id, user_shows!inner(is_watchlist)')
          .in('tmdb_id', tvIds)
          .not('tmdb_id', 'is', null)
          .eq('user_shows.user_id', userId)
          .eq('user_shows.is_watchlist', true)
      : Promise.resolve({ data: [] as any[] }),
    movieIds.length > 0
      ? supabase
          .from('movies')
          .select('id, tmdb_id, user_movies!inner(is_watchlist)')
          .in('tmdb_id', movieIds)
          .not('tmdb_id', 'is', null)
          .eq('user_movies.user_id', userId)
          .eq('user_movies.is_watchlist', true)
      : Promise.resolve({ data: [] as any[] }),
  ])

  // Build lookup maps
  const showMap = new Map<number, string>()
  if (existingShows?.data) {
    for (const s of existingShows.data) {
      if (s.tmdb_id) showMap.set(s.tmdb_id, s.id)
    }
  }
  const movieMap = new Map<number, string>()
  if (existingMovies?.data) {
    for (const m of existingMovies.data) {
      if (m.tmdb_id) movieMap.set(m.tmdb_id, m.id)
    }
  }

  return results.map((r) => {
    const libId = r.mediaType === 'tv' ? showMap.get(r.tmdbId) : movieMap.get(r.tmdbId)
    return { ...r, inLibrary: !!libId, libraryId: libId }
  })
}

// ── Fetch trending ──

async function fetchTrending(filter: MediaFilter, userId: string): Promise<DiscoverResult[]> {
  let results: DiscoverResult[] = []

  if (filter === 'all' || filter === 'tv') {
    const tvData = await tmdb.getTrending('tv')
    results.push(...tvData.results.map(mapResult))
  }
  if (filter === 'all' || filter === 'movie') {
    const movieData = await tmdb.getTrending('movie')
    results.push(...movieData.results.map(mapResult))
  }

  return enrichWithLibraryStatus(results, userId)
}

export function useTrending(filter: MediaFilter) {
  const { user } = useAuth()

  return useQuery({
    queryKey: discoverKeys.trending(filter, user?.id ?? ''),
    queryFn: () => fetchTrending(filter, user?.id ?? ''),
    staleTime: 1000 * 60 * 10, // 10 min — trending changes slowly
    enabled: !!user,
  })
}

// ── Browse pages (genre / network / company) — public TMDb data, paged ──

export interface DiscoverTitle {
  tmdbId: number
  mediaType: 'tv' | 'movie'
  title: string
  poster_path: string | null
  year: string | null
}

const DISCOVER_TITLES_STALE_TIME = 1000 * 60 * 10 // 10 min

export type BrowseSortOption = {
  label: string
  value: tmdb.GenreSortBy
}

export const BROWSE_SORT_OPTIONS: Record<'tv' | 'movie', BrowseSortOption[]> = {
  tv: [
    { label: 'Popular', value: 'popularity.desc' },
    { label: 'Top Rated', value: 'vote_average.desc' },
    { label: 'Newest', value: 'first_air_date.desc' },
    { label: 'A–Z', value: 'original_title.asc' },
    { label: 'Most Votes', value: 'vote_count.desc' },
  ],
  movie: [
    { label: 'Popular', value: 'popularity.desc' },
    { label: 'Top Rated', value: 'vote_average.desc' },
    { label: 'Newest', value: 'primary_release_date.desc' },
    { label: 'A–Z', value: 'original_title.asc' },
    { label: 'Most Votes', value: 'vote_count.desc' },
  ],
}

export function useGenres(mediaType: 'tv' | 'movie') {
  return useQuery({
    queryKey: ['tmdb', 'genres', mediaType],
    queryFn: () => tmdb.getGenres(mediaType),
    staleTime: 1000 * 60 * 60 * 24,
    gcTime: 1000 * 60 * 60 * 24 * 7,
  })
}

export function useDiscoverTitles(
  mediaType: 'tv' | 'movie',
  kind: tmdb.DiscoverFilterKind,
  id: number | null,
  sortBy: tmdb.GenreSortBy = 'popularity.desc'
) {
  return useInfiniteQuery({
    queryKey: ['tmdb', 'discover', mediaType, kind, id, sortBy],
    queryFn: async ({ pageParam }) => {
      const res = await tmdb.discoverTitles(mediaType, kind, id as number, pageParam, sortBy)
      const items: DiscoverTitle[] = res.results.map((r) => ({
        tmdbId: r.id,
        mediaType,
        title: (mediaType === 'movie' ? r.title : r.name) ?? 'Unknown',
        poster_path: r.poster_path ?? null,
        year: ((mediaType === 'movie' ? r.release_date : r.first_air_date) ?? '').slice(0, 4) || null,
      }))
      return { items, nextPage: res.results.length > 0 ? pageParam + 1 : undefined }
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.nextPage,
    enabled: !!id,
    staleTime: DISCOVER_TITLES_STALE_TIME,
    gcTime: 1000 * 60 * 30,
  })
}

// ── Search ──

/** Extract a trailing 4-digit year from the query and return clean query + year */
function extractYear(query: string): { cleanQuery: string; year: string | undefined } {
  const match = query.trim().match(/^(.*?)\s+((?:19|20)\d{2})$/)
  if (match) {
    return { cleanQuery: match[1], year: match[2] }
  }
  return { cleanQuery: query.trim(), year: undefined }
}

async function fetchSearch(
  query: string,
  filter: MediaFilter,
  userId: string
): Promise<DiscoverResult[]> {
  if (!query.trim()) return []

  const { cleanQuery, year } = extractYear(query)
  if (!cleanQuery) return []

  let results: DiscoverResult[] = []

  if (filter === 'all') {
    const { results: raw } = await tmdb.searchMulti(cleanQuery)
    results = raw
      .filter((item: any) => item.media_type === 'tv' || item.media_type === 'movie')
      .filter((item: any) => {
        // /search/multi doesn't support year param — filter client-side
        if (!year) return true
        const date = item.media_type === 'movie' ? item.release_date : item.first_air_date
        return date?.startsWith(year)
      })
      .map(mapResult)
  } else if (filter === 'tv') {
    const { results: raw } = await tmdb.searchTv(cleanQuery)
    // /search/tv doesn't support year param — filter client-side
    results = raw
      .filter((item: any) => !year || (item.first_air_date?.startsWith(year)))
      .map((item: any) => mapResult({ ...item, media_type: 'tv' }))
  } else {
    const { results: raw } = await tmdb.searchMovie(cleanQuery, year)
    results = raw.map((item: any) => mapResult({ ...item, media_type: 'movie' }))
  }

  return enrichWithLibraryStatus(results, userId)
}

export function useSearch(query: string, filter: MediaFilter) {
  const { user } = useAuth()

  return useQuery({
    queryKey: discoverKeys.search(query, filter, user?.id ?? ''),
    queryFn: () => fetchSearch(query, filter, user?.id ?? ''),
    enabled: !!user && query.trim().length > 0,
    staleTime: 1000 * 60 * 5,
  })
}

// ── Add to library ──

export function useAddToLibrary() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (item: DiscoverResult) => {
      if (!user) throw new Error('Not authenticated')
      if (item.mediaType === 'tv') {
        return addShowToLibrary(item, user.id)
      }
      return addMovieToLibrary(item, user.id)
    },
    onSuccess: (libraryId, item) => {
      if (__DEV__) console.log('✅ [useAddToLibrary] Added to library:', libraryId)
      
      // Manually update the discover cache so it's not stale when switching tabs
      queryClient.setQueriesData<DiscoverResult[]>({ queryKey: ['discover'] }, (old) => {
        if (!Array.isArray(old)) return old
        return old.map(r => r.tmdbId === item.tmdbId ? { ...r, inLibrary: true, libraryId: libraryId as string } : r)
      })

      // Refresh movies/shows/profile
      queryClient.invalidateQueries({ queryKey: ['movies'] })
      queryClient.invalidateQueries({ queryKey: ['shows'] })
      queryClient.invalidateQueries({ queryKey: ['profile'] })
      // Refresh stats (tab counts, remaining, watch time, etc.)
      queryClient.invalidateQueries({ queryKey: ['stats'] })

      // Invalidate Upcoming so newly added running TV shows appear immediately
      if (item.mediaType === 'tv' && user) {
        queryClient.invalidateQueries({ queryKey: upcomingKeys.list(user.id) })
      }
    },
    onError: (error) => {
      if (__DEV__) console.error('❌ [useAddToLibrary] Error:', error.message)
    },
  })
}

export function useRemoveFromLibrary() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (item: DiscoverResult) => {
      if (!user) throw new Error('Not authenticated')
      if (!item.libraryId) return
      if (item.mediaType === 'tv') {
        return removeShowFromLibrary(item.libraryId, user.id)
      }
      return removeMovieFromLibrary(item.libraryId, user.id)
    },
    onSuccess: (_data, item) => {
      if (__DEV__) console.log('✅ [useRemoveFromLibrary] Removed from library')
      
      // Manually update the discover cache so it's not stale when switching tabs
      queryClient.setQueriesData<DiscoverResult[]>({ queryKey: ['discover'] }, (old) => {
        if (!Array.isArray(old)) return old
        return old.map(r => r.tmdbId === item.tmdbId ? { ...r, inLibrary: false, libraryId: undefined } : r)
      })

      // Refresh movies/shows/profile
      queryClient.invalidateQueries({ queryKey: ['movies'] })
      queryClient.invalidateQueries({ queryKey: ['shows'] })
      queryClient.invalidateQueries({ queryKey: ['profile'] })
      // Refresh stats (tab counts, remaining, watch time, etc.)
      queryClient.invalidateQueries({ queryKey: ['stats'] })
    },
    onError: (error) => {
      if (__DEV__) console.error('❌ [useRemoveFromLibrary] Error:', error.message)
    },
  })
}

async function removeShowFromLibrary(showId: string, userId: string) {
  const { error } = await supabase
    .from('user_shows')
    .update({ is_watchlist: false })
    .eq('show_id', showId)
    .eq('user_id', userId)
  if (error) throw new Error(`Failed to remove show: ${error.message}`)
}

async function removeMovieFromLibrary(movieId: string, userId: string) {
  const { error } = await supabase
    .from('user_movies')
    .update({ is_watchlist: false })
    .eq('movie_id', movieId)
    .eq('user_id', userId)
  if (error) throw new Error(`Failed to remove movie: ${error.message}`)
}

async function addShowToLibrary(item: DiscoverResult, userId: string): Promise<string> {
  // 1. Get TVDB ID + show details (number_of_episodes, episode_run_time) from TMDb
  const [external, details] = await Promise.all([
    tmdb.getExternalIds(item.tmdbId, 'tv'),
    tmdb.getShowDetails(item.tmdbId).catch((err) => {
      if (__DEV__) console.warn(`[addShowToLibrary] getShowDetails failed for ${item.title}:`, err)
      return null
    }),
  ])

  // 2. Calculate average runtime from episode_run_time array (TMDb returns minutes, convert to seconds)
  let averageRuntime: number | null = null
  if (details?.episode_run_time && details.episode_run_time.length > 0) {
    const sum = details.episode_run_time.reduce((acc, val) => acc + val, 0)
    const avgMinutes = sum / details.episode_run_time.length
    averageRuntime = Math.round(avgMinutes * 60) // convert to seconds
    if (__DEV__) console.log(`[addShowToLibrary] ${item.title}: episode_run_time = ${details.episode_run_time}, avgRuntime = ${averageRuntime}s`)
  } else {
    if (__DEV__) console.warn(`[addShowToLibrary] ${item.title}: NO episode_run_time data from TMDb`)
  }

  // 3. Upsert show record (tvdb_id is unique NOT NULL)
  if (__DEV__) console.log('🔍 [addShowToLibrary] Upserting show:', { tmdbId: item.tmdbId, tvdbId: external.tvdb_id, title: item.title, totalEps: details?.number_of_episodes, averageRuntime })
  const { data: show, error: showError } = await supabase
    .from('shows')
    .upsert(
      {
        tmdb_id: item.tmdbId,
        tvdb_id: external.tvdb_id ?? item.tmdbId, // fallback to tmdb_id if no tvdb_id
        name: item.title,
        poster_path: item.poster_path,
        last_air_date: item.year ? `${item.year}-01-01` : null,
        total_episodes: details?.number_of_episodes ?? null,
        average_runtime: averageRuntime,
        status: details?.status ?? null,  // Save TMDb status for Upcoming filtering
      },
      { onConflict: 'tvdb_id' }
    )
    .select('id')
    .single()

  if (showError) {
    if (__DEV__) console.error('🔍 [addShowToLibrary] Show upsert failed:', showError)
    throw new Error(`Failed to add show: ${showError.message}`)
  }
  if (__DEV__) console.log('🔍 [addShowToLibrary] Show upserted:', { showId: show?.id })
  const showId = show?.id

  // 4. Upsert into user_shows (mark as following + watchlist)
  if (__DEV__) console.log('🔍 [addShowToLibrary] Upserting user_shows:', { showId, is_watchlist: true })
  const { error: usError } = await supabase.from('user_shows').upsert(
    {
      show_id: showId,
      user_id: userId,
      is_following: true,
      is_watchlist: true,
    },
    { onConflict: 'show_id,user_id' }
  )
  if (usError) {
    if (__DEV__) console.error('🔍 [addShowToLibrary] user_shows upsert failed:', usError)
    throw new Error(`Failed to add show to library: ${usError.message}`)
  }
  if (__DEV__) console.log('🔍 [addShowToLibrary] Success')

  return showId
}

async function addMovieToLibrary(item: DiscoverResult, userId: string): Promise<string> {
  // 1. Resolve full release_date from TMDb (Discover only returns the year/heuristic date)
  let releaseDate: string | null = item.releaseDate ?? null
  if (!releaseDate) {
    try {
      const details = await tmdb.getMovieDetails(item.tmdbId)
      releaseDate = details.release_date ?? null
    } catch {
      // Fall back to year-only placeholder if TMDb fetch fails
      releaseDate = item.year ? `${item.year}-01-01` : null
    }
  }

  // 2. Upsert movie record
  if (__DEV__) console.log('🔍 [addMovieToLibrary] Upserting movie:', { tmdbId: item.tmdbId, title: item.title, releaseDate })
  const { data: movie, error: movieError } = await supabase
    .from('movies')
    .upsert(
      {
        tmdb_id: item.tmdbId,
        title: item.title,
        poster_path: item.poster_path,
        release_date: releaseDate,
      },
      { onConflict: 'tmdb_id' }
    )
    .select('id')
    .single()

  if (movieError) {
    if (__DEV__) console.error('🔍 [addMovieToLibrary] Movie upsert failed:', movieError)
    throw new Error(`Failed to add movie: ${movieError.message}`)
  }
  if (__DEV__) console.log('🔍 [addMovieToLibrary] Movie upserted:', { movieId: movie?.id })
  const movieId = movie?.id

  // 2. Upsert into user_movies (mark as watchlist)
  if (__DEV__) console.log('🔍 [addMovieToLibrary] Upserting user_movies:', { movieId, is_watchlist: true })
  const { error: umError } = await supabase.from('user_movies').upsert(
    {
      movie_id: movieId,
      user_id: userId,
      is_watchlist: true,
    },
    { onConflict: 'movie_id,user_id' }
  )
  if (umError) {
    if (__DEV__) console.error('🔍 [addMovieToLibrary] user_movies upsert failed:', umError)
    throw new Error(`Failed to add movie to library: ${umError.message}`)
  }
  if (__DEV__) console.log('🔍 [addMovieToLibrary] Success')

  return movieId
}

export { tmdb }