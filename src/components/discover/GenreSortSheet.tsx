// ─── GenreSortSheet — Spotify-style bottom sheet for genre sorting ───

import { useMemo } from 'react'
import { View, Text, Pressable, StyleSheet, Modal } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useTheme } from '@/contexts/ThemeContext'
import { spacing, borderRadius } from '@/theme'
import type { GenreSortBy } from '@/lib/tmdb'
import { GENRE_SORT_OPTIONS } from '@/lib/queries/discover'

interface GenreSortSheetProps {
  visible: boolean
  onClose: () => void
  mediaType: 'tv' | 'movie'
  value: GenreSortBy
  onChange: (v: GenreSortBy) => void
}

export default function GenreSortSheet({ visible, onClose, mediaType, value, onChange }: GenreSortSheetProps) {
  const { colors } = useTheme()

  const options = GENRE_SORT_OPTIONS[mediaType]

  const styles = useMemo(
    () =>
      StyleSheet.create({
        overlay: {
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'flex-end',
        },
        sheet: {
          backgroundColor: colors.surfaceContainerHigh,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          paddingTop: 12,
          paddingBottom: 24,
          paddingHorizontal: spacing.marginMobile,
        },
        handle: {
          width: 36,
          height: 4,
          borderRadius: 2,
          backgroundColor: colors.outlineVariant,
          alignSelf: 'center',
          marginBottom: 16,
        },
        title: {
          fontFamily: 'Inter',
          fontSize: 16,
          fontWeight: '700',
          color: colors.onSurface,
          marginBottom: 12,
        },
        option: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: 14,
          paddingHorizontal: 12,
          borderRadius: borderRadius.md,
        },
        optionActive: {
          backgroundColor: colors.surfaceContainerHighest,
        },
        optionLabel: {
          fontFamily: 'Inter',
          fontSize: 15,
          fontWeight: '500',
          color: colors.onSurface,
        },
        optionLabelActive: {
          color: colors.primary,
          fontWeight: '700',
        },
      }),
    [colors]
  )

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <Text style={styles.title}>Sort by</Text>
          {options.map((opt) => {
            const active = opt.value === value
            return (
              <Pressable
                key={opt.value}
                style={[styles.option, active && styles.optionActive]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  onChange(opt.value)
                  onClose()
                }}
              >
                <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>{opt.label}</Text>
                {active && <Ionicons name="checkmark" size={20} color={colors.primary} />}
              </Pressable>
            )
          })}
        </Pressable>
      </Pressable>
    </Modal>
  )
}
