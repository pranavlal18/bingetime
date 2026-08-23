// ─── people queries — TMDb person pages (bio + credits) ───

import { useQuery } from '@tanstack/react-query'
import {
  getPersonDetails,
  type TMDbPersonDetails,
  type TMDbCombinedCredit,
} from '@/lib/tmdb'

/** Person details + combined credits in one cached request (public data). */
export function usePerson(personId: number | null | undefined) {
  return useQuery({
    queryKey: ['person', personId],
    queryFn: () => getPersonDetails(personId as number),
    enabled: !!personId,
    staleTime: 1000 * 60 * 60 * 24,
    gcTime: 1000 * 60 * 60 * 24 * 14,
  })
}

/** Cast ∪ crew credits, deduped by title id — cast entry wins over crew for the same id. */
export function dedupeCredits(person: TMDbPersonDetails | undefined): TMDbCombinedCredit[] {
  const byId = new Map<number, TMDbCombinedCredit>()
  const cast = person?.combined_credits?.cast ?? []
  const crew = person?.combined_credits?.crew ?? []
  // Insert crew first so cast entries overwrite duplicates.
  for (const credit of [...crew, ...cast]) {
    if (!byId.has(credit.id)) byId.set(credit.id, credit)
    else if (credit.character) byId.set(credit.id, credit)
  }
  return Array.from(byId.values())
}

/**
 * Talk-show / reality-show "appearance" credits — actors guesting as themselves
 * on Tonight Show-style programs. These pollute the Known For row and are
 * almost always credited with a self/guest/host variant character name.
 */
const SELF_APPEARANCE_RE =
  /^\s*(self|guest|guest star|guest appearance|host|co-host|herself|himself|themselves)\b/i

export function isSelfAppearance(credit: TMDbCombinedCredit): boolean {
  const role = credit.character?.trim() ?? ''
  return role.length > 0 && SELF_APPEARANCE_RE.test(role)
}

/** Top-n most popular SCRIPTED credited titles that have a poster — the "Known For" row. */
export function topKnownFor(
  person: TMDbPersonDetails | undefined,
  n = 8
): TMDbCombinedCredit[] {
  return dedupeCredits(person)
    .filter((c) => !!c.poster_path && c.popularity != null && !isSelfAppearance(c))
    .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
    .slice(0, n)
}
