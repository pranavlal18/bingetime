// ─── All Credits — dense 5-col grid (matches desired screenshot) ───

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native'
import { FlashList } from '@shopify/flash-list'
import { useLocalSearchParams, router, Stack } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { usePerson, dedupeCredits, isScriptedCredit } from '@/lib/queries/people'
import { fetchLibraryStatus } from '@/lib/queries/libraryStatus'
import { useAddToLibrary, useRemoveFromLibrary } from '@/lib/queries/discover'
import type { TMDbCombinedCredit } from '@/lib/tmdb'
import CreditCard from '@/components/detail/CreditCard'
import LibraryBadge from '@/components/ui/LibraryBadge'
import BrowseSortSheet from '@/components/discover/BrowseSortSheet'
import ErrorState from '@/components/ui/ErrorState'
import { typography, spacing, borderRadius } from '@/theme'
import { useTheme } from '@/contexts/ThemeContext'
import { useAuth } from '@/contexts/AuthContext'
import { Alert } from 'react-native'

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

// Sheet-shaped view of SORTS for the shared bottom-sheet component
const SORT_SHEET_OPTIONS = SORTS.map(({ key, label }) => ({ value: key, label }))

const NUM_COLS = 3
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
  const [sheetVisible, setSheetVisible] = useState(false)
  const sortLabel = useMemo(() => SORTS.find((s) => s.key === sort)?.label ?? 'Newest', [sort])

  const personId = useMemo(() => {
    const raw = String(id ?? '')
    return /^\d+$/.test(raw) ? parseInt(raw, 10) : null
  }, [id])
  const isValidId = personId != null

  const { data: person, isLoading, error, refetch } = usePerson(isValidId ? personId : undefined)

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
        list: {
          flex: 1,
        },
        listContent: {
          paddingHorizontal: CONTENT_PAD,
          // Clears the floating bottom sort bar
          paddingBottom: 96,
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

  // ── Watchlist state (same batched-enrichment pattern as CollectionBrowser) ──
  const { user } = useAuth()
  const addMutation = useAddToLibrary()
  const removeMutation = useRemoveFromLibrary()
  const addingIds = useRef(new Set<number>())
  const removingIds = useRef(new Set<number>())
  const [, forceRender] = useState(0)
  const localLibraryRef = useRef<Map<string, 'added' | 'removed'>>(new Map())
  // Composite key `${mediaType}:${id}` — tv 123 and movie 123 are different titles
  const statusMapRef = useRef<Map<string, 'in' | 'out'>>(new Map())

  useEffect(() => {
    if (!user || credits.length === 0) return
    let cancelled = false
    fetchLibraryStatus(
      credits.map((c) => ({ tmdbId: c.id, mediaType: c.media_type })),
      user.id
    )
      .then((map) => {
        if (cancelled) return
        for (const c of credits) {
          statusMapRef.current.set(`${c.media_type}:${c.id}`, map.has(c.id) ? 'in' : 'out')
        }
        forceRender((n) => n + 1)
      })
      .catch(() => {
        // Silent — badges stay '+' and remain functional via local toggles
      })
    return () => {
      cancelled = true
    }
  }, [credits, user])

  const isInLibrary = useCallback((credit: TMDbCombinedCredit) => {
    const key = `${credit.media_type}:${credit.id}`
    const localStatus = localLibraryRef.current.get(key)
    if (localStatus === 'added') return true
    if (localStatus === 'removed') return false
    return statusMapRef.current.get(key) === 'in'
  }, [])

  const handleToggleLibrary = useCallback(
    (item: TMDbCombinedCredit) => {
      const wasIn = isInLibrary(item)
      const key = `${item.media_type}:${item.id}`
      localLibraryRef.current.set(key, wasIn ? 'removed' : 'added')
      const pending = wasIn ? removingIds.current : addingIds.current
      pending.add(item.id)
      forceRender((n) => n + 1)

      const discoverItem = {
        tmdbId: item.id,
        mediaType: item.media_type,
        title: (item.title ?? item.name ?? 'Untitled').trim(),
        poster_path: item.poster_path ?? null,
        year: getYear(item) || null,
        releaseDate: null,
        overview: null,
        inLibrary: wasIn,
      }
      const mutation = wasIn ? removeMutation : addMutation
      mutation.mutate(discoverItem as any, {
        onError: (err: Error) => {
          Alert.alert(wasIn ? 'Failed to remove' : 'Failed to add', err.message)
          localLibraryRef.current.delete(key)
        },
        onSettled: () => {
          pending.delete(item.id)
          forceRender((n) => n + 1)
        },
      })
    },
    [isInLibrary, addMutation, removeMutation]
  )

  const handleBack = useCallback(() => router.back(), [])

  const renderItem = useCallback(
    ({ item }: { item: TMDbCombinedCredit }) => {
      const title = (item.title ?? item.name ?? 'Untitled').trim()
      const year = getYear(item)
      const role = item.character?.trim() || item.job?.trim() || ''
      const inLib = isInLibrary(item)
      const pending = addingIds.current.has(item.id) || removingIds.current.has(item.id)
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
            badge={
              <LibraryBadge
                size={20}
                isInLibrary={inLib}
                isPending={pending}
                onToggle={() => handleToggleLibrary(item)}
              />
            }
            onPress={() => router.push(item.media_type === 'tv' ? `/show/${item.id}` : `/movie/${item.id}`)}
          />
        </View>
      )
    },
    [cellWidth, isInLibrary, handleToggleLibrary]
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

  if (error || (!person && !isLoading)) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ErrorState
          title="Could not load credits"
          onRetry={refetch}
          onGoBack={handleBack}
        />
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

      {/* Sticky bottom bar — sort control, same pattern as browse pages */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: spacing.marginMobile,
          paddingVertical: 12,
          paddingBottom: 12 + insets.bottom,
          backgroundColor: colors.surfaceContainerHigh,
          borderTopWidth: 1,
          borderTopColor: colors.outlineVariant,
          zIndex: 10,
          elevation: 8,
        }}
      >
        <Pressable
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            backgroundColor: colors.surfaceContainerHigh,
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: borderRadius.full,
            borderWidth: 1,
            borderColor: colors.outlineVariant,
          }}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            setSheetVisible(true)
          }}
          accessibilityRole="button"
          accessibilityLabel={`Sort by ${sortLabel}`}
        >
          <Ionicons name="swap-vertical" size={16} color={colors.onSurface} />
          <Text style={{ fontFamily: 'Inter', fontSize: 13, fontWeight: '600', color: colors.onSurface }}>
            {sortLabel}
          </Text>
          <Ionicons name="chevron-down" size={14} color={colors.onSurfaceVariant} />
        </Pressable>
        <Text style={{ fontFamily: 'Inter', fontSize: 12, color: colors.onSurfaceVariant }}>
          {credits.length} titles
        </Text>
      </View>

      <BrowseSortSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        value={sort}
        onChange={setSort}
        options={SORT_SHEET_OPTIONS}
      />
    </View>
  )
}
