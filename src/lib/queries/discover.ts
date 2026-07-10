// ─── Discover Tab — TMDb search + trending + add-to-library ───

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
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
  trending: (filter: MediaFilter) => ['discover', 'trending', { filter }] as const,
  search: (query: string, filter: MediaFilter) => ['discover', 'search', { query, filter }] as const,
  checkLibrary: ['discover', 'library'] as const,
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

async function enrichWithLibraryStatus(results: DiscoverResult[]): Promise<DiscoverResult[]> {
  if (results.length === 0) return []

  const tmdbIds = results.map((r) => r.tmdbId)

  // Check shows by tmdb_id
  const { data: existingShows } = await supabase
    .from('shows')
    .select('id, tmdb_id')
    .in('tmdb_id', tmdbIds)
    .not('tmdb_id', 'is', null)

  // Check movies by tmdb_id
  const { data: existingMovies } = await supabase
    .from('movies')
    .select('id, tmdb_id')
    .in('tmdb_id', tmdbIds)
    .not('tmdb_id', 'is', null)

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

async function fetchTrending(filter: MediaFilter): Promise<DiscoverResult[]> {
  let results: DiscoverResult[] = []

  if (filter === 'all' || filter === 'tv') {
    const tvData = await tmdb.getTrending('tv')
    results.push(...tvData.results.map(mapResult))
  }
  if (filter === 'all' || filter === 'movie') {
    const movieData = await tmdb.getTrending('movie')
    results.push(...movieData.results.map(mapResult))
  }

  return enrichWithLibraryStatus(results)
}

export function useTrending(filter: MediaFilter) {
  return useQuery({
    queryKey: discoverKeys.trending(filter),
    queryFn: () => fetchTrending(filter),
    staleTime: 1000 * 60 * 10, // 10 min — trending changes slowly
  })
}

// ── Search ──

async function fetchSearch(query: string, filter: MediaFilter): Promise<DiscoverResult[]> {
  if (!query.trim()) return []

  let results: DiscoverResult[] = []

  if (filter === 'all') {
    const { results: raw } = await tmdb.searchMulti(query)
    results = raw
      .filter((item: any) => item.media_type === 'tv' || item.media_type === 'movie')
      .map(mapResult)
  } else if (filter === 'tv') {
    const { results: raw } = await tmdb.searchTv(query)
    results = raw.map((item: any) => mapResult({ ...item, media_type: 'tv' }))
  } else {
    const { results: raw } = await tmdb.searchMovie(query)
    results = raw.map((item: any) => mapResult({ ...item, media_type: 'movie' }))
  }

  return enrichWithLibraryStatus(results)
}

export function useSearch(query: string, filter: MediaFilter) {
  return useQuery({
    queryKey: discoverKeys.search(query, filter),
    queryFn: () => fetchSearch(query, filter),
    enabled: query.trim().length > 0,
    staleTime: 1000 * 60 * 5,
  })
}

// ── Add to library ──

export function useAddToLibrary() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (item: DiscoverResult) => {
      if (item.mediaType === 'tv') {
        return addShowToLibrary(item)
      }
      return addMovieToLibrary(item)
    },
    onSuccess: () => {
      // Refresh discover (library status) and profile (watchlist)
      queryClient.invalidateQueries({ queryKey: discoverKeys.all })
      queryClient.invalidateQueries({ queryKey: ['movies'] })
      queryClient.invalidateQueries({ queryKey: ['shows'] })
      queryClient.invalidateQueries({ queryKey: ['profile'] })
    },
  })
}

async function addShowToLibrary(item: DiscoverResult): Promise<string> {
  // 1. Get TVDB ID from TMDb
  const external = await tmdb.getExternalIds(item.tmdbId, 'tv')

  // 2. Upsert show record (tvdb_id is unique NOT NULL)
  const { data: show, error: showError } = await supabase
    .from('shows')
    .upsert(
      {
        tmdb_id: item.tmdbId,
        tvdb_id: external.tvdb_id ?? item.tmdbId, // fallback to tmdb_id if no tvdb_id
        name: item.title,
        poster_path: item.poster_path,
        last_air_date: item.year ? `${item.year}-01-01` : null,
      },
      { onConflict: 'tvdb_id' }
    )
    .select('id')
    .single()

  if (showError) throw new Error(`Failed to add show: ${showError.message}`)
  const showId = show.id

  // 3. Upsert into user_shows (mark as following + watchlist)
  const { error: usError } = await supabase.from('user_shows').upsert(
    {
      show_id: showId,
      is_following: true,
      is_watchlist: true,
    },
    { onConflict: 'show_id' }
  )
  if (usError) throw new Error(`Failed to add show to library: ${usError.message}`)

  return showId
}

async function addMovieToLibrary(item: DiscoverResult): Promise<string> {
  // 1. Upsert movie record
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

  if (movieError) throw new Error(`Failed to add movie: ${movieError.message}`)
  const movieId = movie.id

  // 2. Upsert into user_movies (mark as watchlist)
  const { error: umError } = await supabase.from('user_movies').upsert(
    {
      movie_id: movieId,
      is_watchlist: true,
    },
    { onConflict: 'movie_id' }
  )
  if (umError) throw new Error(`Failed to add movie to library: ${umError.message}`)

  return movieId
}

export { tmdb }
