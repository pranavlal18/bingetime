// ─── Movies Tab — Premium Streaming App Design ───
// Netflix / Letterboxd inspired, dark purple theme
// Matches Shows tab card sizing with grid/list toggle

import { useCallback, useMemo, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
} from 'react-native'
import { FlashList } from '@shopify/flash-list'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useMovies, useToggleMovieWatched } from '@/lib/queries/movies'
import { useAppStore } from '@/stores/appStore'
import { getImageUrl } from '@/lib/tmdb'
import AnimatedPoster from '@/components/ui/AnimatedPoster'
import MovieListItem from '@/components/movies/MovieListItem'
import { colors, typography, borderRadius, spacing } from '@/theme'
import type { MovieWithUserData } from '@/lib/queries/movies'

// ── Card sizing (matches ShowCard) ──
const SCREEN_WIDTH = Dimensions.get('window').width
const CARD_WIDTH = (SCREEN_WIDTH - 40 - 16) / 2 // 40 outer margins, 16 gap = 2 cols
const PAGE_PADDING = 20

// ── Segmented Control ──

type SegmentKey = 'watched' | 'watch-later'

function SegmentedControl({
  active,
  onChange,
}: {
  active: SegmentKey
  onChange: (key: SegmentKey) => void
}) {
  return (
    <View style={styles.segmentOuter}>
      <View style={styles.segmentTrack}>
        <Pressable
          style={[
            styles.segmentBtn,
            active === 'watched' && styles.segmentBtnActive,
          ]}
          onPress={() => onChange('watched')}
          accessibilityRole="radio"
          accessibilityState={{ selected: active === 'watched' }}
        >
          <Text
            style={[
              styles.segmentLabel,
              active === 'watched' && styles.segmentLabelActive,
            ]}
          >
            Watched
          </Text>
        </Pressable>
        <Pressable
          style={[
            styles.segmentBtn,
            active === 'watch-later' && styles.segmentBtnActive,
          ]}
          onPress={() => onChange('watch-later')}
          accessibilityRole="radio"
          accessibilityState={{ selected: active === 'watch-later' }}
        >
          <Text
            style={[
              styles.segmentLabel,
              active === 'watch-later' && styles.segmentLabelActive,
            ]}
          >
            Watch Later
          </Text>
        </Pressable>
      </View>
    </View>
  )
}

// ── Movie Card — Grid View (matches ShowCard sizing) ──

interface MovieCardGridProps {
  movie: MovieWithUserData
}

function MovieCardGrid({ movie }: MovieCardGridProps) {
  const posterUrl = getImageUrl(movie.poster_path, 'w342')
  const isWatched = movie.watched ?? false
  const year = movie.release_date?.slice(0, 4)
  const genre = movie.genres?.[0] ?? null
  const metaText = year && genre ? `${year} • ${genre}` : year ?? genre ?? ''

  const handlePress = useCallback(() => {
    router.push(`/movie/${movie.id}`)
  }, [movie.id])

  return (
    <View style={styles.gridCardWrapper}>
      <Pressable
        style={({ pressed }) => [
          styles.gridCard,
          pressed && styles.gridCardPressed,
        ]}
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={`${movie.title}, ${year || 'unknown year'}${isWatched ? ', watched' : ''}`}
      >
        {/* Poster — same size as ShowCard */}
        <View style={styles.posterContainer}>
          <AnimatedPoster
            uri={posterUrl}
            style={StyleSheet.absoluteFill}
          />

          {/* Watched accent bar at poster bottom */}
          {isWatched && <View style={styles.watchedBar} />}
        </View>

        {/* Title */}
        <Text style={styles.gridTitle} numberOfLines={2}>
          {movie.title}
        </Text>

        {/* Year • Genre */}
        {metaText ? (
          <Text style={styles.gridYear} numberOfLines={1}>{metaText}</Text>
        ) : null}
      </Pressable>
    </View>
  )
}

// ── Main Screen ──

