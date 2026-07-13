// ─── All Movies — full library from Profile with filter chips ───

import { memo, useCallback, useMemo, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
} from 'react-native'
import { FlashList } from '@shopify/flash-list'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router, Stack } from 'expo-router'
import { useMovies, useToggleMovieWatched } from '@/lib/queries/movies'
import { useAppStore } from '@/stores/appStore'
import { colors, typography, spacing, borderRadius } from '@/theme'
import MovieCard from '@/components/movies/MovieCard'
import MovieListItem from '@/components/movies/MovieListItem'
import type { MovieWithUserData } from '@/lib/queries/movies'

// ── Filter type ──

type MovieFilter = 'all' | 'watched' | 'not-watched'

interface FilterChip {
  key: MovieFilter
  label: string
  color: string
}

const FILTER_CHIPS: FilterChip[] = [
  { key: 'all', label: 'All', color: colors.primary },
  { key: 'watched', label: 'Watched', color: colors.statusFinished },
  { key: 'not-watched', label: 'Not watched', color: colors.onSurfaceVariant },
]

// ── Filter Chip Component ──

interface FilterChipProps {
  chip: FilterChip
  isActive: boolean
  count: number
  onPress: () => void
}

const FilterChip = memo(function FilterChip({
  chip,
  isActive,
  count,
  onPress,
}: FilterChipProps) {
  return (
    <Pressable
      style={[
        styles.chip,
        isActive && { backgroundColor: chip.color, borderColor: chip.color },
      ]}
      onPress={onPress}
    >
      <Text
        style={[
          styles.chipLabel,
          isActive
            ? { color: colors.onPrimary }
            : { color: chip.color },
        ]}
      >
        {chip.label}
      </Text>
      <View
        style={[
          styles.chipCount,
          isActive && { backgroundColor: 'rgba(0,0,0,0.2)' },
        ]}
      >
        <Text
          style={[
            styles.chipCountText,
            isActive
              ? { color: colors.onPrimary }
              : { color: chip.color },
          ]}
        >
          {count}
        </Text>
      </View>
    </Pressable>
  )
})

// ── Main Screen ──

export default function AllMoviesScreen() {
  const insets = useSafeAreaInsets()
  const viewMode = useAppStore((s) => s.moviesViewMode)
  const setViewMode = useAppStore((s) => s.setMoviesViewMode)

  const { data: movies, isLoading, isRefetching, refetch } = useMovies()
  const toggleWatched = useToggleMovieWatched()

  const [activeFilter, setActiveFilter] = useState<MovieFilter>('all')

  const isGrid = viewMode === 'poster-grid'

  // ── Derive counts per filter ──

  const filterCounts = useMemo(() => {
    const counts = new Map<MovieFilter, number>([
      ['all', 0],
      ['watched', 0],
      ['not-watched', 0],
    ])
    if (!movies) return counts
    for (const movie of movies) {
      counts.set('all', (counts.get('all') ?? 0) + 1)
      if (movie.watched) {
        counts.set('watched', (counts.get('watched') ?? 0) + 1)
      } else {
        counts.set('not-watched', (counts.get('not-watched') ?? 0) + 1)
      }
    }
    return counts
  }, [movies])

  // ── Filtered list ──

  const filteredMovies = useMemo(() => {
    if (!movies) return []
    if (activeFilter === 'all') return movies
    if (activeFilter === 'watched') return movies.filter((m) => m.watched)
    return movies.filter((m) => !m.watched)
  }, [movies, activeFilter])

  // ── Callbacks ──

  const toggleViewMode = useCallback(() => {
    setViewMode(isGrid ? 'thumbnail-list' : 'poster-grid')
  }, [isGrid, setViewMode])

  const handleToggleWatched = useCallback(
    (movieId: string) => {
      toggleWatched.mutate(movieId)
    },
    [toggleWatched]
  )

  const renderGridItem = useCallback(
    ({ item }: { item: MovieWithUserData }) => (
      <MovieCard movie={item} onMarkWatched={handleToggleWatched} />
    ),
    [handleToggleWatched]
  )

  const renderListItem = useCallback(
    ({ item }: { item: MovieWithUserData }) => (
      <MovieListItem movie={item} onMarkWatched={handleToggleWatched} />
    ),
    [handleToggleWatched]
  )

  const keyExtractor = useCallback((item: MovieWithUserData) => item.id, [])

  // ── Empty state ──

  const renderEmptyState = useCallback(() => {
    const label = FILTER_CHIPS.find((c) => c.key === activeFilter)?.label ?? ''
    return (
      <View style={styles.emptyState}>
        <Ionicons name="film-outline" size={48} color={colors.outline} />
        <Text style={styles.emptyTitle}>No {label.toLowerCase()} movies</Text>
        <Text style={styles.emptySubtitle}>
          {activeFilter === 'all'
            ? 'Your movie library is empty. Add movies from Discover.'
            : `No movies match the "${label}" filter.`}
        </Text>
      </View>
    )
  }, [activeFilter])

  // ── Loading ──

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading movies...</Text>
      </View>
    )
  }

  // ── Render ──

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── AppBar ── */}
      <View style={styles.appBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.appBarTitle}>All Movies</Text>
        <Pressable onPress={toggleViewMode} style={styles.gridToggle}>
          <Ionicons
            name={isGrid ? 'list-outline' : 'grid-outline'}
            size={20}
            color={colors.onSurfaceVariant}
          />
        </Pressable>
      </View>

      {/* ── Filter Chips ── */}
      <View style={styles.chipsContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsContent}
        >
          {FILTER_CHIPS.map((chip) => (
            <FilterChip
              key={chip.key}
              chip={chip}
              isActive={activeFilter === chip.key}
              count={filterCounts.get(chip.key) ?? 0}
              onPress={() => setActiveFilter(chip.key)}
            />
          ))}
        </ScrollView>
      </View>

      {/* ── Content ── */}
      <FlashList
        data={filteredMovies}
        keyExtractor={keyExtractor}
        renderItem={isGrid ? renderGridItem : renderListItem}
        numColumns={isGrid ? 2 : 1}
        key={isGrid ? 'grid' : 'list'}
        contentContainerStyle={[
          styles.listContent,
          filteredMovies.length === 0 && styles.listContentEmpty,
        ]}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  )
}

// ── Styles ──

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: typography.bodySm.fontSize,
    color: colors.outline,
    marginTop: spacing.stackSm,
  },

  // ── AppBar ──
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.marginMobile,
    height: 56,
    gap: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  appBarTitle: {
    flex: 1,
    fontFamily: 'Inter',
    fontSize: 22,
    fontWeight: '700',
    color: colors.onSurface,
    letterSpacing: -0.01,
  },
  gridToggle: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Filter Chips ──
  chipsContainer: {
    paddingVertical: spacing.stackSm,
  },
  chipsContent: {
    paddingHorizontal: spacing.marginMobile,
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    height: 34,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceContainerLow,
    gap: 6,
  },
  chipLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  chipCount: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  chipCountText: {
    fontSize: 11,
    fontWeight: '700',
  },

  // ── List ──
  listContent: {
    paddingHorizontal: spacing.marginMobile,
    paddingBottom: 32,
    paddingTop: spacing.stackSm,
  },
  listContentEmpty: {
    flex: 1,
    justifyContent: 'center',
  },

  // ── Empty State ──
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 48,
  },
  emptyTitle: {
    fontFamily: 'Inter',
    fontSize: 18,
    fontWeight: '700',
    color: colors.onSurface,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.outline,
    textAlign: 'center',
    lineHeight: 20,
  },
})
