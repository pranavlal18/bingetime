import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { Platform } from 'react-native'
import { mmkvAsyncStorage, mmkvLocalSync } from '@/lib/mmkv'

const MAX_RECENTS = 8

interface SearchState {
  recents: string[]
  addRecent: (query: string) => void
  removeRecent: (query: string) => void
  clearAll: () => void
}

export const useSearchStore = create<SearchState>()(
  persist(
    (set) => ({
      recents: [],
      addRecent: (query) =>
        set((state) => {
          const q = query.trim()
          if (q.length < 2) return state
          // dedupe case-insensitive, newest first
          const filtered = state.recents.filter((r) => r.toLowerCase() !== q.toLowerCase())
          const next = [q, ...filtered].slice(0, MAX_RECENTS)
          return { recents: next }
        }),
      removeRecent: (query) =>
        set((state) => ({
          recents: state.recents.filter((r) => r.toLowerCase() !== query.toLowerCase()),
        })),
      clearAll: () => set({ recents: [] }),
    }),
    {
      name: 'bingetime-recent-searches',
      version: 1,
      // Sync MMKV on native (no async hydration flicker); async adapter on web
      storage: createJSONStorage(() =>
        Platform.OS === 'web' ? mmkvAsyncStorage : mmkvLocalSync
      ),
      migrate: (persisted, version) => persisted as SearchState,
    }
  )
)
