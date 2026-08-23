// ─── CreditCard — poster card used by Known For row and All Credits grid ───
//
// Card width == poster width (poster fills the card at 2:3 aspect ratio), so
// all text is constrained to the poster's exact bounds and can never overflow.
// Title reserves 2 fixed lines; year + role are always-rendered fixed lines so
// cards in the same grid row align on a shared baseline.

import { useMemo } from 'react'
import { Text, View, StyleSheet, Pressable } from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { typography, borderRadius } from '@/theme'
import { getImageUrl } from '@/lib/tmdb'
import { useTheme } from '@/contexts/ThemeContext'

const TITLE_LINE = 20
const TITLE_LINES = 2
const META_LINE = 16

interface CreditCardProps {
  posterPath: string | null
  title: string
  year?: string | null
  /** Character (cast) or job (crew) shown as a third muted line. */
  roleLabel?: string | null
  /**
   * Fixed card width for horizontal scrollers (e.g. Known For row).
   * Omit inside grids — the card defaults to flex:1 and shares column width.
   */
  width?: number
  onPress: () => void
}

export default function CreditCard({
  posterPath,
  title,
  year,
  roleLabel,
  width,
  onPress,
}: CreditCardProps) {
  const { colors } = useTheme()

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          gap: 4,
        },
        cardFlex: {
          flex: 1,
        },
        pressed: {
          opacity: 0.6,
        },
        poster: {
          width: '100%',
          aspectRatio: 2 / 3,
          borderRadius: borderRadius.lg,
          backgroundColor: colors.surfaceContainerHighest,
        },
        posterFallback: {
          justifyContent: 'center',
          alignItems: 'center',
        },
        title: {
          fontFamily: 'Inter',
          fontSize: typography.bodySm.fontSize,
          fontWeight: '500',
          lineHeight: TITLE_LINE,
          height: TITLE_LINES * TITLE_LINE,
          color: colors.onSurface,
        },
        meta: {
          fontFamily: 'Inter',
          fontSize: typography.labelSm.fontSize,
          fontWeight: '400',
          lineHeight: META_LINE,
          height: META_LINE,
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
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        onPress()
      }}
      accessibilityRole="button"
      accessibilityLabel={`${title}${year ? ` (${year})` : ''}`}
    >
      {posterUrl ? (
        <Image
          source={{ uri: posterUrl }}
          style={styles.poster}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={150}
        />
      ) : (
        <View style={[styles.poster, styles.posterFallback]}>
          <Ionicons name="film-outline" size={24} color={colors.outlineVariant} />
        </View>
      )}
      <Text numberOfLines={2} style={styles.title}>
        {title}
      </Text>
      {/* Always rendered so cards in a grid row share one baseline */}
      <Text numberOfLines={1} style={styles.meta}>
        {year ?? ''}
      </Text>
      {roleLabel !== undefined ? (
        <Text numberOfLines={1} style={styles.meta}>
          {roleLabel ?? ''}
        </Text>
      ) : null}
    </Pressable>
  )
}
