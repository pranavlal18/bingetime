// ─── Full Person Credits — all movie/TV credits with media filter ───

import { useCallback, useMemo, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  FlatList,
  ActivityIndicator,
} from 'react-native'
import { useLocalSearchParams, router, Stack } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { usePerson, dedupeCredits } from '@/lib/queries/people'
import type { TMDbCombinedCredit } from '@/lib/tmdb'
import CreditCard from '@/components/detail/CreditCard'
import { typography, spacing, borderRadius } from '@/theme'
import { useTheme } from '@/contexts/ThemeContext'

type CreditFilter = 'all' | 'movie' | 'tv'
type CreditSort = 'newest' | 'oldest' | 'popular' | 'az'

const FILTER_SEGMENTS: { key: CreditFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'movie', label: 'Movies' },
  { key: 'tv', label: 'TV' },
]

const SORT_OPTIONS: { key: CreditSort; label: string }[] = [
  { key: 'newest', label: 'Newest' },
  { key: 'oldest', label: 'Oldest' },
  { key: 'popular', label: 'Popular' },
  { key: 'az', label: 'A–Z' },
]

function creditYear(credit: TMDbCombinedCredit): string {
  const date = credit.release_date ?? credit.first_air_date ?? ''
  return date.slice(0, 4)
}

