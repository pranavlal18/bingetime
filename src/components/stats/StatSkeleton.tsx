// ─── StatSkeleton — skeleton that mirrors the stats page layout ───

import { memo, useEffect, useMemo } from 'react'
import { View, StyleSheet } from 'react-native'
import Animated, {
  useSharedValue,
  withRepeat,
  withTiming,
  useAnimatedStyle,
  Easing,
} from 'react-native-reanimated'
import { useTheme } from '@/contexts/ThemeContext'

// ── Shared pulsing block ──

const SkeletonPulse = memo(function SkeletonPulse({
  width,
  height,
  borderRadius = 6,
  style,
}: {
  width: number | string
  height: number
  borderRadius?: number
  style?: any
}) {
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

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          borderRadius,
          backgroundColor: colors.surfaceContainerHighest,
        },
        animatedStyle,
        style,
      ]}
    />
  )
})

// ── StatBlock skeleton — matches StatBlock exactly ──

function SkeletonStatBlock({
  children,
}: {
  children?: React.ReactNode
}) {
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
      <SkeletonPulse width="55%" height={16} style={{ marginBottom: 14 }} />
      {children}
    </View>
  )
}

// ── Big number block ──

function BigNumberLine() {
  return (
    <View style={{ marginBottom: 10 }}>
      <SkeletonPulse width="35%" height={28} borderRadius={4} />
      <SkeletonPulse width="45%" height={12} borderRadius={4} style={{ marginTop: 6 }} />
    </View>
  )
}

// ── Bar chart skeleton ──

function ChartBars({ height = 80 }: { height?: number }) {
  // Fixed heights for each bar so they don't flicker on re-render
  const barHeights = useMemo(
    () => [40, 55, 35, 60, 45, 70, 50, 65, 38, 52, 48, 62],
    []
  )
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: 3,
        height,
        alignItems: 'flex-end',
        marginTop: 8,
      }}
    >
      {barHeights.map((h, i) => (
        <SkeletonPulse key={i} width="7%" height={h} borderRadius={3} />
      ))}
    </View>
  )
}

// ── Marathon row skeleton ──

function MarathonRowSkeleton() {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 12,
      }}
    >
      <SkeletonPulse width={36} height={36} borderRadius={8} />
      <View style={{ flex: 1, gap: 4 }}>
        <SkeletonPulse width="70%" height={14} borderRadius={4} />
        <SkeletonPulse width="40%" height={11} borderRadius={4} />
      </View>
    </View>
  )
}

// ── Full page stats skeleton ──

export function StatsPageSkeleton() {
  const { colors } = useTheme()
  const SIDE_OFFSET = 20

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* ── Header ── */}
      <View
        style={{
          paddingTop: 12,
          paddingBottom: 12,
          paddingHorizontal: SIDE_OFFSET,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <SkeletonPulse width={24} height={24} borderRadius={12} />
        <SkeletonPulse width={90} height={18} borderRadius={4} />
      </View>

      {/* ── Segmented toggle ── */}
      <View
        style={{
          paddingHorizontal: SIDE_OFFSET,
          marginBottom: 16,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: colors.surfaceContainerLow,
            borderRadius: 100,
            padding: 4,
            gap: 4,
          }}
        >
          <SkeletonPulse
            width="50%"
            height={36}
            borderRadius={100}
          />
          <SkeletonPulse
            width="50%"
            height={36}
            borderRadius={100}
          />
        </View>
      </View>

      {/* ── Content blocks ── */}
      <View
        style={{
          paddingHorizontal: SIDE_OFFSET,
          gap: 16,
        }}
      >
        {/* 1. Hero — Time spent watching */}
        <SkeletonStatBlock>
          <BigNumberLine />
          <ChartBars height={100} />
        </SkeletonStatBlock>

        {/* 2. Total watched */}
        <SkeletonStatBlock>
          <BigNumberLine />
          <ChartBars height={80} />
        </SkeletonStatBlock>

        {/* 3. Added counts */}
        <SkeletonStatBlock>
          <BigNumberLine />
        </SkeletonStatBlock>

        {/* 4. Biggest marathons */}
        <SkeletonStatBlock>
          <MarathonRowSkeleton />
          <MarathonRowSkeleton />
        </SkeletonStatBlock>

        {/* 5. Remaining */}
        <SkeletonStatBlock>
          <BigNumberLine />
        </SkeletonStatBlock>

        {/* 6. Upcoming */}
        <SkeletonStatBlock>
          <SkeletonPulse width="75%" height={14} borderRadius={4} style={{ marginBottom: 8 }} />
          <SkeletonPulse width="60%" height={14} borderRadius={4} style={{ marginBottom: 8 }} />
          <ChartBars height={80} />
        </SkeletonStatBlock>
      </View>
    </View>
  )
}

export default SkeletonStatBlock
