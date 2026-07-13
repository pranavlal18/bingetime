/** Format runtime seconds into hours and minutes */
export function formatRuntime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

/** Format a date string into a readable format */
export function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Unknown'
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/** Calculate progress percentage */
export function calcProgress(seen: number, total: number): number {
  if (total === 0) return 0
  return Math.min((seen / total) * 100, 100)
}

/** Get year from a date string */
export function getYear(dateStr: string | null): string | undefined {
  if (!dateStr) return undefined
  return new Date(dateStr).getFullYear().toString()
}

/** Check if episode has aired */
export function isAired(airDate: string | null): boolean {
  if (!airDate) return false
  return new Date(airDate) <= new Date()
}

/** Get days until airing */
export function getDaysUntilAiring(airDate: string | null): number | null {
  if (!airDate || isAired(airDate)) return null
  const diff = new Date(airDate).getTime() - new Date().getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

/** Check if episode is "New" (aired in last 3 days and not watched) */
export function isNew(airDate: string | null, watched: boolean): boolean {
  if (!airDate || watched) return false
  const airedDate = new Date(airDate)
  const now = new Date()
  const threeDaysAgo = new Date()
  threeDaysAgo.setDate(now.getDate() - 3)
  return airedDate <= now && airedDate >= threeDaysAgo
}
