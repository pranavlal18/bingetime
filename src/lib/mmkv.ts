import { Platform } from 'react-native'
import { MMKV } from 'react-native-mmkv'
import AsyncStorage from '@react-native-async-storage/async-storage'

let _mmkv: MMKV | null = null
try {
  if (Platform.OS !== 'web') {
    _mmkv = new MMKV({ id: 'bingetime-cache' })
  }
} catch {
  _mmkv = null
}

export const mmkv = _mmkv as unknown as MMKV
const mmkvInstance = _mmkv

export const mmkvStorage = {
  setItem: (key: string, value: string) => {
    if (mmkvInstance) mmkvInstance.set(key, value)
    else void AsyncStorage.setItem(key, value)
  },
  getItem: (key: string) => {
    if (mmkvInstance) {
      const v = mmkvInstance.getString(key)
      return v ?? null
    }
    // Web fallback — AsyncStorage is async, but persister expects sync; return null to force fetch
    return null
  },
  removeItem: (key: string) => {
    if (mmkvInstance) mmkvInstance.delete(key)
    else void AsyncStorage.removeItem(key)
  },
}

// Async version for explicit calls (web compatible). On native, a MMKV miss
// transparently falls back to AsyncStorage and copies the value into MMKV —
// a zero-config one-time migration for settings, query cache, and Supabase
// session keys written by older app versions.
export const mmkvAsyncStorage = {
  setItem: async (key: string, value: string) => {
    if (mmkvInstance) mmkvInstance.set(key, value)
    else await AsyncStorage.setItem(key, value)
  },
  getItem: async (key: string) => {
    if (mmkvInstance) {
      const v = mmkvInstance.getString(key)
      if (v != null) return v
      // Lazy migration from legacy AsyncStorage
      try {
        const legacy = await AsyncStorage.getItem(key)
        if (legacy != null) {
          mmkvInstance.set(key, legacy)
          return legacy
        }
      } catch {}
      return null
    }
    return AsyncStorage.getItem(key)
  },
  removeItem: async (key: string) => {
    if (mmkvInstance) mmkvInstance.delete(key)
    else await AsyncStorage.removeItem(key)
  },
}
