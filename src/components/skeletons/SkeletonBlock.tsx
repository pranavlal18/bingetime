// ─── SkeletonBlock — pulsing rectangle placeholder ───
// Thin wrapper over ShimmerSkeleton so the app has a single skeleton
// animation system. Kept as a separate export because many call sites
// rely on this name/signature.

import { type ViewStyle, type DimensionValue } from 'react-native'
import ShimmerSkeleton from '@/components/ui/ShimmerSkeleton'
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
  return (
    <ShimmerSkeleton
      // DimensionValue ⊇ string|number (adds null/'auto'); all call sites
      // pass concrete widths, so narrowing here is safe.
      width={width as string | number}
      height={height}
      borderRadius={borderRadius}
      style={style as object}
    />
  )
}
