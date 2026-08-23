// ─── Person Page — bio, birth info, Known For posters ───

import { useMemo, useState } from 'react'
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native'
import { useLocalSearchParams, router, Stack } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { usePerson, topKnownFor } from '@/lib/queries/people'
import { getImageUrl, type TMDbCombinedCredit } from '@/lib/tmdb'
import { typography, spacing, borderRadius } from '@/theme'
import { useTheme } from '@/contexts/ThemeContext'

const PORTRAIT_W = 120
const PORTRAIT_H = 180
const POSTER_W = 108
const POSTER_H = 162
const TITLE_LINES = 2
const TITLE_LINE = 20
const YEAR_LINE = 16

export default function PersonPage() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const insets = useSafeAreaInsets()
  const { colors } = useTheme()
  const [bioExpanded, setBioExpanded] = useState(false)

  const personId = /^\d+$/.test(id) ? parseInt(id, 10) : null
  const { data: person, isLoading, error } = usePerson(personId)
  const knownFor = useMemo(() => topKnownFor(person), [person])

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.surface,
    },
    centered: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    errorText: {
      fontSize: typography.bodyMd.fontSize,
      color: colors.onSurfaceVariant,
      marginTop: 12,
      marginBottom: 16,
    },
    goBackButton: {
      paddingHorizontal: 20,
      paddingVertical: 10,
      backgroundColor: colors.surfaceContainer,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
    },
    goBackText: {
      color: colors.primary,
      fontSize: typography.bodySm.fontSize,
      fontWeight: '600',
    },
    scroll: {
      flex: 1,
    },

    // ── Back button overlay ──
    backButton: {
      position: 'absolute',
      top: insets.top + 8,
      left: spacing.marginMobile,
      width: 44,
      height: 44,
      borderRadius: borderRadius.full,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 10,
    },

    // ── Header row ──
    headerRow: {
      flexDirection: 'row',
      gap: spacing.stackMd,
      paddingHorizontal: spacing.marginMobile,
      paddingTop: insets.top + 16,
      marginBottom: spacing.stackLg,
    },
    portrait: {
      width: PORTRAIT_W,
      height: PORTRAIT_H,
      borderRadius: borderRadius.lg,
      backgroundColor: colors.surfaceContainerHighest,
    },
    portraitFallback: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    portraitInitial: {
      fontFamily: 'Inter',
      fontSize: typography.headlineLg.fontSize,
      fontWeight: '600',
      color: colors.onSurfaceVariant,
    },
    headerMeta: {
      flex: 1,
      justifyContent: 'center',
      gap: 8,
    },
    name: {
      fontFamily: 'Inter',
      fontSize: typography.headlineMd.fontSize,
      fontWeight: '700',
      lineHeight: typography.headlineMd.lineHeight,
      color: colors.onSurface,
    },
    departmentPill: {
      alignSelf: 'flex-start',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: borderRadius.full,
      backgroundColor: colors.surfaceContainerHighest,
    },
    departmentText: {
      fontFamily: 'Inter',
      fontSize: typography.labelSm.fontSize,
      fontWeight: '500',
      lineHeight: typography.labelSm.lineHeight,
      letterSpacing: typography.labelSm.letterSpacing,
      color: colors.onSurfaceVariant,
    },
    birthLine: {
      fontFamily: 'Inter',
      fontSize: typography.bodyXs.fontSize + 1,
      fontWeight: '400',
      lineHeight: typography.bodyXs.lineHeight + 1,
      color: colors.onSurfaceVariant,
    },

    // ── Sections ──
    section: {
      paddingHorizontal: spacing.marginMobile,
      marginBottom: 24,
    },
    sectionTitle: {
      fontFamily: 'Inter',
      fontSize: typography.bodyLg.fontSize,
      fontWeight: '700',
      lineHeight: typography.bodyLg.lineHeight,
      color: colors.onSurface,
      marginBottom: 12,
    },
    bioText: {
      fontFamily: 'Inter',
      fontSize: typography.bodyMd.fontSize,
      fontWeight: '400',
      lineHeight: typography.bodyMd.lineHeight,
      color: colors.onSurfaceVariant,
    },
    bioToggle: {
      alignSelf: 'flex-start',
      marginTop: spacing.stackSm,
    },
    bioToggleText: {
      fontFamily: 'Inter',
      fontSize: typography.labelSm.fontSize,
      fontWeight: '600',
      lineHeight: typography.labelSm.lineHeight,
      letterSpacing: typography.labelSm.letterSpacing,
      color: colors.primary,
    },

    // ── Known For ──
    // Section is NOT horizontally padded: the scroller spans full width so
    // partially scrolled cards clip at the true screen edge (scroll affordance).
    knownForSection: {
      marginBottom: 24,
    },
    knownForHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
      paddingHorizontal: spacing.marginMobile,
    },
    seeAllButton: {
      alignSelf: 'flex-start',
    },
    seeAllText: {
      fontFamily: 'Inter',
      fontSize: typography.labelMd.fontSize,
      fontWeight: '600',
      lineHeight: typography.labelMd.lineHeight,
      color: colors.primary,
    },
    knownForRow: {
      gap: spacing.stackMd,
      paddingHorizontal: spacing.marginMobile,
    },
    creditCard: {
      width: POSTER_W,
      gap: 6,
    },
    creditPressed: {
      opacity: 0.6,
    },
    poster: {
      width: POSTER_W,
      height: POSTER_H,
      borderRadius: borderRadius.lg,
      backgroundColor: colors.surfaceContainerHighest,
    },
    posterFallback: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    creditTitle: {
      fontFamily: 'Inter',
      fontSize: typography.bodySm.fontSize,
      fontWeight: '500',
      lineHeight: TITLE_LINE,
      // Fixed 2-line reserve so the year line aligns across all cards
      height: TITLE_LINES * TITLE_LINE,
      color: colors.onSurface,
    },
    creditYear: {
      fontFamily: 'Inter',
      fontSize: typography.labelSm.fontSize,
      fontWeight: '400',
      lineHeight: YEAR_LINE,
      height: YEAR_LINE,
      color: colors.onSurfaceVariant,
    },
  }), [colors, insets.top])

  // Loading / error branches first, then main render
  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  if (error || (!person && !isLoading)) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.onSurfaceVariant} />
        <Text style={styles.errorText}>Could not load person details</Text>
        <Pressable onPress={() => router.back()} style={styles.goBackButton}>
          <Text style={styles.goBackText}>Go back</Text>
        </Pressable>
      </View>
    )
  }

  if (!person) return null

  const biography = person.biography ?? ''
  const birthYear = person.birthday?.slice(0, 4)
  const deathYear = person.deathday?.slice(0, 4)
  const portraitUrl = getImageUrl(person.profile_path ?? null, 'w185')

  let birthLine: string | null = null
  if (deathYear) {
    birthLine = birthYear ? `${birthYear}–${deathYear}` : `–${deathYear}`
  } else {
    const parts = [birthYear, person.place_of_birth].filter(Boolean) as string[]
    birthLine = parts.length > 0 ? parts.join(' · ') : null
  }

  const handleBack = () => router.back()

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Back button ── */}
        <Pressable onPress={handleBack} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={colors.primary} />
        </Pressable>

        {/* ── Header row ── */}
        <View style={styles.headerRow}>
          {portraitUrl ? (
            <Image
              source={{ uri: portraitUrl }}
              style={styles.portrait}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={150}
            />
          ) : (
            <View style={[styles.portrait, styles.portraitFallback]}>
              <Text style={styles.portraitInitial}>{person.name.charAt(0)}</Text>
            </View>
          )}
          <View style={styles.headerMeta}>
            <Text style={styles.name}>{person.name}</Text>
            {person.known_for_department ? (
              <View style={styles.departmentPill}>
                <Text style={styles.departmentText}>{person.known_for_department}</Text>
              </View>
            ) : null}
            {birthLine ? <Text style={styles.birthLine}>{birthLine}</Text> : null}
          </View>
        </View>

        {/* ── Biography ── */}
        {biography.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Biography</Text>
            <Text style={styles.bioText} numberOfLines={bioExpanded ? undefined : 5}>
              {biography}
            </Text>
            {biography.length >= 200 ? (
              <Pressable onPress={() => setBioExpanded((v) => !v)} style={styles.bioToggle}>
                <Text style={styles.bioToggleText}>{bioExpanded ? 'Show less' : 'Read more'}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {/* ── Known For ── */}
        {knownFor.length > 0 ? (
          <View style={styles.knownForSection}>
            <View style={styles.knownForHeader}>
              <Text style={styles.sectionTitle}>Known For</Text>
              <Pressable
                onPress={() => router.push(`/person/${id}/credits`)}
                style={styles.seeAllButton}
                accessibilityRole="button"
                accessibilityLabel="See all credits"
              >
                <Text style={styles.seeAllText}>See All</Text>
              </Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.knownForRow}>
              {knownFor.map((credit: TMDbCombinedCredit) => {
                const posterUrl = getImageUrl(credit.poster_path ?? null, 'w185')
                const title = credit.title ?? credit.name ?? ''
                const year = (credit.release_date ?? credit.first_air_date ?? '')?.slice(0, 4)
                return (
                  <Pressable
                    key={`${credit.media_type}-${credit.id}`}
                    style={({ pressed }) => [styles.creditCard, pressed && styles.creditPressed]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                      router.push(credit.media_type === 'tv' ? `/show/${credit.id}` : `/movie/${credit.id}`)
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
                    <Text numberOfLines={2} style={styles.creditTitle}>{title}</Text>
                    {/* Always rendered (empty when absent) so years align across cards */}
                    <Text numberOfLines={1} style={styles.creditYear}>{year ?? ''}</Text>
                  </Pressable>
                )
              })}
            </ScrollView>
          </View>
        ) : null}
      </ScrollView>
    </View>
  )
}
