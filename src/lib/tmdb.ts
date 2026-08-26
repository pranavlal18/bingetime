import Constants from 'expo-constants'
import type { TMDbFindResponse, TMDbSearchResponse, TMDbShowDetails, TMDbMovieDetails, TMDbSeasonDetails } from '@/types'
import { throttledFetch } from './tmdbThrottle'

const TMDB_API_KEY = Constants.expoConfig?.extra?.tmdbApiKey ?? process.env.EXPO_PUBLIC_TMDB_API_KEY ?? ''
const TMDB_BASE = 'https://api.themoviedb.org/3'

async function tmdbFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${TMDB_BASE}${path}`)
  url.searchParams.set('api_key', TMDB_API_KEY)
  url.searchParams.set('language', 'en-US')
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))

  const res = await throttledFetch(url.toString())
  if (!res.ok) throw new Error(`TMDb error ${res.status}: ${res.statusText}`)
  return res.json()
}

/** TMDb fetch WITHOUT forced 'en-US' language — for searching non-English titles */
async function tmdbFetchAgnostic<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${TMDB_BASE}${path}`)
  url.searchParams.set('api_key', TMDB_API_KEY)
  // No language param = API returns results in the title's native language
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))

  const res = await throttledFetch(url.toString())
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

/** Search movies by title + year (with language constraint for standard searches) */
export async function searchMovie(query: string, year?: string) {
  const params: Record<string, string> = { query }
  if (year) params.year = year
  return tmdbFetch<TMDbSearchResponse>('/search/movie', params)
}

/** Search movies by title + year WITHOUT language constraint — for non-English titles */
export async function searchMovieAgnostic(query: string, year?: string) {
  const params: Record<string, string> = { query }
  if (year) params.year = year
  // Use a custom fetch that doesn't force 'en-US' language
  return tmdbFetchAgnostic<TMDbSearchResponse>('/search/movie', params)
}

/** Search TV shows by title */
export async function searchTv(query: string) {
  return tmdbFetch<TMDbSearchResponse>('/search/tv', { query })
}

/** Get full show details including seasons */
export async function getShowDetails(tmdbId: number) {
  return tmdbFetch<TMDbShowDetails>(`/tv/${tmdbId}`, { append_to_response: 'seasons' })
}

