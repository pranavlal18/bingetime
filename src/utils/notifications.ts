import { Platform, Alert, Linking } from 'react-native';

// Check if we're in Expo Go (which doesn't support expo-notifications on Android SDK 53+)
const isExpoGo = __DEV__ && !process.env.EXPO_DEV_BUILD;

// Lazy-load expo-notifications only when needed and not in Expo Go
let Notifications: any = null;
async function getNotificationsModule() {
  if (isExpoGo && Platform.OS === 'android') {
    return null;
  }
  if (!Notifications) {
    const module = await import('expo-notifications');
    Notifications = module.default || module;
  }
  return Notifications;
}

// Configure notification behavior
async function configureNotifications() {
  const mod = await getNotificationsModule();
  if (mod) {
    mod.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  }
}

// Initialize configuration
configureNotifications();

/**
 * Requests notification permissions from the system.
 * Returns true if granted, false otherwise.
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  const mod = await getNotificationsModule();
  
  if (!mod) {
    Alert.alert(
      'Notifications Unavailable',
      'Local notifications require a development build. They are not available in Expo Go on Android. Please create a development build to test this feature.',
      [{ text: 'OK' }]
    );
    return false;
  }

  const { status: existingStatus } = await mod.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (finalStatus !== 'granted') {
    const { status } = await mod.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    Alert.alert(
      'Notifications Disabled',
      'To receive episode reminders, please enable notifications in your device settings.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: () => Linking.openSettings() },
      ]
    );
    return false;
  }

  return true;
}

/**
 * Schedules a local notification for an episode.
 */
export async function scheduleLocalReminder(
  episodeName: string,
  showName: string,
  airDate: Date
) {
  const mod = await getNotificationsModule();
  if (!mod) return;

  // Only schedule if air date is in the future
  if (airDate <= new Date()) return;

  await mod.scheduleNotificationAsync({
    content: {
      title: 'New Episode Airing!',
      body: `${showName}: ${episodeName} is airing now.`,
      data: { showName, episodeName },
    },
    trigger: airDate,
  });
}

/**
 * Cancels all scheduled local notifications.
 */
export async function cancelAllReminders() {
  const mod = await getNotificationsModule();
  if (!mod) return;

  await mod.cancelAllScheduledNotificationsAsync();
}

export async function getPermissionStatus() {
  const mod = await getNotificationsModule();
  if (!mod) return { status: 'undetermined' as const };
  
  return await mod.getPermissionsAsync();
}
