// ─── TappableLogoPills — tappable network/company pills with brand logos ───
// Renders a wrap-row of Pressable pills. Pills with a TMDb logo_path show the
// brand logo; others fall back to a text chip styled like genre chips. Every
// tap fires the same Light haptic as genre chips.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { Image } from 'expo-image'
import { hapticLight } from '@/utils/haptics'
import { getImageUrl } from '@/lib/tmdb'
import { getLogoIsDark } from '@/utils/logoLuminance'
import { borderRadius } from '@/theme'
import { useTheme } from '@/contexts/ThemeContext'
import type { ThemePayload } from '@/themes'

// Soft off-white backdrop for dark brand logos (black wordmarks) so they read
// on the app's dark pill background — see utils/logoLuminance
const LIGHT_LOGO_TILE = '#ECE9F1'

export interface TappablePillItem {
  id: number
  name: string
  logo_path?: string | null
}

interface TappableLogoPillsProps {
  items: TappablePillItem[]
  onPress: (item: TappablePillItem) => void
  accessibilityLabelFor: (item: TappablePillItem) => string
}

// RN images need explicit dimensions — measure each logo's aspect ratio on
// load and derive width from this fixed height. Until then assume a typical
// wordmark ratio (~2). On failure the pill falls back to its text chip.
const PILL_LOGO_HEIGHT = 18

function Pill({
  item,
  onPress,
  accessibilityLabel,
  colors,
}: {
  item: TappablePillItem
  onPress: (item: TappablePillItem) => void
  accessibilityLabel: string
  colors: ThemePayload['colors']
}) {
  const [logoRatio, setLogoRatio] = useState(2)
  const [logoFailed, setLogoFailed] = useState(false)

  // expo-image can't reliably render SVGs — treat them as unavailable up front
  const logoUrl = useMemo(() => {
    const url = getImageUrl(item.logo_path ?? null, 'w154')
    return url && !url.endsWith('.svg') ? url : null
  }, [item.logo_path])
  const showLogo = !!logoUrl && !logoFailed

  // Dark logos (black wordmarks) vanish on the dark pill — detect them once
  // per URL (memoized) and swap the pill to a light backdrop for those only
  const [logoIsDark, setLogoIsDark] = useState(false)
  useEffect(() => {
    let cancelled = false
    setLogoIsDark(false)
    if (!logoUrl) return
    getLogoIsDark(logoUrl).then((dark) => {
      if (!cancelled && dark === true) setLogoIsDark(true)
    })
    return () => {
      cancelled = true
    }
  }, [logoUrl])

  const styles = useMemo(
    () =>
      StyleSheet.create({
        logoPill: {
          paddingHorizontal: 10,
          paddingVertical: 8,
          borderRadius: borderRadius.md,
          backgroundColor: colors.surfaceContainerHighest,
        },
        logoPillLight: {
          paddingHorizontal: 10,
          paddingVertical: 8,
          borderRadius: borderRadius.md,
          backgroundColor: LIGHT_LOGO_TILE,
        },
        logo: {
          height: PILL_LOGO_HEIGHT,
        },
        textChip: {
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: borderRadius.full,
          backgroundColor: colors.secondaryContainer,
        },
        textChipText: {
          fontFamily: 'Inter',
          fontSize: 12,
          fontWeight: '600',
          lineHeight: 16,
          color: colors.onSecondaryContainer,
        },
      }),
    [colors]
  )

  const handlePress = useCallback(() => {
    hapticLight()
    onPress(item)
  }, [item, onPress])

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        showLogo ? (logoIsDark ? styles.logoPillLight : styles.logoPill) : styles.textChip,
        pressed && { opacity: 0.6 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      {showLogo ? (
        <Image
          source={{ uri: logoUrl ?? undefined }}
          recyclingKey={logoUrl ?? undefined}
          style={[styles.logo, { width: Math.min(Math.max(PILL_LOGO_HEIGHT * logoRatio, 32), 140) }]}
          contentFit="contain"
          cachePolicy="memory-disk"
          transition={150}
          onLoad={(e) => {
            const src = e.source
            if (src?.width && src?.height) setLogoRatio(src.width / src.height)
          }}
          onError={() => setLogoFailed(true)}
        />
      ) : (
        <Text style={styles.textChipText}>{item.name}</Text>
      )}
    </Pressable>
  )
}

export default function TappableLogoPills({ items, onPress, accessibilityLabelFor }: TappableLogoPillsProps) {
  const { colors } = useTheme()

  return (
    <View style={stylesRow.row}>
      {items.map((item) => (
        <Pill
          key={`${item.id}-${item.name}`}
          item={item}
          onPress={onPress}
          accessibilityLabel={accessibilityLabelFor(item)}
          colors={colors}
        />
      ))}
    </View>
  )
}

// Static row layout — no theme colors, safe at module level
const stylesRow = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
})
