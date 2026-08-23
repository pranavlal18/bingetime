// ─── CastRow — TV Time-style horizontal cast scroller (tappable members) ───

import { useMemo } from 'react'
import { Text, View, ScrollView, StyleSheet, Pressable } from 'react-native'
import { router } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { Image } from 'expo-image'
import type { TMDbCastMember } from '@/lib/tmdb'
import { getImageUrl } from '@/lib/tmdb'
import { typography, spacing, borderRadius } from '@/theme'
import { useTheme } from '@/contexts/ThemeContext'

const MAX_CAST = 15
const AVATAR_SIZE = 52
const MEMBER_WIDTH = 84
const NAME_LINE = 20
// Characters wrap up to 2 lines INSIDE the fixed card width; the space is
// reserved on every card so long roles never change card dimensions.
const CHARACTER_LINE = 15
const CHARACTER_RESERVE = CHARACTER_LINE * 2
const CARD_GAP = 12

interface CastRowProps {
  cast?: TMDbCastMember[]
  isLoading?: boolean
}

const SKELETON_KEYS = ['s0', 's1', 's2', 's3', 's4', 's5']

export default function CastRow({ cast, isLoading }: CastRowProps) {
  const { colors } = useTheme()

  const styles = useMemo(
    () =>
      StyleSheet.create({
      section: {
      paddingVertical: spacing.stackMd,
    },
    label: {
      fontFamily: 'Inter',
      fontSize: typography.bodyLg.fontSize,
      fontWeight: '700',
      lineHeight: typography.bodyLg.lineHeight,
      color: colors.onSurface,
      marginBottom: spacing.stackMd,
    },
    row: {
      gap: CARD_GAP,
      paddingHorizontal: spacing.marginMobile,
    },
    // Bleed edge-to-edge past the parent's horizontal padding so partially
    // scrolled cards clip at the true screen edge, not the content margin.
    scroller: {
      marginHorizontal: -spacing.marginMobile,
    },
    member: {
      width: MEMBER_WIDTH,
      alignItems: 'center',
      gap: 6,
    },
    memberPressed: {
      opacity: 0.6,
    },
    avatar: {
      width: AVATAR_SIZE,
      height: AVATAR_SIZE,
      borderRadius: borderRadius.full,
      backgroundColor: colors.surfaceContainerHighest,
    },
    avatarFallback: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    initial: {
      fontFamily: 'Inter',
      fontSize: typography.headlineMd.fontSize,
      fontWeight: '600',
      color: colors.onSurfaceVariant,
    },
    name: {
      fontFamily: 'Inter',
      fontSize: typography.bodySm.fontSize,
      fontWeight: '600',
      lineHeight: NAME_LINE,
      height: NAME_LINE,
      color: colors.onSurface,
      textAlign: 'center',
    },
    character: {
      fontFamily: 'Inter',
      fontSize: typography.labelSm.fontSize,
      fontWeight: '400',
      lineHeight: CHARACTER_LINE,
      height: CHARACTER_RESERVE,
      color: colors.onSurfaceVariant,
      textAlign: 'center',
    },
    skeletonAvatar: {
      width: AVATAR_SIZE,
      height: AVATAR_SIZE,
      borderRadius: borderRadius.full,
      backgroundColor: colors.surfaceContainerHighest,
      opacity: 0.5,
    },
    skeletonLine: {
      borderRadius: borderRadius.sm,
      backgroundColor: colors.surfaceContainerHighest,
      opacity: 0.5,
    },
    skeletonName: {
      height: NAME_LINE,
      width: 64,
    },
    skeletonCharacter: {
      height: CHARACTER_RESERVE,
      width: 44,
    },
    }),
    [colors],
  )

  // TMDb returns cast pre-ordered by billing importance — take top N.
  const members = useMemo(() => (cast ?? []).slice(0, MAX_CAST), [cast])

  if (isLoading) {
    return (
      <View style={styles.section}>
        <Text style={styles.label}>Cast</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroller} contentContainerStyle={styles.row}>
          {SKELETON_KEYS.map((k) => (
            <View key={k} style={styles.member}>
              <View style={styles.skeletonAvatar} />
              <View style={[styles.skeletonLine, styles.skeletonName]} />
              <View style={[styles.skeletonLine, styles.skeletonCharacter]} />
            </View>
          ))}
        </ScrollView>
      </View>
    )
  }

  if (members.length === 0) {
    if (__DEV__) console.warn('[CastRow] No cast data — hiding section')
    return null
  }

  return (
    <View style={styles.section}>
      <Text style={styles.label}>Cast</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroller} contentContainerStyle={styles.row}>
        {members.map((member) => {
          const avatarUrl = getImageUrl(member.profile_path, 'w185')
          return (
            <Pressable
              key={member.id}
              style={({ pressed }) => [styles.member, pressed && styles.memberPressed]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                router.push(`/person/${member.id}`)
              }}
              accessibilityRole="button"
              accessibilityLabel={`${member.name} — ${member.character}`}
            >
              {avatarUrl ? (
                <Image
                  source={{ uri: avatarUrl }}
                  style={styles.avatar}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  transition={150}
                />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text style={styles.initial}>{member.name.charAt(0)}</Text>
                </View>
              )}
              <Text numberOfLines={1} style={styles.name}>{member.name}</Text>
              {/* Wraps up to 2 lines inside the fixed card width; space always reserved */}
              <Text numberOfLines={2} style={styles.character}>{member.character ?? ''}</Text>
            </Pressable>
          )
        })}
      </ScrollView>
    </View>
  )
}