/** Get basic show details (no seasons). Used by upcoming tab for next_episode_to_air + networks. */
export async function getShowBasicDetails(tmdbId: number) {
  return tmdbFetch<TMDbShowDetails>(`/tv/${tmdbId}`)
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

/** Allowed sort values for genre discovery (subset of TMDb sort_by). */
export type GenreSortBy =
  | 'popularity.desc'
  | 'vote_average.desc'
  | 'primary_release_date.desc'
  | 'first_air_date.desc'
  | 'original_title.asc'
  | 'vote_count.desc'

/** What a browse page filters TMDb discover by */
export type DiscoverFilterKind = 'genre' | 'network' | 'company'

/** Discover titles by genre / network / company, paged — backs all browse pages */
export async function discoverTitles(
  mediaType: 'tv' | 'movie',
  kind: DiscoverFilterKind,
  id: number | string,
  page = 1,
  sortBy: GenreSortBy = 'popularity.desc'
) {
  // TMDb's with_networks filter only exists on /discover/tv — the movie side of
  // a network page resolves through streaming watch providers instead (same
  // brands, different id space), so `id` is then the provider id.
  const filterParam =
    kind === 'genre'
      ? 'with_genres'
      : kind === 'network' && mediaType === 'movie'
        ? 'with_watch_providers'
        : kind === 'network'
          ? 'with_networks'
          : 'with_companies'
  const params: Record<string, string> = {
    [filterParam]: String(id),
    sort_by: sortBy,
    include_adult: 'false',
    page: String(page),
  }
  if (kind === 'network' && mediaType === 'movie') {
    params['watch_region'] = NETWORK_WATCH_REGION
  }
  // "Newest" should show already-released titles, not far-future (e.g. 2030) placeholders
  if (sortBy === 'primary_release_date.desc' || sortBy === 'first_air_date.desc') {
    const today = new Date().toISOString().slice(0, 10)
    if (mediaType === 'movie') {
      params['primary_release_date.lte'] = today
    } else {
      params['first_air_date.lte'] = today
    }
  }
  return tmdbFetch<TMDbSearchResponse>(`/discover/${mediaType}`, params)
}

// Back-compat alias — existing call sites use discoverByGenre
export const discoverByGenre = (
  mediaType: 'tv' | 'movie',
  genreId: number,
  page = 1,
  sortBy: GenreSortBy = 'popularity.desc'
) => discoverTitles(mediaType, 'genre', genreId, page, sortBy)

/** Region used to resolve watch-provider availability for network movie sides */
export const NETWORK_WATCH_REGION = 'US'

/** A streaming watch provider (Netflix=8, Prime Video=119, Max=189...) */
export interface TMDbWatchProvider {
  provider_id: number
  provider_name: string
}

/**
 * Movie watch-provider list for a region — used to map a TV network's brand
 * name onto its movie-side provider (networks are TV-only in TMDb).
 */
export async function getMovieWatchProviders(region: string = NETWORK_WATCH_REGION) {
  return tmdbFetch<{ results: TMDbWatchProvider[] }>(
    `/watch/providers/movie`,
    { watch_region: region }
  )
}

export interface TMDbGenre {
  id: number
  name: string
}

export async function getGenres(mediaType: 'tv' | 'movie') {
  return tmdbFetch<{ genres: TMDbGenre[] }>(`/genre/${mediaType}/list`)
}

/** Get external IDs (TVDB, IMDb) for a TMDb entity */
export async function getExternalIds(tmdbId: number, mediaType: 'tv' | 'movie' = 'tv') {
  return tmdbFetch<{ tvdb_id?: number; imdb_id?: string }>(`/${mediaType}/${tmdbId}/external_ids`)
}

/** A single cast member (actor headshot + character name) */
export interface TMDbCastMember {
  id: number
  name: string
  character: string
  profile_path: string | null
}

/** Credits response (only the cast array is needed here) */
export interface TMDbCredits {
  cast: TMDbCastMember[]
}

/** Get cast credits for a show or movie — used for the profile avatar collage */
export async function getTitleCredits(tmdbId: number, mediaType: 'tv' | 'movie' = 'tv') {
  return tmdbFetch<TMDbCredits>(`/${mediaType}/${tmdbId}/credits`)
}

/** A single credit entry from /person/{id}/combined_credits */
export interface TMDbCombinedCredit {
  id: number
  media_type: 'tv' | 'movie'
  title?: string // movies
  name?: string // tv
  release_date?: string // movies
  first_air_date?: string // tv
  character?: string // cast entries
  job?: string // crew entries
  department?: string
  poster_path?: string | null
  popularity?: number
  vote_average?: number
  vote_count?: number
  episode_count?: number // tv entries
  genre_ids?: number[] // tv genre ids (e.g. 10764 Reality, 10767 Talk)
}

/** Person details with combined credits appended */
export interface TMDbPersonDetails {
  id: number
  name: string
  biography: string | null
  birthday: string | null
  deathday: string | null
  place_of_birth: string | null
  known_for_department: string | null
  profile_path: string | null
  combined_credits?: {
    cast: TMDbCombinedCredit[]
    crew: TMDbCombinedCredit[]
  }
}

/** Get person details with combined credits in one request */
export async function getPersonDetails(tmdbId: number) {
  return tmdbFetch<TMDbPersonDetails>(`/person/${tmdbId}`, {
    append_to_response: 'combined_credits',
  })
}

/** Get poster/image URL */
export function getImageUrl(path: string | null, size: 'w92' | 'w154' | 'w185' | 'w342' | 'w500' | 'w780' | 'original' = 'w342'): string | null {
  if (!path) return null
  return `https://image.tmdb.org/t/p/${size}${path}`
}
