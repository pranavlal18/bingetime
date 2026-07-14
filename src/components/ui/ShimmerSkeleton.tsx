// ─── ShimmerSkeleton — loading placeholder with animated gradient ───

import { useEffect, useMemo } from 'react'
import { View, StyleSheet } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolate,
} from 'react-native-reanimated'
import { LinearGradient } from 'expo-linear-gradient'
import { borderRadius } from '@/theme'
import { useTheme } from '@/contexts/ThemeContext'

interface ShimmerSkeletonProps {
  width: number | string
  height: number
  borderRadius?: number
  style?: object
}

export default function ShimmerSkeleton({
  width,
  height,
  borderRadius: radius = borderRadius.md,
  style,
}: ShimmerSkeletonProps) {
  const { colors } = useTheme()
  const shimmerX = useSharedValue(-1)

  const styles = useMemo(() => StyleSheet.create({
    container: {
      overflow: 'hidden',
      backgroundColor: colors.surfaceContainer,
    },
    base: {
      ...StyleSheet.absoluteFill,
      backgroundColor: colors.surfaceContainer,
    },
    shimmerOverlay: {
      ...StyleSheet.absoluteFill,
      width: 200,
    },
  }), [colors])

  useEffect(() => {
    shimmerX.value = withRepeat(
      withTiming(1, { duration: 1200 }),
      -1,
      false
    )
  }, [])

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(shimmerX.value, [-1, 1], [-200, 200]),
      },
    ],
  }))

  return (
    <View
      style={[
        styles.container,
        { width, height, borderRadius: radius },
        style,
      ]}
    >
      <View style={[styles.base, { borderRadius: radius }]} />
      <Animated.View style={[styles.shimmerOverlay, animatedStyle]}>
        <LinearGradient
          colors={[
            'rgba(255,255,255,0)',
            'rgba(255,255,255,0.06)',
            'rgba(255,255,255,0)',
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  )
}

// ── Poster skeleton (2:3 aspect) ──

export function PosterSkeleton({ style }: { style?: object }) {
  return (
    <ShimmerSkeleton
      width="100%"
      height={0}
      borderRadius={borderRadius.lg}
      style={[
        {
          aspectRatio: 2 / 3,
          width: '100%',
        },
        style,
      ]}
    />
  )
}


