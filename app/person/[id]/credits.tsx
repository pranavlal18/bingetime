// ─── All Credits — dense 5-col grid (matches desired screenshot) ───

import { useCallback, useMemo, useState } from 'react'
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native'
import { FlashList } from '@shopify/flash-list'
import { useLocalSearchParams, router, Stack } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { usePerson, dedupeCredits, isScriptedCredit } from '@/lib/queries/people'
import type { TMDbCombinedCredit } from '@/lib/tmdb'
import CreditCard from '@/components/detail/CreditCard'
import { typography, spacing, borderRadius } from '@/theme'
import { useTheme } from '@/contexts/ThemeContext'

type MediaFilter = 'all' | 'movie' | 'tv'
type SortKey = 'newest' | 'oldest' | 'popular' | 'az'

const FILTERS: { key: MediaFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'movie', label: 'Movies' },
  { key: 'tv', label: 'TV' },
]

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'newest', label: 'Newest' },
  { key: 'oldest', label: 'Oldest' },
  { key: 'popular', label: 'Popular' },
  { key: 'az', label: 'A–Z' },
]

const NUM_COLS = 5
const COL_GAP = 10
const ROW_GAP = 12
// FlashList v2 grid: half-gutter padding per item creates the center gap;
// container padding shrinks by half a gutter so outer edges stay at 20dp.
const CONTENT_PAD = spacing.marginMobile - COL_GAP / 2

function getYear(c: TMDbCombinedCredit): string {
  return (c.release_date ?? c.first_air_date ?? '').slice(0, 4)
}

export default function PersonCreditsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const insets = useSafeAreaInsets()
  const { colors } = useTheme()
  const [containerW, setContainerW] = useState(0)

  const cellWidth = useMemo(() => {
    const w = containerW
    if (!w || w < 100) return 64 // Expo Go Android: useWindowDimensions 0 on first frame
    // Cells are (containerW - 2*CONTENT_PAD)/NUM_COLS wide; the per-item
    // half-gutter padding leaves this inner width for the card.
    return (w - CONTENT_PAD * 2) / NUM_COLS - COL_GAP
  }, [containerW])

  const [filter, setFilter] = useState<MediaFilter>('all')
  const [sort, setSort] = useState<SortKey>('newest')

  const personId = useMemo(() => {
    const raw = String(id ?? '')
    return /^\d+$/.test(raw) ? parseInt(raw, 10) : null
  }, [id])
  const isValidId = personId != null

  const { data: person, isLoading } = usePerson(isValidId ? personId : undefined)

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
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          height: 44,
          paddingHorizontal: spacing.marginMobile,
          marginBottom: 4,
        },
        headerBackButton: {
          position: 'absolute',
          left: spacing.marginMobile,
          width: 32,
          height: 32,
          borderRadius: borderRadius.full,
          backgroundColor: 'rgba(255,255,255,0.08)',
          borderWidth: 0.5,
          borderColor: 'rgba(255,255,255,0.12)',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1,
        },
        headerTitle: {
          fontFamily: 'Inter',
          fontSize: 16,
          fontWeight: '700',
          lineHeight: 20,
          color: colors.onSurface,
          textAlign: 'center',
          flex: 1,
          paddingHorizontal: 48,
        },
        track: {
          flexDirection: 'row',
          marginHorizontal: spacing.marginMobile,
          marginBottom: 10,
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
          fontSize: 13,
          fontWeight: '600',
          color: colors.onSurfaceVariant,
        },
        segmentTextActive: {
          color: colors.onPrimary,
        },
        sortRow: {
          flexDirection: 'row',
          gap: 8,
          marginHorizontal: spacing.marginMobile,
          marginBottom: 14,
          flexWrap: 'wrap',
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
          fontSize: 12,
          fontWeight: '600',
          color: colors.onSurfaceVariant,
        },
        sortChipTextActive: {
          color: colors.onPrimary,
        },
        list: {
          flex: 1,
        },
        listContent: {
          paddingHorizontal: CONTENT_PAD,
          paddingBottom: 40,
        },
        emptyText: {
          fontFamily: 'Inter',
          fontSize: typography.bodyMd.fontSize,
          color: colors.onSurfaceVariant,
          textAlign: 'center',
          paddingTop: 48,
        },
        emptySub: {
          fontFamily: 'Inter',
          fontSize: typography.bodySm.fontSize,
          color: colors.onSurfaceVariant,
          opacity: 0.7,
          textAlign: 'center',
          marginTop: 8,
          paddingHorizontal: 24,
        },
      }),
    [colors]
  )

  const credits = useMemo(() => {
    const all = dedupeCredits(person).filter(isScriptedCredit)
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

  const handleBack = useCallback(() => router.back(), [])

  const renderItem = useCallback(
    ({ item }: { item: TMDbCombinedCredit }) => {
      const title = (item.title ?? item.name ?? 'Untitled').trim()
      const year = getYear(item)
      const role = item.character?.trim() || item.job?.trim() || ''
      return (
        // Half-gutter padding on every cell = COL_GAP center gutter (v2 grid);
        // bottom padding preserves the FlatList columnWrapper row gap.
        <View style={{ flex: 1, paddingHorizontal: COL_GAP / 2, paddingBottom: ROW_GAP }}>
          <CreditCard
            posterPath={item.poster_path ?? null}
            title={title}
            year={year || null}
            roleLabel={role}
            width={cellWidth}
            compact
            onPress={() => router.push(item.media_type === 'tv' ? `/show/${item.id}` : `/movie/${item.id}`)}
          />
        </View>
      )
    },
    [cellWidth]
  )

  if (!isValidId) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <Ionicons name="alert-circle-outline" size={48} color={colors.onSurfaceVariant} />
        <Text style={styles.errorText}>Invalid person</Text>
        <Pressable onPress={handleBack} style={styles.goBackButton}>
          <Text style={styles.goBackText}>Go back</Text>
        </Pressable>
      </View>
    )
  }

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

      <View style={styles.header}>
        <Pressable onPress={handleBack} style={styles.headerBackButton} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={20} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          All Credits
        </Text>
      </View>

      <View style={styles.track}>
        {FILTERS.map((f) => {
          const active = f.key === filter
          return (
            <Pressable
              key={f.key}
              style={[styles.segment, active && styles.segmentActive]}
              onPress={() => {
                if (!active) {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  setFilter(f.key)
                }
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{f.label}</Text>
            </Pressable>
          )
        })}
      </View>

      <View style={styles.sortRow}>
        {SORTS.map((s) => {
          const active = s.key === sort
          return (
            <Pressable
              key={s.key}
              style={[styles.sortChip, active && styles.sortChipActive]}
              onPress={() => {
                if (!active) {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  setSort(s.key)
                }
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.sortChipText, active && styles.sortChipTextActive]}>{s.label}</Text>
            </Pressable>
          )
        })}
      </View>

      <View style={{ flex: 1 }} onLayout={(e) => setContainerW(e.nativeEvent.layout.width)}>
        <FlashList
          key={`credits-${NUM_COLS}-${Math.round(cellWidth)}`}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          numColumns={NUM_COLS}
        data={credits}
        keyExtractor={(c) => `${c.media_type}-${c.id}`}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View>
            <Text style={styles.emptyText}>No scripted credits</Text>
            <Text style={styles.emptySub}>Reality, talk and news appearances are hidden.</Text>
          </View>
        }
        />
      </View>
    </View>
  )
}
