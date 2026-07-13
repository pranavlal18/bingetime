import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { AppSettings, ViewMode, Theme } from '@/types'

interface AppState extends AppSettings {
  setShowsViewMode: (mode: ViewMode) => void
  setMoviesViewMode: (mode: ViewMode) => void
  setTheme: (theme: Theme) => void
  toggleShowArchived: () => void
  isImportComplete: boolean
  setImportComplete: (done: boolean) => void
  importStarted: boolean
  setImportStarted: (started: boolean) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Defaults
      showsViewMode: 'poster-grid',
      moviesViewMode: 'poster-grid',
      theme: 'system',
      showArchived: false,
      isImportComplete: false,
      importStarted: false,

      setShowsViewMode: (mode) => set({ showsViewMode: mode }),
      setMoviesViewMode: (mode) => set({ moviesViewMode: mode }),
      setTheme: (theme) => set({ theme }),
      toggleShowArchived: () => set((s) => ({ showArchived: !s.showArchived })),
      setImportComplete: (done) => set({ isImportComplete: done }),
      setImportStarted: (started) => set({ importStarted: started }),
    }),
    {
      name: 'bingetime-settings',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
)
