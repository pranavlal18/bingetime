// ─── credits queries — TMDb cast for any title (detail pages, profile collage) ───

import { useQuery } from '@tanstack/react-query'
import { getTitleCredits } from '@/lib/tmdb'

/** Cast credits for a show or movie. Public TMDb data — no auth gate needed. */
export function useTitleCredits(
  tmdbId: number | null | undefined,
  mediaType: 'tv' | 'movie' = 'tv'
) {
  return useQuery({
    queryKey: ['credits', mediaType, tmdbId],
    queryFn: () => getTitleCredits(tmdbId as number, mediaType),
    enabled: !!tmdbId,
    staleTime: 1000 * 60 * 60 * 24,
    gcTime: 1000 * 60 * 60 * 24 * 14,
  })
}
