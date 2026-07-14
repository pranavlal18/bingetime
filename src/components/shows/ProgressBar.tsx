// ─── ProgressBar — thin animated progress indicator ───

import { useEffect, useMemo } from 'react'
import { View, StyleSheet } from 'react-native'
import Animated, {
  useSharedValue,
  withTiming,
  useAnimatedStyle,
  interpolate,
} from 'react-native-reanimated'
import { useTheme } from '@/contexts/ThemeContext'

interface ProgressBarProps {
  episodesSeen: number
  totalEpisodes: number | null
  height?: number
  color?: string
  backgroundColor?: string
}

export default function ProgressBar({
  episodesSeen,
  totalEpisodes,
  height = 3,
  color,
  backgroundColor,
}: ProgressBarProps) {
  const { colors } = useTheme()

  const resolvedColor = color ?? colors.primary
  const resolvedBg = backgroundColor ?? colors.surfaceContainerHighest

  const animatedWidth = useSharedValue(0)

  const styles = useMemo(() => StyleSheet.create({
    track: {
      width: '100%',
      overflow: 'hidden',
    },
    fill: {
      position: 'absolute',
      left: 0,
      top: 0,
    },
  }), [])

  const fraction =
    totalEpisodes && totalEpisodes > 0
      ? Math.min(episodesSeen / totalEpisodes, 1)
      : 0

  useEffect(() => {
    animatedWidth.value = withTiming(fraction, { duration: 400 })
  }, [fraction, animatedWidth])

  const isComplete =
    totalEpisodes !== null &&
    episodesSeen >= totalEpisodes &&
    totalEpisodes > 0

  const animatedStyle = useAnimatedStyle(() => ({
    width: `${interpolate(animatedWidth.value, [0, 1], [0, 100])}%`,
  }))

  return (
    <View
      style={[
        styles.track,
        { height, backgroundColor: resolvedBg, borderRadius: height / 2 },
      ]}
    >
      <Animated.View
        style={[
          styles.fill,
          animatedStyle,
          {
            height,
            backgroundColor: isComplete ? colors.success : resolvedColor,
            borderRadius: height / 2,
          },
        ]}
      />
    </View>
  )
}
