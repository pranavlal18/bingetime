// ─── StatSkeleton — shimmer placeholders for stats blocks ───

import { memo, useEffect, useRef } from 'react'
import { View, Animated } from 'react-native'
import { useTheme } from '@/contexts/ThemeContext'

interface SkeletonBlockProps {
  lines?: number
  hasBar?: boolean
  hasChart?: boolean
}

const SkeletonPulse = memo(function SkeletonPulse({
  width,
  height,
  style,
}: {
  width: number | string
  height: number
  style?: any
}) {
  const { colors } = useTheme()
  const opacity = useRef(new Animated.Value(0.3)).current

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    )
    animation.start()
    return () => animation.stop()
  }, [opacity])

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          borderRadius: 6,
          backgroundColor: colors.surfaceContainerHighest,
          opacity,
        },
        style,
      ]}
    />
  )
})

const StatSkeleton = memo(function StatSkeleton({
  lines = 1,
  hasBar = false,
  hasChart = false,
}: SkeletonBlockProps) {
  const { colors } = useTheme()

  return (
    <View
      style={{
        backgroundColor: colors.surfaceContainer,
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
      }}
    >
      {/* Title line */}
      <SkeletonPulse width="50%" height={16} style={{ marginBottom: 14 }} />

      {/* Body lines */}
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonPulse
          key={`line-${i}`}
          width={i === lines - 1 ? '60%' : '90%'}
          height={14}
          style={{ marginBottom: 10 }}
        />
      ))}

      {/* Horizontal bar placeholder */}
      {hasBar && (
        <View style={{ marginTop: 4 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <View key={`bar-${i}`} style={{ marginBottom: 12 }}>
              <SkeletonPulse width="100%" height={6} />
            </View>
          ))}
        </View>
      )}

      {/* Chart placeholder */}
      {hasChart && (
        <View style={{ flexDirection: 'row', gap: 3, height: 80, alignItems: 'flex-end', marginTop: 8 }}>
          {Array.from({ length: 12 }).map((_, i) => (
            <SkeletonPulse
              key={`chart-${i}`}
              width="7%"
              height={20 + Math.random() * 60}
            />
          ))}
        </View>
      )}
    </View>
  )
})

/** Full-page stats skeleton */
export function StatsPageSkeleton() {
  return (
    <View style={{ paddingHorizontal: 20, gap: 16 }}>
      <StatSkeleton lines={2} />
      <StatSkeleton lines={2} hasChart />
      <StatSkeleton lines={1} />
      <StatSkeleton hasBar />
      <StatSkeleton hasBar />
    </View>
  )
}

export default StatSkeleton
