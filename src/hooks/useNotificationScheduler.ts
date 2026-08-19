import { Platform } from 'react-native'
import { useEffect } from 'react'
import { useAppStore } from '@/stores/appStore'
import { useUpcomingEpisodes } from '@/lib/queries/upcoming'
import { useUpcomingMovies } from '@/lib/queries/movies'
import {
  scheduleLocalReminder,
  scheduleMovieReleaseReminder,
  cancelAllReminders,
  getAllScheduledNotifications,
} from '@/utils/notifications'

export function useNotificationScheduler() {
  const notificationsEnabled = useAppStore((s) => s.notificationsEnabled)
  const { data: upcomingEpisodes } = useUpcomingEpisodes()
  const { data: upcomingMovies } = useUpcomingMovies()

  useEffect(() => {
    // Notifications are not available on web
    if (Platform.OS === 'web') return

    async function setupReminders() {
      if (!notificationsEnabled) {
        await cancelAllReminders()
        return
      }

      // Get already-scheduled notifications to avoid duplicates
      const scheduled = await getAllScheduledNotifications()
      const scheduledKeys = new Set(
        scheduled.map(
          (n: any) => {
            const d = n.content.data ?? {}
            if (d.type === 'movie') return `movie:${d.movieId}-${d.movieTitle}`
            return `${d.showId}-${d.episodeName}`
          }
        )
      )

      // Schedule reminders for upcoming episodes
      if (upcomingEpisodes && upcomingEpisodes.length > 0) {
        for (const section of upcomingEpisodes) {
          for (const episode of section.episodes) {
            if (!episode.airTime) continue

            const key = `${episode.showId}-${episode.episodeName}`
            if (scheduledKeys.has(key)) continue

            const airDate = new Date(episode.airTime)
            if (airDate > new Date()) {
              await scheduleLocalReminder(
                episode.episodeName || 'New Episode',
                episode.showName,
                episode.showId,
                episode.seasonNumber,
                episode.episodeNumber,
                airDate
              )
            }
          }
        }
      }

      // Schedule reminders for upcoming movie releases
      if (upcomingMovies && upcomingMovies.length > 0) {
        for (const movie of upcomingMovies) {
          if (!movie.releaseDate) continue

          const key = `movie:${movie.id}-${movie.title}`
          if (scheduledKeys.has(key)) continue

          await scheduleMovieReleaseReminder(
            movie.title,
            movie.id,
            movie.releaseDate
          )
        }
      }
    }

    setupReminders()
  }, [notificationsEnabled, upcomingEpisodes, upcomingMovies])
}
