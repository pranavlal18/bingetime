import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { AppSettings, ViewMode, Theme } from '@/types'

interface AppState extends AppSettings {
  setViewMode: (mode: ViewMode) => void
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
      viewMode: 'poster-grid',
      theme: 'system',
      showArchived: false,
      isImportComplete: false,
      importStarted: false,

      setViewMode: (mode) => set({ viewMode: mode }),
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
