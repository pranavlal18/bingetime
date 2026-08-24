// ─── DetailTabs — minimal text tabs pinned below the detail-page hero ───

import { useMemo } from 'react'
import { Pressable, Text, View, StyleSheet } from 'react-native'
import * as Haptics from 'expo-haptics'
import { spacing } from '@/theme'
import { useTheme } from '@/contexts/ThemeContext'

export type DetailTabKey = 'details' | 'episodes'

export interface DetailTab {
  key: DetailTabKey
  label: string
}

interface DetailTabsProps {
  tabs: DetailTab[]
  active: DetailTabKey
  onChange: (key: DetailTabKey) => void
}

export default function DetailTabs({ tabs, active, onChange }: DetailTabsProps) {
  const { colors } = useTheme()

  const styles = useMemo(
    () =>
      StyleSheet.create({
      track: {
      flexDirection: 'row',
      gap: 26,
      marginHorizontal: spacing.marginMobile,
      marginVertical: spacing.stackSm,
    },
    segment: {
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 2,
    },
    underline: {
      width: 36,
      height: 2,
      borderRadius: 1,
      backgroundColor: colors.primary,
      marginTop: 8,
    },
    segmentText: {
      fontFamily: 'Inter',
      fontSize: 16,
      fontWeight: '600',
      lineHeight: 24,
      color: colors.onSurfaceVariant,
    },
    segmentTextActive: {
      color: colors.primary,
    },
    }),
    [colors],
  )

  return (
    <View style={styles.track}>
      {tabs.map((tab) => {
        const isActive = tab.key === active
        return (
          <Pressable
            key={tab.key}
            style={styles.segment}
            onPress={() => {
              if (!isActive) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                onChange(tab.key)
              }
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
          >
            <Text style={[styles.segmentText, isActive && styles.segmentTextActive]}>
              {tab.label}
            </Text>
            {isActive && <View style={styles.underline} />}
          </Pressable>
        )
      })}
    </View>
  )
}