export default function MoviesScreen() {
  const insets = useSafeAreaInsets()
  const [activeSegment, setActiveSegment] = useState<SegmentKey>('watch-later')
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearchVisible, setIsSearchVisible] = useState(false)
  const viewMode = useAppStore((s) => s.moviesViewMode)
  const setViewMode = useAppStore((s) => s.setMoviesViewMode)

  const { data: movies, isLoading, isRefetching, refetch } = useMovies()
  const toggleWatched = useToggleMovieWatched()

  const isGrid = viewMode === 'poster-grid'

  const toggleViewMode = useCallback(() => {
    setViewMode(isGrid ? 'thumbnail-list' : 'poster-grid')
  }, [isGrid, setViewMode])

  const handleToggleWatched = useCallback((movieId: string) => {
    toggleWatched.mutate(movieId)
  }, [toggleWatched])

  const renderItem = useCallback(
    ({ item }: { item: MovieWithUserData }) => {
      if (isGrid) {
        return <MovieCardGrid movie={item} />
      }
      return <MovieListItem movie={item} onMarkWatched={handleToggleWatched} />
    },
    [isGrid, handleToggleWatched]
  )

  const keyExtractor = useCallback((item: MovieWithUserData) => item.id, [])

  // Filter movies based on segment + search query
  const filteredMovies = useMemo(() => {
    if (!movies) return []
    const segmentFiltered = activeSegment === 'watched'
      ? movies.filter((m) => m.watched)
      : movies.filter((m) => !m.watched)

    if (!searchQuery.trim()) return segmentFiltered

    const q = searchQuery.trim().toLowerCase()
    return segmentFiltered.filter((m) => m.title.toLowerCase().includes(q))
  }, [movies, activeSegment, searchQuery])

  // Empty state
  const emptyState = useMemo(() => {
    if (isLoading) return null
    return (
      <View style={styles.emptyState}>
        <View style={styles.emptyIconContainer}>
          <Ionicons name="film-outline" size={56} color={colors.outlineVariant} />
        </View>
        <Text style={styles.emptyTitle}>
          {activeSegment === 'watched' ? 'No watched movies' : 'Watchlist is empty'}
        </Text>
        <Text style={styles.emptySubtitle}>
          {activeSegment === 'watched'
            ? 'Movies you mark as watched will appear here'
            : 'Add movies from Discover to your watchlist'}
        </Text>
      </View>
    )
  }, [isLoading, activeSegment])

  // Loading state
  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading your movies...</Text>
      </View>
    )
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ── AppBar ── */}
      <View style={styles.appBar}>
        <View style={styles.appBarLeft}>
          <Ionicons name="menu" size={22} color={colors.primary} />
          <Text style={styles.appBarTitle}>BingeTime</Text>
        </View>
        <View style={styles.appBarRight}>
          {/* View mode toggle — matches Shows tab */}
          <Pressable onPress={toggleViewMode} style={styles.appBarBtn}>
            <Ionicons
              name={isGrid ? 'grid-outline' : 'list-outline'}
              size={20}
              color={colors.onSurfaceVariant}
            />
          </Pressable>
          <Pressable
            style={[styles.appBarBtn, isSearchVisible && styles.appBarBtnActive]}
            onPress={() => {
              setIsSearchVisible((v) => !v)
              if (isSearchVisible) setSearchQuery('')
            }}
          >
            <Ionicons
              name={isSearchVisible ? 'close-outline' : 'search-outline'}
              size={20}
              color={isSearchVisible ? colors.primary : colors.onSurfaceVariant}
            />
          </Pressable>
        </View>
      </View>

      {/* ── Search Bar ── */}
      {isSearchVisible && (
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={colors.onSurfaceVariant} />
          <TextInput
            style={styles.searchInput}
            placeholder={`Search ${activeSegment === 'watched' ? 'watched' : 'watch later'}...`}
            placeholderTextColor={colors.outline}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.onSurfaceVariant} />
            </Pressable>
          )}
        </View>
      )}

      {/* ── Content ── */}
      <FlashList
        data={filteredMovies}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        numColumns={isGrid ? 2 : 1}
        key={isGrid ? 'grid' : 'list'}
        estimatedItemSize={isGrid ? 280 : 100}
        contentContainerStyle={[
          styles.listContent,
          filteredMovies.length === 0 && styles.listContentEmpty,
        ]}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <SegmentedControl
              active={activeSegment}
              onChange={setActiveSegment}
            />
            <Text style={styles.sectionTitle}>Movies</Text>
          </View>
        }
        ListEmptyComponent={emptyState}
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

  // ── AppBar (matches Shows tab) ──
  appBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: PAGE_PADDING,
    height: 64,
  },
  appBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  appBarTitle: {
    fontFamily: 'Inter',
    fontSize: 24,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: -0.02,
  },
  appBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  appBarBtn: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Search Bar ──
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: PAGE_PADDING,
    marginBottom: spacing.stackSm,
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.gutter,
    height: 44,
    gap: spacing.stackSm,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.bodyMd.fontSize,
    color: colors.onSurface,
    height: '100%',
  },
  appBarBtnActive: {
    backgroundColor: colors.surfaceContainerHigh,
  },

  // ── Segmented Control ──
  segmentOuter: {
    paddingHorizontal: PAGE_PADDING,
    marginBottom: 20,
  },
  segmentTrack: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: borderRadius.full,
    padding: 4,
  },
  segmentBtn: {
    flex: 1,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: borderRadius.full,
  },
  segmentBtnActive: {
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  segmentLabel: {
    fontFamily: 'Inter',
    fontSize: 14,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
  },
  segmentLabelActive: {
    color: colors.onPrimary,
    fontWeight: '700',
  },

  // ── Section ──
  listHeader: {
    paddingTop: 4,
  },
  sectionTitle: {
    fontFamily: 'Inter',
    fontSize: 22,
    fontWeight: '700',
    color: colors.onSurface,
    paddingHorizontal: PAGE_PADDING,
    marginBottom: 16,
    letterSpacing: -0.01,
  },

  // ── Grid Card (same sizing as ShowCard) ──
  gridCardWrapper: {
    width: CARD_WIDTH,
    marginBottom: 16,
  },
  gridCard: {
    width: CARD_WIDTH,
  },
  gridCardPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  posterContainer: {
    width: CARD_WIDTH,
    height: CARD_WIDTH * 1.5, // 2:3 aspect ratio
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.surfaceDim,
    position: 'relative',
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    // Premium shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  watchedBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: colors.primary,
  },
  gridTitle: {
    fontSize: typography.bodyXs.fontSize,
    color: colors.onSurface,
    fontWeight: '600',
    marginTop: 8,
    lineHeight: 18,
  },
  gridYear: {
    fontSize: typography.bodyXs.fontSize,
    color: colors.onSurfaceVariant,
    marginTop: spacing.unit,
    opacity: 0.7,
  },

  // ── List ──
  listContent: {
    paddingHorizontal: spacing.marginMobile,
    paddingBottom: 32,
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
  emptyIconContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.surfaceContainerHigh,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontFamily: 'Inter',
    fontSize: 18,
    fontWeight: '700',
    color: colors.onSurface,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontFamily: 'Inter',
    fontSize: 14,
    fontWeight: '400',
    color: colors.outline,
    textAlign: 'center',
    lineHeight: 20,
  },
})
