import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { Platform } from 'react-native'
import { mmkvAsyncStorage, mmkvLocalSync } from '@/lib/mmkv'
import type { AppSettings, ViewMode, ThemeKey } from '@/types'

interface AppState extends AppSettings {
  setShowsViewMode: (mode: ViewMode) => void
  setMoviesViewMode: (mode: ViewMode) => void
  setTheme: (theme: ThemeKey) => void
  notificationsEnabled: boolean
  setNotificationsEnabled: (enabled: boolean) => void
  hapticsEnabled: boolean
  setHapticsEnabled: (enabled: boolean) => void
  displayName: string | null
  setDisplayName: (name: string | null) => void
  statsPeriod: 'week' | 'month'
  setStatsPeriod: (period: 'week' | 'month') => void
  hasRunReleaseDateSync: boolean
  setHasRunReleaseDateSync: (done: boolean) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Defaults
      showsViewMode: 'poster-grid',
      moviesViewMode: 'poster-grid',
      theme: 'cinematic-dark',
      notificationsEnabled: false,
      hapticsEnabled: true,
      displayName: null,
      statsPeriod: 'week',
      hasRunReleaseDateSync: false,

      setShowsViewMode: (mode) => set({ showsViewMode: mode }),
      setMoviesViewMode: (mode) => set({ moviesViewMode: mode }),
      setTheme: (theme) => set({ theme }),
      setNotificationsEnabled: (enabled) => set({ notificationsEnabled: enabled }),
      setHapticsEnabled: (enabled) => set({ hapticsEnabled: enabled }),
      setDisplayName: (name) => set({ displayName: name }),
      setStatsPeriod: (period) => set({ statsPeriod: period }),
      setHasRunReleaseDateSync: (done) => set({ hasRunReleaseDateSync: done }),
    }),
    {
      name: 'bingetime-settings',
      version: 1,
      // Sync MMKV on native (no async hydration flicker); async adapter on web
      storage: createJSONStorage(() =>
        Platform.OS === 'web' ? mmkvAsyncStorage : mmkvLocalSync
      ),
      migrate: (persisted, version) => persisted as AppState,
    }
  )
)
