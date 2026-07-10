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
