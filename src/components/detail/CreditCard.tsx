// ─── CreditCard — poster card used by Known For row and All Credits grid ───
//
// Card width == poster width (poster fills the card at ~2:3 aspect ratio), so
// all text is constrained to the poster's exact bounds. Title wraps to max 2
// lines; year/role follow at natural height so short names never show a gap
// between title and meta — leftover space lands below the card instead.

import { useMemo, type ReactNode } from 'react'
import { Text, View, StyleSheet, Pressable } from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { hapticLight } from '@/utils/haptics'
import { borderRadius } from '@/theme'
import { getImageUrl } from '@/lib/tmdb'
import { useTheme } from '@/contexts/ThemeContext'

/** Locked size modes — see Artist Page design contract. */
const TITLE_LINE_NORMAL = 18 // 13px / 500
const TITLE_LINE_COMPACT = 16 // 12px / 500
const META_LINE = 16 // 12px / 400

interface CreditCardProps {
  posterPath: string | null
  title: string
  /** Always-rendered meta line ('' when absent) so rows share a baseline. */
  year?: string | null
  /** Character (cast) or job (crew) shown as an extra meta line. */
  roleLabel?: string | null
  /**
   * Fixed card width for horizontal scrollers (e.g. Known For row at 92px).
   * Omit inside grids — the card defaults to flex:1 and shares column width.
   */
  width?: number
  /** true → credits-grid sizing (12px title / h32 reserve). */
  compact?: boolean
  /** Optional overlay (e.g. LibraryBadge) positioned top-right of the poster. */
  badge?: ReactNode
  onPress: () => void
}

export default function CreditCard({
  posterPath,
  title,
  year,
  roleLabel,
  width,
  compact = false,
  badge,
  onPress,
}: CreditCardProps) {
  const { colors } = useTheme()

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          gap: 4,
          overflow: 'hidden',
          flexShrink: 0,
        },
        cardFlex: {
          flex: 1,
        },
        pressed: {
          opacity: 0.6,
        },
        poster: {
          width: '100%',
          aspectRatio: 2 / 2.85,
          borderRadius: borderRadius.md,
          backgroundColor: colors.surfaceContainerHighest,
          overflow: 'hidden',
        },
        posterFallback: {
          justifyContent: 'center',
          alignItems: 'center',
        },
        titleNormal: {
          fontFamily: 'Inter',
          fontSize: 13,
          fontWeight: '500',
          lineHeight: TITLE_LINE_NORMAL,
          color: colors.onSurface,
        },
        titleCompact: {
          fontFamily: 'Inter',
          fontSize: 12,
          fontWeight: '500',
          lineHeight: TITLE_LINE_COMPACT,
          color: colors.onSurface,
        },
        meta: {
          fontFamily: 'Inter',
          fontSize: 12,
          fontWeight: '400',
          lineHeight: META_LINE,
          color: colors.onSurfaceVariant,
        },
      }),
    [colors],
  )

  const posterUrl = getImageUrl(posterPath ?? null, 'w185')

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        width != null ? { width } : styles.cardFlex,
        pressed && styles.pressed,
      ]}
      onPress={() => {
        hapticLight()
        onPress()
      }}
      accessibilityRole="button"
      accessibilityLabel={`${title}${year ? ` (${year})` : ''}`}
    >
      <View>
        {posterUrl ? (
          <Image
            source={{ uri: posterUrl }}
            style={styles.poster}
            contentFit="cover"
            cachePolicy="memory-disk"
            recyclingKey={posterUrl}
            transition={150}
          />
        ) : (
          <View style={[styles.poster, styles.posterFallback]}>
            <Ionicons name="film-outline" size={24} color={colors.outlineVariant} />
          </View>
        )}
        {badge}
      </View>
      <Text numberOfLines={2} ellipsizeMode="tail" style={compact ? styles.titleCompact : styles.titleNormal}>
        {title}
      </Text>
      {/* Meta follows the title's natural height — year tight under 1-line
          names, unchanged for wrapped ones. Role renders only when present. */}
      {year ? (
        <Text numberOfLines={1} ellipsizeMode="tail" style={styles.meta}>
          {year}
        </Text>
      ) : null}
      {roleLabel ? (
        <Text numberOfLines={1} ellipsizeMode="tail" style={styles.meta}>
          {roleLabel}
        </Text>
      ) : null}
    </Pressable>
  )
}
