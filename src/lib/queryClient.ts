import { QueryClient } from '@tanstack/react-query'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { mmkvAsyncStorage } from './mmkv'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 60 * 24,
      retry: 2,
      networkMode: 'offlineFirst',
    },
  },
})

// MMKV persister — sync reads, ~30MB limit, fast. The async adapter lazily
// migrates legacy AsyncStorage cache on first read.
export const mmkvPersister = createAsyncStoragePersister({
  storage: mmkvAsyncStorage,
  throttleTime: 1000,
})