// ─── DetailTabs — segmented control pinned below the detail-page hero ───

import { Pressable, Text, View, StyleSheet } from 'react-native'
import * as Haptics from 'expo-haptics'
import { typography, spacing, borderRadius } from '@/theme'
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

  const styles = StyleSheet.create({
    track: {
      flexDirection: 'row',
      backgroundColor: colors.surfaceContainerHighest,
      borderRadius: borderRadius.full,
      padding: 3,
      marginHorizontal: spacing.marginMobile,
      marginVertical: spacing.stackSm,
    },
    segment: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: borderRadius.full,
      alignItems: 'center',
    },
    segmentActive: {
      backgroundColor: colors.primary,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 3,
    },
    segmentText: {
      fontFamily: 'Inter',
      fontSize: typography.labelMd.fontSize,
      fontWeight: '600',
      lineHeight: typography.labelMd.lineHeight,
      letterSpacing: typography.labelMd.letterSpacing,
      color: colors.onSurfaceVariant,
    },
    segmentTextActive: {
      color: colors.onPrimary,
    },
  })

  return (
    <View style={styles.track}>
      {tabs.map((tab) => {
        const isActive = tab.key === active
        return (
          <Pressable
            key={tab.key}
            style={[styles.segment, isActive && styles.segmentActive]}
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
          </Pressable>
        )
      })}
    </View>
  )
}
