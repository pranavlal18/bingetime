import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { mmkvAsyncStorage } from '@/lib/mmkv'
import type { AppSettings, ViewMode, ThemeKey } from '@/types'

interface AppState extends AppSettings {
  setShowsViewMode: (mode: ViewMode) => void
  setMoviesViewMode: (mode: ViewMode) => void
  setTheme: (theme: ThemeKey) => void
  notificationsEnabled: boolean
  setNotificationsEnabled: (enabled: boolean) => void
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
      statsPeriod: 'week',
      hasRunReleaseDateSync: false,

      setShowsViewMode: (mode) => set({ showsViewMode: mode }),
      setMoviesViewMode: (mode) => set({ moviesViewMode: mode }),
      setTheme: (theme) => set({ theme }),
      setNotificationsEnabled: (enabled) => set({ notificationsEnabled: enabled }),
      setStatsPeriod: (period) => set({ statsPeriod: period }),
      setHasRunReleaseDateSync: (done) => set({ hasRunReleaseDateSync: done }),
    }),
    {
      name: 'bingetime-settings',
      // MMKV-backed (sync reads, ~30x faster than AsyncStorage). The async
      // adapter also lazy-migrates legacy AsyncStorage values on first read.
      storage: createJSONStorage(() => mmkvAsyncStorage),
    }
  )
)
