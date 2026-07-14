// ─── Discover Tab — TMDb search + trending + add-to-library ───

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import * as tmdb from '@/lib/tmdb'

// ── Unified result type for the Discover tab ──

export type MediaFilter = 'all' | 'tv' | 'movie'

export interface DiscoverResult {
  tmdbId: number
  mediaType: 'tv' | 'movie'
  title: string
  poster_path: string | null
  year: string | null
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
  return {
    tmdbId: item.id,
    mediaType: isMovie ? 'movie' : 'tv',
    title: isMovie ? item.title : item.name,
    poster_path: item.poster_path ?? null,
    year: isMovie
      ? (item.release_date?.slice(0, 4) ?? null)
      : (item.first_air_date?.slice(0, 4) ?? null),
    overview: item.overview ?? null,
    inLibrary: false,
  }
}

async function enrichWithLibraryStatus(
  results: DiscoverResult[],
  userId: string
): Promise<DiscoverResult[]> {
  if (results.length === 0 || !userId) return []

  const tmdbIds = results.map((r) => r.tmdbId)

  // Check shows by tmdb_id — only include items with is_watchlist: true for this user
  const { data: existingShows } = await supabase
    .from('shows')
    .select('id, tmdb_id, user_shows!inner(is_watchlist)')
    .in('tmdb_id', tmdbIds)
    .not('tmdb_id', 'is', null)
    .eq('user_shows.user_id', userId)
    .eq('user_shows.is_watchlist', true)

  // Check movies by tmdb_id — only include items with is_watchlist: true for this user
  const { data: existingMovies } = await supabase
    .from('movies')
    .select('id, tmdb_id, user_movies!inner(is_watchlist)')
    .in('tmdb_id', tmdbIds)
    .not('tmdb_id', 'is', null)
    .eq('user_movies.user_id', userId)
    .eq('user_movies.is_watchlist', true)

  // Build lookup maps
  const showMap = new Map<number, string>()
  if (existingShows) {
    for (const s of existingShows) {
      if (s.tmdb_id) showMap.set(s.tmdb_id, s.id)
    }
  }
  const movieMap = new Map<number, string>()
  if (existingMovies) {
    for (const m of existingMovies) {
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
      console.log('✅ [useAddToLibrary] Added to library:', libraryId)
      
      // Manually update the discover cache so it's not stale when switching tabs
      queryClient.setQueriesData<DiscoverResult[]>({ queryKey: ['discover'] }, (old) => {
        if (!Array.isArray(old)) return old
        return old.map(r => r.tmdbId === item.tmdbId ? { ...r, inLibrary: true, libraryId: libraryId as string } : r)
      })

      // Refresh movies/shows/profile
      queryClient.invalidateQueries({ queryKey: ['movies'] })
      queryClient.invalidateQueries({ queryKey: ['shows'] })
      queryClient.invalidateQueries({ queryKey: ['profile'] })
    },
    onError: (error) => {
      console.error('❌ [useAddToLibrary] Error:', error.message)
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
      console.log('✅ [useRemoveFromLibrary] Removed from library')
      
      // Manually update the discover cache so it's not stale when switching tabs
      queryClient.setQueriesData<DiscoverResult[]>({ queryKey: ['discover'] }, (old) => {
        if (!Array.isArray(old)) return old
        return old.map(r => r.tmdbId === item.tmdbId ? { ...r, inLibrary: false, libraryId: undefined } : r)
      })

      // Refresh movies/shows/profile
      queryClient.invalidateQueries({ queryKey: ['movies'] })
      queryClient.invalidateQueries({ queryKey: ['shows'] })
      queryClient.invalidateQueries({ queryKey: ['profile'] })
    },
    onError: (error) => {
      console.error('❌ [useRemoveFromLibrary] Error:', error.message)
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
      console.warn(`[addShowToLibrary] getShowDetails failed for ${item.title}:`, err)
      return null
    }),
  ])

  // 2. Calculate average runtime from episode_run_time array (TMDb returns minutes, convert to seconds)
  let averageRuntime: number | null = null
  if (details?.episode_run_time && details.episode_run_time.length > 0) {
    const sum = details.episode_run_time.reduce((acc, val) => acc + val, 0)
    const avgMinutes = sum / details.episode_run_time.length
    averageRuntime = Math.round(avgMinutes * 60) // convert to seconds
    console.log(`[addShowToLibrary] ${item.title}: episode_run_time = ${details.episode_run_time}, avgRuntime = ${averageRuntime}s`)
  } else {
    console.warn(`[addShowToLibrary] ${item.title}: NO episode_run_time data from TMDb`)
  }

  // 3. Upsert show record (tvdb_id is unique NOT NULL)
  console.log('🔍 [addShowToLibrary] Upserting show:', { tmdbId: item.tmdbId, tvdbId: external.tvdb_id, title: item.title, totalEps: details?.number_of_episodes, averageRuntime })
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
      },
      { onConflict: 'tvdb_id' }
    )
    .select('id')
    .single()

  if (showError) {
    console.error('🔍 [addShowToLibrary] Show upsert failed:', showError)
    throw new Error(`Failed to add show: ${showError.message}`)
  }
  console.log('🔍 [addShowToLibrary] Show upserted:', { showId: show?.id })
  const showId = show?.id

  // 4. Upsert into user_shows (mark as following + watchlist)
  console.log('🔍 [addShowToLibrary] Upserting user_shows:', { showId, is_watchlist: true })
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
    console.error('🔍 [addShowToLibrary] user_shows upsert failed:', usError)
    throw new Error(`Failed to add show to library: ${usError.message}`)
  }
  console.log('🔍 [addShowToLibrary] Success')

  return showId
}

async function addMovieToLibrary(item: DiscoverResult, userId: string): Promise<string> {
  // 1. Upsert movie record
  console.log('🔍 [addMovieToLibrary] Upserting movie:', { tmdbId: item.tmdbId, title: item.title })
  const { data: movie, error: movieError } = await supabase
    .from('movies')
    .upsert(
      {
        tmdb_id: item.tmdbId,
        title: item.title,
        poster_path: item.poster_path,
        release_date: item.year ? `${item.year}-01-01` : null,
      },
      { onConflict: 'tmdb_id' }
    )
    .select('id')
    .single()

  if (movieError) {
    console.error('🔍 [addMovieToLibrary] Movie upsert failed:', movieError)
    throw new Error(`Failed to add movie: ${movieError.message}`)
  }
  console.log('🔍 [addMovieToLibrary] Movie upserted:', { movieId: movie?.id })
  const movieId = movie?.id

  // 2. Upsert into user_movies (mark as watchlist)
  console.log('🔍 [addMovieToLibrary] Upserting user_movies:', { movieId, is_watchlist: true })
  const { error: umError } = await supabase.from('user_movies').upsert(
    {
      movie_id: movieId,
      user_id: userId,
      is_watchlist: true,
    },
    { onConflict: 'movie_id,user_id' }
  )
  if (umError) {
    console.error('🔍 [addMovieToLibrary] user_movies upsert failed:', umError)
    throw new Error(`Failed to add movie to library: ${umError.message}`)
  }
  console.log('🔍 [addMovieToLibrary] Success')

  return movieId
}

export { tmdb }