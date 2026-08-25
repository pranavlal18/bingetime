// ─── Company Page — all titles from a single TMDb production company ───
// Reached from tappable studio pills on movie detail pages. UI lives in the
// shared CollectionBrowser.

import { useLocalSearchParams } from 'expo-router'
import CollectionBrowser from '@/components/browse/CollectionBrowser'

export default function CompanyPage() {
  const { id, name, logo, type } = useLocalSearchParams<{
    id: string
    name?: string
    logo?: string
    type?: string
  }>()

  const companyId = /^\d+$/.test(String(id)) ? parseInt(String(id), 10) : null
  const companyName = name ? String(name) : 'Studio'
  const mediaType: 'tv' | 'movie' = type === 'tv' ? 'tv' : 'movie'

  return (
    <CollectionBrowser
      kind="company"
      id={companyId}
      name={companyName}
      mediaType={mediaType}
      logoPath={logo ? String(logo) : null}
      invalidMessage="Could not load studio"
      emptyMessage={`No titles found for ${companyName}`}
    />
  )
}
