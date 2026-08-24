// ─── Route prefetch helpers — warm detail-screen caches on card press ───
//
// Detail screens (app/show/[id].tsx, app/movie/[id].tsx) always fetch TMDb
// details via ['tmdb', 'show-details'|'movie-details', tmdbId] regardless of
// whether the title is in the library. Prefetching that query in a card's
// press handler makes the detail screen render from cache instantly.

import type { QueryClient } from '@tanstack/react-query'
import { getShowDetails, getMovieDetails } from '@/lib/tmdb'

/** Matches the 1h TMDb details staleTime used by the detail screens. */
const TMDB_DETAILS_STALE_TIME = 1000 * 60 * 60

export function prefetchTitleDetails(
  mediaType: 'tv' | 'movie',
  tmdbId: number,
  queryClient: QueryClient
): void {
  if (!Number.isFinite(tmdbId) || tmdbId <= 0) return

  const isTv = mediaType === 'tv'
  void queryClient
    .prefetchQuery({
      queryKey: ['tmdb', isTv ? 'show-details' : 'movie-details', tmdbId],
      queryFn: async () => {
        const details = isTv
          ? await getShowDetails(tmdbId)
          : await getMovieDetails(tmdbId)
        return details
      },
      staleTime: TMDB_DETAILS_STALE_TIME,
    })
    .catch(() => {
      // Fire-and-forget: detail screen will fetch normally if prefetch fails.
    })
}
