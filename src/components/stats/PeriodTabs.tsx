// ─── PeriodTabs — inline Per week / Per month toggle ───

import { memo, useCallback } from 'react'
import { View, Text, Pressable } from 'react-native'
import { useTheme } from '@/contexts/ThemeContext'
import { useAppStore } from '@/stores/appStore'

type Period = 'week' | 'month'

const PeriodTabs = memo(function PeriodTabs() {
  const { colors } = useTheme()
  const period = useAppStore((s) => s.statsPeriod)
  const setPeriod = useAppStore((s) => s.setStatsPeriod)
  const { primary, onPrimary, surfaceContainerHighest, secondary } = colors

  const handleWeek = useCallback(() => setPeriod('week'), [setPeriod])
  const handleMonth = useCallback(() => setPeriod('month'), [setPeriod])

  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: surfaceContainerHighest,
        borderRadius: 7,
        padding: 2,
      }}
    >
      <Pressable
        onPress={handleWeek}
        style={{
          paddingVertical: 4,
          paddingHorizontal: 10,
          borderRadius: 5,
          backgroundColor: period === 'week' ? primary : 'transparent',
        }}
      >
        <Text
          style={{
            fontFamily: 'Inter',
            fontSize: 11,
            fontWeight: '600',
            color: period === 'week' ? onPrimary : secondary,
          }}
        >
          Per week
        </Text>
      </Pressable>
      <Pressable
        onPress={handleMonth}
        style={{
          paddingVertical: 4,
          paddingHorizontal: 10,
          borderRadius: 5,
          backgroundColor: period === 'month' ? primary : 'transparent',
        }}
      >
        <Text
          style={{
            fontFamily: 'Inter',
            fontSize: 11,
            fontWeight: '600',
            color: period === 'month' ? onPrimary : secondary,
          }}
        >
          Per month
        </Text>
      </Pressable>
    </View>
  )
})

export default PeriodTabs
export type { Period }
