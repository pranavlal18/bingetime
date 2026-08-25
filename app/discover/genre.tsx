// ─── Genre Page — all titles in a single TMDb genre ───
// Reached from tappable genre chips on show/movie detail pages.
// UI lives in the shared CollectionBrowser (also backs network/company pages).

import { useLocalSearchParams } from 'expo-router'
import CollectionBrowser from '@/components/browse/CollectionBrowser'

export default function GenrePage() {
  const { id, name, type } = useLocalSearchParams<{
    id: string
    name?: string
    type?: string
  }>()

  const genreId = /^\d+$/.test(String(id)) ? parseInt(String(id), 10) : null
  const mediaType: 'tv' | 'movie' = type === 'movie' ? 'movie' : 'tv'
  const genreName = name ? String(name) : mediaType === 'tv' ? 'TV Shows' : 'Movies'

  return (
    <CollectionBrowser
      kind="genre"
      id={genreId}
      name={genreName}
      mediaType={mediaType}
      invalidMessage="Could not load genre"
      emptyMessage="No titles found in this genre"
    />
  )
}
