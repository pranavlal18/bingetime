// ─── Haptics wrapper — global kill-switch for all app feedback vibrations ───
// Every haptic in the app goes through here so the Settings toggle can silence
// them all. Uses getState() (not hooks) so call sites stay fire-and-forget,
// including outside React (query handlers, utils).

import * as Haptics from 'expo-haptics'
import { useAppStore } from '@/stores/appStore'

/** Light impact — taps on cards, chips, pills, toggles, sheet options */
export function hapticLight() {
  if (!useAppStore.getState().hapticsEnabled) return
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
}

/** Medium impact — heavier interactions that should feel weightier */
export function hapticMedium() {
  if (!useAppStore.getState().hapticsEnabled) return
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
}

/** Success notification — completed actions like marking content watched */
export function hapticSuccess() {
  if (!useAppStore.getState().hapticsEnabled) return
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
}
