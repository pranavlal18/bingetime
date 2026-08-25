// ─── Library status enrichment ───
// Shared by Discover, browse pages (genre/network/company) and person credits
// so any poster card can show an accurate watchlist state with one batched
// Supabase lookup per page (never per card).

import { supabase } from '@/lib/supabase'

export interface LibraryStatus {
  inLibrary: boolean
  libraryId?: string
}

/**
 * Batched watchlist lookup for a page of TMDb titles.
 * Splits ids by mediaType and runs 2 parallel IN() queries (shows / movies)
 * filtered to this user's watchlist rows.
 */
export async function fetchLibraryStatus(
  items: Array<{ tmdbId: number; mediaType: 'tv' | 'movie' }>,
  userId: string
): Promise<Map<number, LibraryStatus>> {
  const map = new Map<number, LibraryStatus>()
  if (items.length === 0 || !userId) return map

  const tvIds = [...new Set(items.filter((i) => i.mediaType === 'tv').map((i) => i.tmdbId))]
  const movieIds = [...new Set(items.filter((i) => i.mediaType === 'movie').map((i) => i.tmdbId))]

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

  for (const s of existingShows.data ?? []) {
    if (s.tmdb_id) map.set(s.tmdb_id as number, { inLibrary: true, libraryId: s.id })
  }
  for (const m of existingMovies.data ?? []) {
    if (m.tmdb_id) map.set(m.tmdb_id as number, { inLibrary: true, libraryId: m.id })
  }
  return map
}