export default function PersonCreditsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const insets = useSafeAreaInsets()
  const { colors } = useTheme()

  const [filter, setFilter] = useState<CreditFilter>('all')
  const [sort, setSort] = useState<CreditSort>('newest')

  const personId = /^\d+$/.test(id) ? parseInt(id, 10) : null
  const isValidId = personId != null

  // Same cached query as the bio screen — no extra fetch.
  const { data: person, isLoading } = usePerson(isValidId ? personId : undefined)

  const styles = useMemo(
    () =>
      StyleSheet.create({
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

        // ── Header ──
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingHorizontal: spacing.marginMobile,
          paddingBottom: 12,
        },
        headerBackButton: {
          width: 36,
          height: 36,
          borderRadius: borderRadius.full,
          justifyContent: 'center',
          alignItems: 'center',
          marginLeft: -8,
        },
        headerTitle: {
          fontFamily: 'Inter',
          fontSize: typography.headlineSm.fontSize,
          fontWeight: '700',
          lineHeight: typography.headlineSm.lineHeight,
          color: colors.onSurface,
        },

        // ── Segmented filter (pill track) ──
        track: {
          flexDirection: 'row',
          marginHorizontal: spacing.marginMobile,
          marginBottom: spacing.stackSm,
          padding: 3,
          borderRadius: borderRadius.full,
          backgroundColor: colors.surfaceContainerHighest,
        },
        segment: {
          flex: 1,
          paddingVertical: 7,
          borderRadius: borderRadius.full,
          alignItems: 'center',
        },
        segmentActive: {
          backgroundColor: colors.primary,
        },
        segmentText: {
          fontFamily: 'Inter',
          fontSize: typography.labelMd.fontSize,
          fontWeight: '600',
          lineHeight: typography.labelMd.lineHeight,
          color: colors.onSurfaceVariant,
        },
        segmentTextActive: {
          color: colors.onPrimary,
        },

        // ── Sort chips ──
        sortRow: {
          flexDirection: 'row',
          gap: spacing.stackSm,
          marginHorizontal: spacing.marginMobile,
          marginBottom: spacing.stackMd,
        },
        sortChip: {
          paddingHorizontal: 14,
          paddingVertical: 6,
          borderRadius: borderRadius.full,
          backgroundColor: colors.surfaceContainerHighest,
          borderWidth: 1,
          borderColor: colors.outlineVariant,
        },
        sortChipActive: {
          backgroundColor: colors.primary,
          borderColor: colors.primary,
        },
        sortChipText: {
          fontFamily: 'Inter',
          fontSize: typography.labelSm.fontSize,
          fontWeight: '600',
          lineHeight: typography.labelSm.lineHeight,
          color: colors.onSurfaceVariant,
        },
        sortChipTextActive: {
          color: colors.onPrimary,
        },

        // ── Grid ──
        list: {
          flex: 1,
        },
        listContent: {
          paddingHorizontal: spacing.marginMobile,
          paddingBottom: 40,
        },
        columnWrapper: {
          justifyContent: 'space-between',
          gap: 10,
          marginBottom: spacing.stackMd,
        },
        emptyText: {
          fontSize: typography.bodyMd.fontSize,
          color: colors.onSurfaceVariant,
          textAlign: 'center',
          paddingTop: 48,
        },
      }),
    [colors],
  )

  const credits = useMemo(() => {
    const all = dedupeCredits(person)
    const filtered = filter === 'all' ? all : all.filter((c) => c.media_type === filter)
    const titleOf = (c: TMDbCombinedCredit) => (c.title ?? c.name ?? '').toLowerCase()
    return [...filtered].sort((a, b) => {
      const ya = a.release_date ?? a.first_air_date ?? ''
      const yb = b.release_date ?? b.first_air_date ?? ''
      switch (sort) {
        case 'oldest':
          return ya.localeCompare(yb) || titleOf(a).localeCompare(titleOf(b))
        case 'popular':
          return (b.popularity ?? 0) - (a.popularity ?? 0) || yb.localeCompare(ya)
        case 'az':
          return titleOf(a).localeCompare(titleOf(b))
        case 'newest':
        default:
          return yb.localeCompare(ya) || titleOf(a).localeCompare(titleOf(b))
      }
    })
  }, [person, filter, sort])

  const handleBack = useCallback(() => {
    router.back()
  }, [])

  const renderItem = useCallback(
    ({ item }: { item: TMDbCombinedCredit }) => {
      const title = item.title ?? item.name ?? 'Unknown'
      const year = creditYear(item)
      const roleLabel = item.character?.trim() || item.job?.trim() || ''
      return (
        <CreditCard
          posterPath={item.poster_path ?? null}
          title={title}
          year={year || null}
          roleLabel={roleLabel}
          compact
          onPress={() =>
            router.push(item.media_type === 'tv' ? `/show/${item.id}` : `/movie/${item.id}`)
          }
        />
      )
    },
    [styles],
  )

  // ── Invalid id ──
  if (!isValidId) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <Ionicons name="alert-circle-outline" size={48} color={colors.onSurfaceVariant} />
        <Text style={styles.errorText}>Could not load person credits</Text>
        <Pressable onPress={handleBack} style={styles.goBackButton}>
          <Text style={styles.goBackText}>Go back</Text>
        </Pressable>
      </View>
    )
  }

  // ── Loading ──
  if (isLoading || !person) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── Header bar ── */}
      <View style={styles.header}>
        <Pressable
          onPress={handleBack}
          style={styles.headerBackButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={24} color={colors.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>All Credits</Text>
      </View>

      {/* ── Segmented filter ── */}
      <View style={styles.track}>
        {FILTER_SEGMENTS.map((segment) => {
          const isActive = segment.key === filter
          return (
            <Pressable
              key={segment.key}
              style={[styles.segment, isActive && styles.segmentActive]}
              onPress={() => {
                if (!isActive) {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  setFilter(segment.key)
                }
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
            >
              <Text style={[styles.segmentText, isActive && styles.segmentTextActive]}>
                {segment.label}
              </Text>
            </Pressable>
          )
        })}
      </View>

      {/* ── Sort chips ── */}
      <View style={styles.sortRow}>
        {SORT_OPTIONS.map((option) => {
          const isActive = option.key === sort
          return (
            <Pressable
              key={option.key}
              style={[styles.sortChip, isActive && styles.sortChipActive]}
              onPress={() => {
                if (!isActive) {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  setSort(option.key)
                }
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
            >
              <Text style={[styles.sortChipText, isActive && styles.sortChipTextActive]}>
                {option.label}
              </Text>
            </Pressable>
          )
        })}
      </View>

      {/* ── Credits grid ── */}
      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        columnWrapperStyle={styles.columnWrapper}
        numColumns={5}
        data={credits}
        keyExtractor={(c) => `${c.media_type}-${c.id}`}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        initialNumToRender={20}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No credits found</Text>
        }
      />
    </View>
  )
}
