import { useEffect } from 'react';
import { useAppStore } from '@/stores/appStore';
import { useUpcomingEpisodes } from '@/lib/queries/upcoming';
import { scheduleLocalReminder, cancelAllReminders } from '@/utils/notifications';

export function useNotificationScheduler() {
  const notificationsEnabled = useAppStore((s) => s.notificationsEnabled);
  const { data: upcomingEpisodes } = useUpcomingEpisodes();

  useEffect(() => {
    async function setupReminders() {
      if (!notificationsEnabled) {
        await cancelAllReminders();
        return;
      }

      // Schedule reminders for all upcoming episodes
      if (upcomingEpisodes) {
        for (const section of upcomingEpisodes) {
          for (const episode of section.episodes) {
            if (episode.airTime) {
              const airDate = new Date(episode.airTime);
              // Only schedule if in the future
              if (airDate > new Date()) {
                await scheduleLocalReminder(
                  episode.episodeName || 'New Episode',
                  episode.showName,
                  airDate
                );
              }
            }
          }
        }
      }
    }

    setupReminders();
  }, [notificationsEnabled, upcomingEpisodes]);
}
