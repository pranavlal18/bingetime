// ─── LibraryBadge — round +/✓ toggle overlaid on poster cards ───
// Visual twin of the Trending/Recommended badges; spinner while pending.

import { memo, useMemo } from 'react'
import { View, Pressable, StyleSheet, ActivityIndicator } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/contexts/ThemeContext'

interface LibraryBadgeProps {
  /** Absolute size of the round badge (default 28; use 22 for dense grids) */
  size?: number
  isInLibrary: boolean
  isPending: boolean
  onToggle: () => void
}

const LibraryBadge = memo(function LibraryBadge({
  size = 28,
  isInLibrary,
  isPending,
  onToggle,
}: LibraryBadgeProps) {
  const { colors } = useTheme()

  const styles = useMemo(
    () =>
      StyleSheet.create({
        badge: {
          position: 'absolute',
          top: 6,
          right: 6,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: 'rgba(0,0,0,0.55)',
          justifyContent: 'center',
          alignItems: 'center',
          borderWidth: 1.5,
          borderColor: 'rgba(255,255,255,0.25)',
        },
      }),
    [size]
  )

  const activeStyle = useMemo(
    () => ({ backgroundColor: colors.primary, borderColor: colors.primary }),
    [colors]
  )

  return (
    <Pressable
      style={[styles.badge, isInLibrary && activeStyle]}
      onPress={onToggle}
      disabled={isPending}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={isInLibrary ? 'Remove from library' : 'Add to library'}
    >
      {isPending ? (
        <ActivityIndicator size="small" color="#fff" />
      ) : (
        <Ionicons name={isInLibrary ? 'checkmark' : 'add'} size={Math.round(size * 0.55)} color="#fff" />
      )}
    </Pressable>
  )
})

export default LibraryBadge
