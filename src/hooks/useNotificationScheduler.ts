import { Platform } from 'react-native'
import { useEffect } from 'react'
import { useAppStore } from '@/stores/appStore'
import { useUpcomingEpisodes } from '@/lib/queries/upcoming'
import {
  scheduleLocalReminder,
  cancelAllReminders,
  getAllScheduledNotifications,
} from '@/utils/notifications'

export function useNotificationScheduler() {
  const notificationsEnabled = useAppStore((s) => s.notificationsEnabled)
  const { data: upcomingEpisodes } = useUpcomingEpisodes()

  useEffect(() => {
    // Notifications are not available on web
    if (Platform.OS === 'web') return

    async function setupReminders() {
      if (!notificationsEnabled) {
        await cancelAllReminders()
        return
      }

      if (!upcomingEpisodes || upcomingEpisodes.length === 0) return

      // Get already-scheduled notifications to avoid duplicates
      const scheduled = await getAllScheduledNotifications()
      const scheduledKeys = new Set(
        scheduled.map(
          (n: any) =>
            `${n.content.data?.showId}-${n.content.data?.episodeName}`
        )
      )

      // Schedule reminders for all upcoming episodes not already scheduled
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

    setupReminders()
  }, [notificationsEnabled, upcomingEpisodes])
}
