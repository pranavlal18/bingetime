// ─── MarathonRow — poster + show name + episode range + count ───

import { View, Text } from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/contexts/ThemeContext'
import { getImageUrl } from '@/lib/tmdb'

export interface MarathonData {
  showId: string
  name: string
  posterPath: string | null
  episodeCount: number
  totalSeconds: number
  startLabel: string // e.g. "S03E12"
  endLabel: string   // e.g. "S03E18"
}

interface MarathonRowProps {
  marathon: MarathonData
}

function formatNumber(n: number): string {
  return n.toLocaleString('en-US')
}

const POSTER_W = 32
const POSTER_H = 48

export default function MarathonRow({ marathon }: MarathonRowProps) {
  const { colors } = useTheme()
  const hours = Math.round(marathon.totalSeconds / 3600)
  const posterUrl = getImageUrl(marathon.posterPath, 'w92')

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
      {/* Poster */}
      {posterUrl ? (
        <Image
          source={{ uri: posterUrl }}
          style={{ width: POSTER_W, height: POSTER_H, borderRadius: 4, backgroundColor: colors.surfaceContainerHighest }}
        />
      ) : (
        <View
          style={{
            width: POSTER_W,
            height: POSTER_H,
            borderRadius: 4,
            backgroundColor: colors.surfaceContainerHighest,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Ionicons name="film-outline" size={16} color={colors.outlineVariant} />
        </View>
      )}

      {/* Info */}
      <View style={{ flex: 1 }}>
        <Text
          style={{ fontFamily: 'Inter', fontSize: 13, fontWeight: '600', color: colors.onSurface }}
          numberOfLines={1}
        >
          {marathon.name}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
          <Ionicons name="play-circle-outline" size={12} color={colors.secondary} />
          <Text style={{ fontFamily: 'Inter', fontSize: 11, color: colors.secondary }}>
            {marathon.startLabel}{'\u2192'}{marathon.endLabel}
          </Text>
        </View>
      </View>

      {/* Stats */}
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={{ fontFamily: 'Inter', fontSize: 13, fontWeight: '600', color: colors.tertiary }}>
          {formatNumber(marathon.episodeCount)} ep
        </Text>
        <Text style={{ fontFamily: 'Inter', fontSize: 11, color: colors.secondary, marginTop: 1 }}>
          {formatNumber(hours)}h
        </Text>
      </View>
    </View>
  )
}
