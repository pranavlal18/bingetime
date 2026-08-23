// ─── CastRow — TV Time-style horizontal cast scroller (display-only) ───

import { useMemo } from 'react'
import { Text, View, ScrollView, StyleSheet } from 'react-native'
import { Image } from 'expo-image'
import type { TMDbCastMember } from '@/lib/tmdb'
import { getImageUrl } from '@/lib/tmdb'
import { typography, spacing, borderRadius } from '@/theme'
import { useTheme } from '@/contexts/ThemeContext'

const MAX_CAST = 15
const AVATAR_SIZE = 60

interface CastRowProps {
  cast?: TMDbCastMember[]
  isLoading?: boolean
}

const SKELETON_KEYS = ['s0', 's1', 's2', 's3', 's4', 's5']

export default function CastRow({ cast, isLoading }: CastRowProps) {
  const { colors } = useTheme()

  const styles = StyleSheet.create({
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
      gap: spacing.stackMd,
      paddingRight: spacing.marginMobile,
    },
    member: {
      width: 72,
      alignItems: 'center',
      gap: 6,
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
      fontSize: typography.bodyXs.fontSize,
      fontWeight: '600',
      lineHeight: typography.bodyXs.lineHeight,
      color: colors.onSurface,
      textAlign: 'center',
    },
    character: {
      fontFamily: 'Inter',
      fontSize: typography.bodyXs.fontSize - 1,
      fontWeight: '500',
      lineHeight: typography.bodyXs.lineHeight - 1,
      color: colors.onSurfaceVariant,
      opacity: 0.7,
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
      height: 10,
      width: 56,
      borderRadius: borderRadius.sm,
      backgroundColor: colors.surfaceContainerHighest,
      opacity: 0.5,
    },
  })

  // TMDb returns cast pre-ordered by billing importance — take top N.
  const members = useMemo(() => (cast ?? []).slice(0, MAX_CAST), [cast])

  if (isLoading) {
    return (
      <View style={styles.section}>
        <Text style={styles.label}>Cast</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {SKELETON_KEYS.map((k) => (
            <View key={k} style={styles.member}>
              <View style={styles.skeletonAvatar} />
              <View style={styles.skeletonLine} />
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
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {members.map((member) => {
          const avatarUrl = getImageUrl(member.profile_path, 'w185')
          return (
            <View key={member.id} style={styles.member}>
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
              {member.character ? (
                <Text numberOfLines={1} style={styles.character}>{member.character}</Text>
              ) : null}
            </View>
          )
        })}
      </ScrollView>
    </View>
  )
}
