// ─── RankedListItem — horizontal bar row (genre/network ranking) ───

import { memo } from 'react'
import { View, Text } from 'react-native'
import { useTheme } from '@/contexts/ThemeContext'

interface RankedListItemProps {
  label: string
  value: number
  maxValue: number
  barColor?: string
  suffix?: string
  rank?: number
}

const RankedListItem = memo(function RankedListItem({
  label,
  value,
  maxValue,
  barColor,
  suffix = '',
  rank,
}: RankedListItemProps) {
  const { colors } = useTheme()
  const pct = maxValue > 0 ? (value / maxValue) * 100 : 0
  const fillColor = barColor ?? colors.tertiary

  return (
    <View style={{ marginBottom: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {/* Optional rank number */}
        {rank !== undefined && (
          <Text
            style={{
              fontFamily: 'Inter',
              fontSize: 11,
              fontWeight: '700',
              color: colors.secondary,
              width: 16,
              textAlign: 'center',
            }}
          >
            {rank}
          </Text>
        )}

        {/* Label */}
        <Text
          style={{
            fontFamily: 'Inter',
            fontSize: 13,
            fontWeight: '500',
            color: colors.onSurface,
            flex: 1,
          }}
          numberOfLines={1}
        >
          {label}
        </Text>

        {/* Value */}
        <Text
          style={{
            fontFamily: 'Inter',
            fontSize: 12,
            fontWeight: '600',
            color: colors.primary,
            marginLeft: 8,
          }}
        >
          {typeof value === 'number' ? `${Math.round(value)}${suffix}` : value}
        </Text>
      </View>

      {/* Bar */}
      <View
        style={{
          height: 6,
          borderRadius: 3,
          backgroundColor: colors.surfaceContainerHighest,
          overflow: 'hidden',
          marginTop: 4,
        }}
      >
        <View
          style={{
            width: `${pct}%`,
            height: '100%',
            borderRadius: 3,
            backgroundColor: fillColor,
          }}
        />
      </View>
    </View>
  )
})

export default RankedListItem
