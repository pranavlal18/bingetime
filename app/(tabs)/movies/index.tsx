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
import { useMovies, useToggleMovieWatched, useRefreshMovieReleaseDates } from '@/lib/queries/movies'
import { useAppStore } from '@/stores/appStore'
import { useTheme } from '@/contexts/ThemeContext'
import { getImageUrl } from '@/lib/tmdb'
import AnimatedPoster from '@/components/ui/AnimatedPoster'
import MovieListItem from '@/components/movies/MovieListItem'
import { typography, borderRadius, spacing } from '@/theme'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import type { MovieWithUserData } from '@/lib/queries/movies'

// ── Card sizing (matches ShowCard) ──
const SCREEN_WIDTH = Dimensions.get('window').width
const CARD_WIDTH = (SCREEN_WIDTH - 40 - 16) / 2 // 40 outer margins, 16 gap = 2 cols
const PAGE_PADDING = 20

// ── Screen Content ──

function MoviesScreenContent() {
  const insets = useSafeAreaInsets()
  const [activeSegment, setActiveSegment] = useState<'watchlist' | 'upcoming'>('watchlist')
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearchVisible, setIsSearchVisible] = useState(false)
  const viewMode = useAppStore((s) => s.moviesViewMode)
  const setViewMode = useAppStore((s) => s.setMoviesViewMode)
  const { colors } = useTheme()

  const { data: movies, isLoading, isRefetching, refetch } = useMovies()
  const toggleWatched = useToggleMovieWatched()
  const refreshReleaseDates = useRefreshMovieReleaseDates()

  const isGrid = viewMode === 'poster-grid'

  const toggleViewMode = useCallback(() => {
    setViewMode(isGrid ? 'thumbnail-list' : 'poster-grid')
  }, [isGrid, setViewMode])

  const handleToggleWatched = useCallback((movieId: string) => {
    toggleWatched.mutate(movieId)
  }, [toggleWatched])

  // ── Inner sub-components (theme-aware) ──

  const SegmentedControl = useCallback(function SegmentedControl({
    active,
    onChange,
  }: {
    active: 'watchlist' | 'upcoming'
    onChange: (key: 'watchlist' | 'upcoming') => void
  }) {
    return (
      <View style={{ paddingHorizontal: PAGE_PADDING, marginBottom: 20 }}>
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: colors.surfaceContainerLow,
            borderRadius: 100,
            padding: 4,
          }}
        >
          <Pressable
            style={{
              flex: 1,
              height: 44,
              justifyContent: 'center',
              alignItems: 'center',
              borderRadius: 100,
              backgroundColor: active === 'watchlist' ? colors.primary : 'transparent',
              shadowColor: active === 'watchlist' ? colors.primary : 'transparent',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: active === 'watchlist' ? 0.3 : 0,
              shadowRadius: 8,
              elevation: active === 'watchlist' ? 6 : 0,
            }}
            onPress={() => onChange('watchlist')}
            accessibilityRole="radio"
            accessibilityState={{ selected: active === 'watchlist' }}
          >
            <Text
              style={{
                fontFamily: 'Inter',
                fontSize: 14,
                fontWeight: '600',
                color: active === 'watchlist' ? colors.onPrimary : colors.onSurfaceVariant,
              }}
            >
              Watchlist
            </Text>
          </Pressable>
          <Pressable
            style={{
              flex: 1,
              height: 44,
              justifyContent: 'center',
              alignItems: 'center',
              borderRadius: 100,
              backgroundColor: active === 'upcoming' ? colors.primary : 'transparent',
              shadowColor: active === 'upcoming' ? colors.primary : 'transparent',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: active === 'upcoming' ? 0.3 : 0,
              shadowRadius: 8,
              elevation: active === 'upcoming' ? 6 : 0,
            }}
            onPress={() => onChange('upcoming')}
            accessibilityRole="radio"
            accessibilityState={{ selected: active === 'upcoming' }}
          >
            <Text
              style={{
                fontFamily: 'Inter',
                fontSize: 14,
                fontWeight: '600',
                color: active === 'upcoming' ? colors.onPrimary : colors.onSurfaceVariant,
              }}
            >
              Upcoming
            </Text>
          </Pressable>
        </View>
      </View>
    )
  }, [colors])

  const MovieCardGrid = useCallback(function MovieCardGrid({ movie }: { movie: MovieWithUserData }) {
    const posterUrl = getImageUrl(movie.poster_path, 'w342')
    const year = movie.release_date?.slice(0, 4)
    const genre = movie.genres?.[0] ?? null
    const metaText = year && genre ? `${year} • ${genre}` : year ?? genre ?? ''

    return (
      <View style={{ width: CARD_WIDTH, marginBottom: 16 }}>
        <Pressable
          style={({ pressed }) => [
            { width: CARD_WIDTH },
            pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
          ]}
          onPress={() => router.push(`/movie/${movie.id}`)}
          accessibilityRole="button"
          accessibilityLabel={`${movie.title}, ${year || 'unknown year'}`}
        >
          {/* Poster — same size as ShowCard */}
          <View
            style={{
              width: CARD_WIDTH,
              height: CARD_WIDTH * 1.5,
              borderRadius: 16,
              overflow: 'hidden',
              backgroundColor: colors.surfaceDim,
              position: 'relative',
              borderWidth: 1,
              borderColor: colors.outlineVariant,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.4,
              shadowRadius: 12,
              elevation: 8,
            }}
          >
            <AnimatedPoster
              uri={posterUrl}
              style={StyleSheet.absoluteFill}
            />
          </View>

          {/* Title */}
          <Text
            style={{
              fontSize: typography.bodyXs.fontSize,
              color: colors.onSurface,
              fontWeight: '600',
              marginTop: 8,
              lineHeight: 18,
            }}
            numberOfLines={2}
          >
            {movie.title}
          </Text>

          {/* Year • Genre */}
          {metaText ? (
            <Text
              style={{
                fontSize: typography.bodyXs.fontSize,
                color: colors.onSurfaceVariant,
                marginTop: spacing.unit,
                opacity: 0.7,
              }}
              numberOfLines={1}
            >
              {metaText}
            </Text>
          ) : null}
        </Pressable>
      </View>
    )
  }, [colors])

  const renderItem = useCallback(
    ({ item }: { item: MovieWithUserData }) => {
      if (isGrid) {
        return <MovieCardGrid movie={item} />
      }
      return <MovieListItem movie={item} onMarkWatched={handleToggleWatched} />
    },
    [isGrid, handleToggleWatched, MovieCardGrid]
  )

  const keyExtractor = useCallback((item: MovieWithUserData) => item.id, [])

  // Filter movies based on segment + search query
  const filteredMovies = useMemo(() => {
    try {
      if (!movies) return []

      // Only unwatched movies in this tab (watched → Profile → All Movies)
      const unwatched = movies.filter((m) => !m.watched && m.is_watchlist)

      const today = new Date().toISOString().slice(0, 10) // "2026-07-13"

      const segmentFiltered = activeSegment === 'watchlist'
        ? unwatched.filter((m) => !m.release_date || String(m.release_date).slice(0, 10) <= today)
        : unwatched.filter((m) => m.release_date && String(m.release_date).slice(0, 10) > today)

      if (!searchQuery.trim()) return segmentFiltered

      const q = searchQuery.trim().toLowerCase()
      return segmentFiltered.filter((m) => m.title.toLowerCase().includes(q))
    } catch (e) {
      console.error('🔥 [MoviesTab] filter error:', e)
      return []
    }
  }, [movies, activeSegment, searchQuery])

  // ── Styles ──

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

        // ── Section ──
        listHeader: {
          paddingTop: 4,
        },

        // ── List ──
        listContent: {
          paddingHorizontal: spacing.marginMobile,
          paddingBottom: 32,
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
      }),
    [colors]
  )

  // Empty state
  const emptyState = useMemo(() => {
    if (isLoading) return null
    return (
      <View style={styles.emptyState}>
        <View style={styles.emptyIconContainer}>
          <Ionicons name="film-outline" size={56} color={colors.outlineVariant} />
        </View>
        <Text style={styles.emptyTitle}>
          {activeSegment === 'watchlist' ? 'Nothing to watch' : 'No upcoming movies'}
        </Text>
        <Text style={styles.emptySubtitle}>
          {activeSegment === 'watchlist'
            ? 'Add movies from Discover to your watchlist'
            : 'Movies you add that aren\'t released yet will appear here'}
        </Text>
      </View>
    )
  }, [isLoading, activeSegment, colors, styles])

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
        <Text style={styles.appBarTitle}>Movies</Text>
        <View style={styles.appBarRight}>
          {/* View mode toggle — matches Shows tab */}
          <Pressable onPress={toggleViewMode} style={styles.appBarBtn}>
            <Ionicons
              name={isGrid ? 'grid-outline' : 'list-outline'}
              size={20}
              color={colors.onSurfaceVariant}
            />
          </Pressable>
          {/* Refresh release dates — sync from TMDb */}
          <Pressable
            style={[styles.appBarBtn, refreshReleaseDates.isPending && styles.appBarBtnActive]}
            onPress={() => refreshReleaseDates.mutate()}
            disabled={refreshReleaseDates.isPending}
            hitSlop={8}
          >
            <Ionicons
              name="sync-outline"
              size={20}
              color={refreshReleaseDates.isPending ? colors.primary : colors.onSurfaceVariant}
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
            placeholder={`Search ${activeSegment === 'watchlist' ? 'watchlist' : 'upcoming'}...`}
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
        contentContainerStyle={[
          styles.listContent,
        ]}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <SegmentedControl
              active={activeSegment}
              onChange={setActiveSegment}
            />
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

export default function MoviesScreen() {
  return (
    <ErrorBoundary>
      <MoviesScreenContent />
    </ErrorBoundary>
  )
}
