// ─── SegmentedToggle — Shows/Movies tab switch ───

import { memo, useCallback } from 'react'
import { View, Text, Pressable } from 'react-native'
import { useTheme } from '@/contexts/ThemeContext'

type TabKind = 'shows' | 'movies'

interface SegmentedToggleProps {
  value: TabKind
  onChange: (value: TabKind) => void
}

const SegmentedToggle = memo(function SegmentedToggle({ value, onChange }: SegmentedToggleProps) {
  const { colors } = useTheme()
  const { primary, onPrimary, surfaceContainerHighest, onSurface, secondary } = colors

  const handleShows = useCallback(() => onChange('shows'), [onChange])
  const handleMovies = useCallback(() => onChange('movies'), [onChange])

  const segmentW = '50%'

  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: surfaceContainerHighest,
        borderRadius: 10,
        padding: 3,
      }}
    >
      <Pressable
        onPress={handleShows}
        style={{
          width: segmentW,
          paddingVertical: 8,
          borderRadius: 8,
          backgroundColor: value === 'shows' ? primary : 'transparent',
          alignItems: 'center',
        }}
      >
        <Text
          style={{
            fontFamily: 'Inter',
            fontSize: 14,
            fontWeight: '600',
            color: value === 'shows' ? onPrimary : secondary,
          }}
        >
          Shows
        </Text>
      </Pressable>
      <Pressable
        onPress={handleMovies}
        style={{
          width: segmentW,
          paddingVertical: 8,
          borderRadius: 8,
          backgroundColor: value === 'movies' ? primary : 'transparent',
          alignItems: 'center',
        }}
      >
        <Text
          style={{
            fontFamily: 'Inter',
            fontSize: 14,
            fontWeight: '600',
            color: value === 'movies' ? onPrimary : secondary,
          }}
        >
          Movies
        </Text>
      </Pressable>
    </View>
  )
})

export default SegmentedToggle
export type { TabKind }
