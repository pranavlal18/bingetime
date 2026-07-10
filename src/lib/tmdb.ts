import Constants from 'expo-constants'
import type { TMDbFindResponse, TMDbSearchResponse, TMDbShowDetails } from '@/types'

const TMDB_API_KEY = Constants.expoConfig?.extra?.tmdbApiKey ?? process.env.EXPO_PUBLIC_TMDB_API_KEY ?? ''
const TMDB_BASE = 'https://api.themoviedb.org/3'

async function tmdbFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${TMDB_BASE}${path}`)
  url.searchParams.set('api_key', TMDB_API_KEY)
  url.searchParams.set('language', 'en-US')
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))

  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`TMDb error ${res.status}: ${res.statusText}`)
  return res.json()
}

/** Resolve a TheTVDB ID → TMDb show/movie result */
export async function findByExternalId(tvdbId: number) {
  return tmdbFetch<TMDbFindResponse>(`/find/${tvdbId}`, { external_source: 'tvdb_id' })
}

/** Search TMDb by title + optional year (for movies) */
export async function searchMulti(query: string, year?: string) {
  const params: Record<string, string> = { query }
  if (year) params.year = year
  return tmdbFetch<TMDbSearchResponse>('/search/multi', params)
}

/** Search movies by title + year */
export async function searchMovie(query: string, year?: string) {
  const params: Record<string, string> = { query }
  if (year) params.year = year
  return tmdbFetch<TMDbSearchResponse>('/search/movie', params)
}

/** Search TV shows by title */
export async function searchTv(query: string) {
  return tmdbFetch<TMDbSearchResponse>('/search/tv', { query })
}

/** Get full show details including seasons */
export async function getShowDetails(tmdbId: number) {
  return tmdbFetch<TMDbShowDetails>(`/tv/${tmdbId}`, { append_to_response: 'seasons' })
}

/** Get movie details (overview, runtime, genres) */
export async function getMovieDetails(tmdbId: number) {
  return tmdbFetch<TMDbMovieDetails>(`/movie/${tmdbId}`)
}

/** Get season details with episode list */
export async function getSeasonDetails(tmdbId: number, seasonNumber: number) {
  return tmdbFetch<TMDbSeasonDetails>(`/tv/${tmdbId}/season/${seasonNumber}`)
}

/** Get trending shows/movies */
export async function getTrending(mediaType: 'tv' | 'movie' | 'all' = 'tv') {
  return tmdbFetch<TMDbSearchResponse>(`/trending/${mediaType}/week`)
}

/** Get external IDs (TVDB, IMDb) for a TMDb entity */
export async function getExternalIds(tmdbId: number, mediaType: 'tv' | 'movie' = 'tv') {
  return tmdbFetch<{ tvdb_id?: number; imdb_id?: string }>(`/${mediaType}/${tmdbId}/external_ids`)
}

/** Get show recommendations */
export async function getRecommendations(tmdbId: number) {
  return tmdbFetch<TMDbSearchResponse>(`/tv/${tmdbId}/recommendations`)
}

/** Get similar shows */
export async function getSimilar(tmdbId: number) {
  return tmdbFetch<TMDbSearchResponse>(`/tv/${tmdbId}/similar`)
}

/** Get poster/image URL */
export function getImageUrl(path: string | null, size: 'w92' | 'w154' | 'w185' | 'w342' | 'w500' | 'w780' | 'original' = 'w342'): string | null {
  if (!path) return null
  return `https://image.tmdb.org/t/p/${size}${path}`
}
