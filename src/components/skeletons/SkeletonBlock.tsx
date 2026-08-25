// ─── SkeletonBlock — pulsing rectangle placeholder ───

import { useEffect, useMemo } from 'react'
import { View, StyleSheet, type ViewStyle, type DimensionValue } from 'react-native'
import Animated, {
  useSharedValue,
  withRepeat,
  withTiming,
  useAnimatedStyle,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated'
import { useTheme } from '@/contexts/ThemeContext'
import { borderRadius as bRadius } from '@/theme'

interface SkeletonBlockProps {
  width: DimensionValue
  height: number
  borderRadius?: number
  style?: ViewStyle
}

export default function SkeletonBlock({
  width,
  height,
  borderRadius = bRadius.md,
  style,
}: SkeletonBlockProps) {
  const { colors } = useTheme()
  const opacity = useSharedValue(1)

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.3, { duration: 1000, easing: Easing.ease }),
      -1,
      true
    )
    // Stop the UI-thread repeat on unmount — otherwise it runs forever
    return () => cancelAnimation(opacity)
  }, [opacity])

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }))

  const styles = useMemo(
    () =>
      StyleSheet.create({
        block: {
          width,
          height,
          borderRadius,
          backgroundColor: colors.surfaceContainerHighest,
        },
      }),
    [width, height, borderRadius, colors.surfaceContainerHighest]
  )

  return <Animated.View style={[styles.block, animatedStyle, style]} />
}
