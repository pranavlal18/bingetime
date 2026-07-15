// ─── UpcomingList — compact next-up list with date labels ───

import { memo } from 'react'
import { View, Text } from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/contexts/ThemeContext'
import { getImageUrl } from '@/lib/tmdb'

export interface UpcomingItem {
  key: string
  title: string
  subtitle: string // e.g. "S03E12 · The One with ..."
  dateLabel: string // e.g. "Thu, Jul 18"
  posterPath: string | null
}

interface UpcomingListProps {
  items: UpcomingItem[]
  limit?: number
}

const UpcomingList = memo(function UpcomingList({ items, limit = 5 }: UpcomingListProps) {
  const { colors } = useTheme()
  const visible = items.slice(0, limit)

  if (visible.length === 0) return null

  return (
    <View style={{ marginBottom: 12 }}>
      {visible.map((item, i) => (
        <View
          key={item.key}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            paddingVertical: 8,
            borderBottomWidth: i < visible.length - 1 ? 1 : 0,
            borderBottomColor: 'rgba(255,255,255,0.05)',
          }}
        >
          {/* Poster thumbnail */}
          {(() => {
            const imgUrl = getImageUrl(item.posterPath, 'w92')
            const thumbStyle = { width: 28, height: 42, borderRadius: 4, backgroundColor: colors.surfaceContainerHighest }
            return imgUrl ? (
              <Image source={{ uri: imgUrl }} style={thumbStyle} />
            ) : (
              <View style={[thumbStyle, { justifyContent: 'center', alignItems: 'center' }]}>
                <Ionicons name="film-outline" size={14} color={colors.outlineVariant} />
              </View>
            )
          })()}

          {/* Info */}
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontFamily: 'Inter',
                fontSize: 13,
                fontWeight: '600',
                color: colors.onSurface,
              }}
              numberOfLines={1}
            >
              {item.title}
            </Text>
            <Text
              style={{
                fontFamily: 'Inter',
                fontSize: 11,
                color: colors.secondary,
                marginTop: 1,
              }}
              numberOfLines={1}
            >
              {item.subtitle}
            </Text>
          </View>

          {/* Date */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="calendar-outline" size={11} color={colors.secondary} />
            <Text
              style={{
                fontFamily: 'Inter',
                fontSize: 11,
                fontWeight: '500',
                color: colors.secondary,
              }}
            >
              {item.dateLabel}
            </Text>
          </View>
        </View>
      ))}
    </View>
  )
})

export default UpcomingList
