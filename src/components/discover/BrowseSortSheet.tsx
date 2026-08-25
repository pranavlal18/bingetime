// ─── BrowseSortSheet — Spotify-style bottom sheet for browse-page sorting ───
// Shared by genre / network / company pages; options passed in by caller.

import { useEffect, useMemo } from 'react'
import { View, Text, Pressable, StyleSheet, Modal } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated'
import { useTheme } from '@/contexts/ThemeContext'
import { spacing, borderRadius } from '@/theme'
import type { GenreSortBy } from '@/lib/tmdb'
import type { BrowseSortOption } from '@/lib/queries/discover'

interface BrowseSortSheetProps {
  visible: boolean
  onClose: () => void
  value: GenreSortBy
  onChange: (v: GenreSortBy) => void
  options: BrowseSortOption[]
}

export default function BrowseSortSheet({ visible, onClose, value, onChange, options }: BrowseSortSheetProps) {
  const { colors } = useTheme()
  const translateY = useSharedValue(0)
  const contextY = useSharedValue(0)

  useEffect(() => {
    if (visible) translateY.value = 0
  }, [visible, translateY])

  const pan = Gesture.Pan()
    .onStart(() => {
      contextY.value = translateY.value
    })
    .onUpdate((e) => {
      const next = e.translationY + contextY.value
      translateY.value = next > 0 ? next : 0
    })
    .onEnd((e) => {
      const shouldClose = translateY.value > 80 || e.velocityY > 600
      if (shouldClose) {
        runOnJS(onClose)()
      } else {
        translateY.value = withSpring(0, { damping: 20, stiffness: 300 })
      }
    })

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }))

  const styles = useMemo(
    () =>
      StyleSheet.create({
        overlay: {
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'flex-end',
        },
        sheet: {
          backgroundColor: colors.surfaceContainerHigh,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          paddingTop: 12,
          paddingBottom: 24,
          paddingHorizontal: spacing.marginMobile,
        },
        handle: {
          width: 36,
          height: 4,
          borderRadius: 2,
          backgroundColor: colors.outlineVariant,
          alignSelf: 'center',
          marginBottom: 16,
        },
        title: {
          fontFamily: 'Inter',
          fontSize: 16,
          fontWeight: '700',
          color: colors.onSurface,
          marginBottom: 12,
        },
        option: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: 14,
          paddingHorizontal: 12,
          borderRadius: borderRadius.md,
        },
        optionActive: {
          backgroundColor: colors.surfaceContainerHighest,
        },
        optionLabel: {
          fontFamily: 'Inter',
          fontSize: 15,
          fontWeight: '500',
          color: colors.onSurface,
        },
        optionLabelActive: {
          color: colors.primary,
          fontWeight: '700',
        },
      }),
    [colors]
  )

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <GestureDetector gesture={pan}>
          <Animated.View style={[styles.sheet, sheetAnimatedStyle]}>
            <Pressable onPress={(e) => e.stopPropagation()}>
              <View style={styles.handle} />
              <Text style={styles.title}>Sort by</Text>
              {options.map((opt) => {
                const active = opt.value === value
                return (
                  <Pressable
                    key={opt.value}
                    style={[styles.option, active && styles.optionActive]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                      onChange(opt.value)
                      onClose()
                    }}
                  >
                    <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>{opt.label}</Text>
                    {active && <Ionicons name="checkmark" size={20} color={colors.primary} />}
                  </Pressable>
                )
              })}
            </Pressable>
          </Animated.View>
        </GestureDetector>
      </Pressable>
    </Modal>
  )
}
