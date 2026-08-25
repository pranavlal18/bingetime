// ─── DetailTabs — minimal text tabs pinned below the detail-page hero ───
// Underline is a single element that slides between tabs (reanimated).

import { useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, Text, View, StyleSheet } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated'
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

const UNDERLINE_WIDTH = 36

export default function DetailTabs({ tabs, active, onChange }: DetailTabsProps) {
  const { colors } = useTheme()
  // Measured x-offset of each tab's underline center position
  const [positions, setPositions] = useState<Record<string, number>>({})
  const tx = useSharedValue(0)
  const didInit = useRef(false)

  useEffect(() => {
    const target = positions[active]
    if (target == null) return
    if (!didInit.current) {
      // Jump to the active tab on mount — no entrance animation
      tx.value = target
      didInit.current = true
    } else {
      tx.value = withTiming(target, { duration: 200 })
    }
  }, [active, positions, tx])

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
      position: 'absolute',
      bottom: 8,
      left: 0,
      width: UNDERLINE_WIDTH,
      height: 2,
      borderRadius: 1,
      backgroundColor: colors.primary,
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

  const underlineStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }],
  }))

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
            onLayout={(e) => {
              // Center the shared underline beneath this segment
              const { x, width } = e.nativeEvent.layout
              const target = x + (width - UNDERLINE_WIDTH) / 2
              setPositions((prev) => (prev[tab.key] === target ? prev : { ...prev, [tab.key]: target }))
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
      <Animated.View style={[styles.underline, underlineStyle]} pointerEvents="none" />
    </View>
  )
}
