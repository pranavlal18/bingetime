import { Platform, Alert, Linking } from 'react-native'
import Constants, { ExecutionEnvironment } from 'expo-constants'

// Check if we're in Expo Go — which doesn't support expo-notifications on Android
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient

// Lazy-load expo-notifications only when needed
let Notifications: any = null
async function getNotificationsModule() {
  if (Platform.OS === 'web') return null
  if (isExpoGo && Platform.OS === 'android') return null
  if (!Notifications) {
    const module = await import('expo-notifications')
    Notifications = module.default || module
  }
  return Notifications
}

// Configure notification behavior + Android channel
async function configureNotifications() {
  const mod = await getNotificationsModule()
  if (!mod) return

  mod.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  })

  // Create Android notification channel
  if (Platform.OS === 'android') {
    await mod.setNotificationChannelAsync('episode-reminders', {
      name: 'Episode Reminders',
      importance: 4, // AndroidImportance.HIGH
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#e94560',
    })
  }
}

// Initialize configuration
configureNotifications()

/**
 * Requests notification permissions from the system.
 * Returns true if granted, false otherwise.
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  const mod = await getNotificationsModule()

  if (!mod) {
    Alert.alert(
      'Notifications Unavailable',
      'Local notifications require a development build. They are not available in Expo Go on Android. Please create a development build to test this feature.',
      [{ text: 'OK' }]
    )
    return false
  }

  const { status: existingStatus } = await mod.getPermissionsAsync()
  let finalStatus = existingStatus

  if (finalStatus !== 'granted') {
    const { status } = await mod.requestPermissionsAsync()
    finalStatus = status
  }

  if (finalStatus !== 'granted') {
    Alert.alert(
      'Notifications Disabled',
      'To receive episode reminders, please enable notifications in your device settings.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: () => Linking.openSettings() },
      ]
    )
    return false
  }

  return true
}

/**
 * Schedules a local notification for an episode.
 */
export async function scheduleLocalReminder(
  episodeName: string,
  showName: string,
  showId: string,
  seasonNumber: number,
  episodeNumber: number,
  airDate: Date
) {
  const mod = await getNotificationsModule()
  if (!mod) return

  // Only schedule if air date is in the future
  if (airDate <= new Date()) return

  const formattedEp = `S${String(seasonNumber).padStart(2, '0')}E${String(episodeNumber).padStart(2, '0')}`

  await mod.scheduleNotificationAsync({
    content: {
      title: `${showName} ${formattedEp} — Airs Now`,
      body: episodeName,
      data: { showName, episodeName, showId, seasonNumber, episodeNumber },
    },
    trigger: {
      type: 'date',
      date: airDate,
      channelId: 'episode-reminders',
    },
  })
}

/**
 * Cancels all scheduled local notifications.
 */
export async function cancelAllReminders() {
  const mod = await getNotificationsModule()
  if (!mod) return

  await mod.cancelAllScheduledNotificationsAsync()
}

/**
 * Returns all currently scheduled notifications.
 * Returns empty array if the module is unavailable (Expo Go on Android).
 */
export async function getAllScheduledNotifications() {
  const mod = await getNotificationsModule()
  if (!mod) return []
  return await mod.getAllScheduledNotificationsAsync()
}

export async function getPermissionStatus() {
  const mod = await getNotificationsModule()
  if (!mod) return { status: 'undetermined' as const }

  return await mod.getPermissionsAsync()
}
