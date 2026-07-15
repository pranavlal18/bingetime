// ─── SkeletonEpisodeCard — pulsing placeholder for loading upcoming episodes ───

import { useEffect, useMemo } from 'react'
import { View, StyleSheet } from 'react-native'
import Animated, {
  useSharedValue,
  withRepeat,
  withTiming,
  useAnimatedStyle,
  Easing,
} from 'react-native-reanimated'
import { spacing, borderRadius } from '@/theme'
import { useTheme } from '@/contexts/ThemeContext'

export default function SkeletonEpisodeCard() {
  const { colors } = useTheme()
  const opacity = useSharedValue(1)

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.3, { duration: 1000, easing: Easing.ease }),
      -1,
      true
    )
  }, [opacity])

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }))

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.stackSm + 2,
      paddingHorizontal: spacing.marginMobile,
      backgroundColor: colors.surface,
    },
    poster: {
      width: 56,
      height: 84,
      borderRadius: borderRadius.md,
      backgroundColor: colors.surfaceContainerHighest,
    },
    infoBlock: {
      flex: 1,
      marginLeft: spacing.gutter,
      justifyContent: 'center',
      gap: 2,
    },
    pill: {
      width: '40%',
      height: 18,
      borderRadius: borderRadius.full,
      backgroundColor: colors.surfaceContainerHighest,
      marginBottom: 4,
    },
    episodeLine: {
      width: '55%',
      height: 16,
      borderRadius: borderRadius.sm,
      backgroundColor: colors.surfaceContainerHighest,
      marginTop: 4,
    },
    titleLine: {
      width: '75%',
      height: 14,
      borderRadius: borderRadius.sm,
      backgroundColor: colors.surfaceContainerHighest,
      marginTop: 6,
    },
    rightPlaceholder: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.surfaceContainerHighest,
      marginLeft: spacing.stackSm,
    },
  }), [colors])

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      {/* Poster skeleton */}
      <View style={styles.poster} />

      {/* Info block skeleton */}
      <View style={styles.infoBlock}>
        <View style={styles.pill} />
        <View style={styles.episodeLine} />
        <View style={styles.titleLine} />
      </View>

      {/* Right circle skeleton */}
      <View style={styles.rightPlaceholder} />
    </Animated.View>
  )
}
