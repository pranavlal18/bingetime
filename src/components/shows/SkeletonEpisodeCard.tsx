// ─── SkeletonEpisodeCard — shimmer placeholder for loading upcoming episodes ───

import { useMemo } from 'react'
import { View, StyleSheet } from 'react-native'
import ShimmerSkeleton from '@/components/ui/ShimmerSkeleton'
import { spacing, borderRadius } from '@/theme'
import { useTheme } from '@/contexts/ThemeContext'

export default function SkeletonEpisodeCard() {
  const { colors } = useTheme()

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
      marginBottom: 4,
    },
    episodeLine: {
      width: '55%',
      height: 16,
      borderRadius: borderRadius.sm,
      marginTop: 4,
    },
    titleLine: {
      width: '75%',
      height: 14,
      borderRadius: borderRadius.sm,
      marginTop: 6,
    },
    rightPlaceholder: {
      width: 36,
      height: 36,
      borderRadius: 18,
      marginLeft: spacing.stackSm,
    },
  }), [colors])

  return (
    <View style={styles.container}>
      {/* Poster skeleton */}
      <ShimmerSkeleton width={56} height={84} borderRadius={borderRadius.md} />

      {/* Info block skeleton */}
      <View style={styles.infoBlock}>
        <ShimmerSkeleton width="40%" height={18} borderRadius={borderRadius.full} style={styles.pill} />
        <ShimmerSkeleton width="55%" height={16} borderRadius={borderRadius.sm} style={styles.episodeLine} />
        <ShimmerSkeleton width="75%" height={14} borderRadius={borderRadius.sm} style={styles.titleLine} />
      </View>

      {/* Right circle skeleton */}
      <ShimmerSkeleton width={36} height={36} borderRadius={18} style={styles.rightPlaceholder} />
    </View>
  )
}
