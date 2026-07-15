import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { AppSettings, ViewMode, ThemeKey } from '@/types'

interface AppState extends AppSettings {
  setShowsViewMode: (mode: ViewMode) => void
  setMoviesViewMode: (mode: ViewMode) => void
  setTheme: (theme: ThemeKey) => void
  notificationsEnabled: boolean
  setNotificationsEnabled: (enabled: boolean) => void
  isImportComplete: boolean
  setImportComplete: (done: boolean) => void
  statsPeriod: 'week' | 'month'
  setStatsPeriod: (period: 'week' | 'month') => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Defaults
      showsViewMode: 'poster-grid',
      moviesViewMode: 'poster-grid',
      theme: 'cinematic-dark',
      notificationsEnabled: false,
      isImportComplete: false,
      statsPeriod: 'week',

      setShowsViewMode: (mode) => set({ showsViewMode: mode }),
      setMoviesViewMode: (mode) => set({ moviesViewMode: mode }),
      setTheme: (theme) => set({ theme }),
      setNotificationsEnabled: (enabled) => set({ notificationsEnabled: enabled }),
      setImportComplete: (done) => set({ isImportComplete: done }),
      setStatsPeriod: (period) => set({ statsPeriod: period }),
    }),
    {
      name: 'bingetime-settings',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
)
