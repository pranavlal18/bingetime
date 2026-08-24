// ─── Artist Page — matches screenshot: plain bio, 5-up Known For, no count pill ───

import { useMemo, useState } from 'react'
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native'
import { useLocalSearchParams, router, Stack } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { usePerson, topKnownFor } from '@/lib/queries/people'
import { getImageUrl } from '@/lib/tmdb'
import type { TMDbCombinedCredit } from '@/lib/tmdb'
import CreditCard from '@/components/detail/CreditCard'
import { typography, spacing, borderRadius } from '@/theme'
import { useTheme } from '@/contexts/ThemeContext'

const PORTRAIT_W = 112
const PORTRAIT_H = 168
const KNOWN_FOR_W = 68
const KNOWN_FOR_GAP = 10

function formatBorn(dateStr: string | null): string | null {
  if (!dateStr) return null
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return null
    // "28 Oct 1982" — en-GB matches screenshot
    return `Born: ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
  } catch {
    return null
  }
}

export default function PersonDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const insets = useSafeAreaInsets()
  const { colors } = useTheme()
  const [bioExpanded, setBioExpanded] = useState(false)

  const personId = useMemo(() => {
    const raw = String(id ?? '')
    return /^\d+$/.test(raw) ? parseInt(raw, 10) : null
  }, [id])

  const { data: person, isLoading, error } = usePerson(personId)
  const knownFor = useMemo(() => topKnownFor(person, 8), [person])

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.surface,
        },
        centered: {
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: spacing.marginMobile,
        },
        errorText: {
          fontFamily: 'Inter',
          fontSize: typography.bodyMd.fontSize,
          fontWeight: '500',
          color: colors.onSurfaceVariant,
          marginTop: 12,
          marginBottom: 16,
          textAlign: 'center',
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
          fontFamily: 'Inter',
          color: colors.primary,
          fontSize: typography.bodySm.fontSize,
          fontWeight: '600',
        },
        scroll: {
          flex: 1,
        },
        backButton: {
          position: 'absolute',
          top: insets.top + 8,
          left: spacing.marginMobile,
          width: 32,
          height: 32,
          borderRadius: borderRadius.full,
          backgroundColor: 'rgba(255,255,255,0.08)',
          borderWidth: 0.5,
          borderColor: 'rgba(255,255,255,0.12)',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 10,
        },
        headerRow: {
          flexDirection: 'row',
          gap: 14,
          paddingHorizontal: spacing.marginMobile,
          paddingTop: insets.top + 20,
          marginBottom: 20,
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
          fontWeight: '700',
          color: colors.onSurfaceVariant,
        },
        headerMeta: {
          flex: 1,
          justifyContent: 'center',
          gap: 6,
        },
        name: {
          fontFamily: 'Inter',
          fontSize: 22,
          fontWeight: '700',
          lineHeight: 26,
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
          fontSize: 11,
          fontWeight: '600',
          letterSpacing: 0.02,
          color: colors.onSurfaceVariant,
        },
        placeLine: {
          fontFamily: 'Inter',
          fontSize: 13,
          fontWeight: '400',
          lineHeight: 18,
          color: colors.onSurfaceVariant,
        },
        bornLine: {
          fontFamily: 'Inter',
          fontSize: 12,
          fontWeight: '400',
          lineHeight: 16,
          color: colors.onSurfaceVariant,
          opacity: 0.85,
        },
        bioSection: {
          paddingHorizontal: spacing.marginMobile,
          marginBottom: 20,
        },
        bioTitle: {
          fontFamily: 'Inter',
          fontSize: 16,
          fontWeight: '700',
          lineHeight: 20,
          color: colors.onSurface,
          marginBottom: 8,
        },
        bioText: {
          fontFamily: 'Inter',
          fontSize: 13,
          fontWeight: '400',
          lineHeight: 19,
          color: colors.onSurfaceVariant,
          opacity: 0.9,
        },
        bioToggle: {
          alignSelf: 'flex-start',
          marginTop: 8,
        },
        bioToggleText: {
          fontFamily: 'Inter',
          fontSize: 13,
          fontWeight: '600',
          color: colors.primary,
        },
        knownForSection: {
          marginBottom: spacing.stackLg,
        },
        knownForHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: spacing.marginMobile,
          marginBottom: 10,
        },
        sectionTitle: {
          fontFamily: 'Inter',
          fontSize: 16,
          fontWeight: '700',
          lineHeight: 20,
          color: colors.onSurface,
        },
        seeAllText: {
          fontFamily: 'Inter',
          fontSize: 13,
          fontWeight: '600',
          color: colors.primary,
        },
        scroller: {
          marginHorizontal: -spacing.marginMobile,
        },
        knownForRow: {
          gap: KNOWN_FOR_GAP,
          paddingHorizontal: spacing.marginMobile,
        },
        emptyKnownFor: {
          fontFamily: 'Inter',
          fontSize: typography.bodySm.fontSize,
          color: colors.onSurfaceVariant,
          paddingHorizontal: spacing.marginMobile,
        },
      }),
    [colors, insets.top]
  )

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  if (error || (!person && !isLoading)) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <Ionicons name="alert-circle-outline" size={48} color={colors.onSurfaceVariant} />
        <Text style={styles.errorText}>Could not load person details</Text>
        <Pressable onPress={() => router.back()} style={styles.goBackButton}>
          <Text style={styles.goBackText}>Go back</Text>
        </Pressable>
      </View>
    )
  }

  if (!person) return null

  const biography = person.biography?.trim() ?? ''
  const portraitUrl = getImageUrl(person.profile_path ?? null, 'w185')

  // Place of birth only — dates live solely in bornLine (no duplicate years)
  const placeLine = person.place_of_birth?.trim() || null
  const bornLine = formatBorn(person.birthday)
  const showBioToggle = biography.length > 180

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={20} color="#fff" />
        </Pressable>

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
            {placeLine ? <Text style={styles.placeLine}>{placeLine}</Text> : null}
            {bornLine ? <Text style={styles.bornLine}>{bornLine}</Text> : null}
          </View>
        </View>

        {biography.length > 0 ? (
          <View style={styles.bioSection}>
            <Text style={styles.bioTitle}>Biography</Text>
            <Text style={styles.bioText} numberOfLines={bioExpanded ? undefined : 4}>
              {biography}
            </Text>
            {showBioToggle ? (
              <Pressable onPress={() => setBioExpanded((v) => !v)} style={styles.bioToggle}>
                <Text style={styles.bioToggleText}>{bioExpanded ? 'Show less' : 'Read more'}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <View style={styles.knownForSection}>
          <View style={styles.knownForHeader}>
            <Text style={styles.sectionTitle}>Known For</Text>
            {knownFor.length > 0 ? (
              <Pressable onPress={() => router.push(`/person/${person.id}/credits`)} hitSlop={8}>
                <Text style={styles.seeAllText}>See All</Text>
              </Pressable>
            ) : null}
          </View>

          {knownFor.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroller} contentContainerStyle={styles.knownForRow}>
              {knownFor.map((credit: TMDbCombinedCredit) => {
                const title = (credit.title ?? credit.name ?? '').trim() || 'Untitled'
                return (
                  <CreditCard
                    key={`${credit.media_type}-${credit.id}`}
                    posterPath={credit.poster_path ?? null}
                    title={title}
                    width={KNOWN_FOR_W}
                    onPress={() => router.push(credit.media_type === 'tv' ? `/show/${credit.id}` : `/movie/${credit.id}`)}
                  />
                )
              })}
            </ScrollView>
          ) : (
            <Text style={styles.emptyKnownFor}>No scripted credits available.</Text>
          )}
        </View>
      </ScrollView>
    </View>
  )
}
