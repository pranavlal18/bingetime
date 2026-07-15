// ─── BigValue — hero triple-stat "2 movies · 13 days · 11h" ───

import { memo } from 'react'
import { View, Text } from 'react-native'
import { useTheme } from '@/contexts/ThemeContext'
import { useAppStore } from '@/stores/appStore'

interface BigValueProps {
  /** The primary big number (episodes/movies count) */
  primaryCount: number
  /** Unit label for the primary count */
  primaryUnit: string
  /** Days = total hours / 24 */
  days: number
  /** Remaining hours after extracting days */
  hours: number
  /** "5 hours in the last 7 days" style subline */
  recentSubline?: string
}

function formatNumber(n: number): string {
  return n.toLocaleString('en-US')
}

const BigValue = memo(function BigValue({
  primaryCount,
  primaryUnit,
  days,
  hours,
  recentSubline,
}: BigValueProps) {
  const { colors } = useTheme()

  // Only show days/hours if they are meaningful
  const parts: string[] = []
  parts.push(`${formatNumber(primaryCount)} ${primaryUnit}`)
  if (days > 0) parts.push(`${formatNumber(days)} days`)
  if (hours > 0) parts.push(`${formatNumber(hours)}h`)

  return (
    <View style={{ alignItems: 'flex-start', marginBottom: 12 }}>
      <Text
        style={{
          fontFamily: 'Inter',
          fontSize: 28,
          fontWeight: '700',
          color: colors.onSurface,
          lineHeight: 34,
        }}
      >
        {parts.join(' · ')}
      </Text>
      {recentSubline && (
        <Text
          style={{
            fontFamily: 'Inter',
            fontSize: 12,
            fontWeight: '500',
            color: colors.secondary,
            marginTop: 4,
            letterSpacing: 0.4,
            textTransform: 'uppercase',
          }}
        >
          {recentSubline}
        </Text>
      )}
    </View>
  )
})

export default BigValue
