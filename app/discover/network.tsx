// ─── Network Page — all shows on a single TMDb network/streaming platform ───
// Reached from tappable network pills on show detail pages and upcoming
// episode cards. UI lives in the shared CollectionBrowser.

import { useLocalSearchParams } from 'expo-router'
import CollectionBrowser from '@/components/browse/CollectionBrowser'

export default function NetworkPage() {
  const { id, name, logo } = useLocalSearchParams<{
    id: string
    name?: string
    logo?: string
  }>()

  const networkId = /^\d+$/.test(String(id)) ? parseInt(String(id), 10) : null
  const networkName = name ? String(name) : 'Network'

  return (
    <CollectionBrowser
      kind="network"
      id={networkId}
      name={networkName}
      mediaType="tv"
      logoPath={logo ? String(logo) : null}
      invalidMessage="Could not load network"
      emptyMessage={`No titles found for ${networkName}`}
    />
  )
}
