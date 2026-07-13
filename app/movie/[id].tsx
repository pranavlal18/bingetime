// ─── Movie Detail — Stitch-aligned ───

import { useCallback, useRef } from 'react'
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  Animated,
  Platform,
} from 'react-native'
import { useLocalSearchParams, router, Stack } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useMovie, useToggleMovieWatched } from '@/lib/queries/movies'
import { getMovieDetails, getImageUrl } from '@/lib/tmdb'
import { useQuery } from '@tanstack/react-query'
import LibraryToggle from '@/components/ui/LibraryToggle'
import { colors, typography, spacing, borderRadius } from '@/theme'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const BACKDROP_HEIGHT = 320

export default function MovieDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const insets = useSafeAreaInsets()
  const scrollY = useRef(new Animated.Value(0)).current

  // Detect if the id param is a TMDb ID (numeric) vs a UUID
  const isTmdbIdParam = /^\d+$/.test(id)

  const { data: movie, isLoading, error } = useMovie(id)
  const toggleWatchedMutation = useToggleMovieWatched()

  // Resolve TMDb ID — either from the DB record or directly from the param
  const resolvedTmdbId = movie?.tmdb_id ?? (isTmdbIdParam ? parseInt(id, 10) : null)

  const { data: tmdbDetails, isLoading: tmdbLoading } = useQuery({
    queryKey: ['tmdb', 'movie-details', resolvedTmdbId],
    queryFn: () => getMovieDetails(resolvedTmdbId!),
    enabled: !!resolvedTmdbId,
    staleTime: 1000 * 60 * 60,
  })

  const backdropUrl = tmdbDetails ? getImageUrl(tmdbDetails.backdrop_path ?? null, 'w780') : null
  const posterUrl = getImageUrl(movie?.poster_path ?? null, 'w342')
  const tmdbPosterUrl = tmdbDetails ? getImageUrl(tmdbDetails.poster_path ?? null, 'w342') : null
  const displayPoster = posterUrl || tmdbPosterUrl

  const year = movie?.release_date?.slice(0, 4) || tmdbDetails?.release_date?.slice(0, 4) || null
  const runtime = movie?.runtime || tmdbDetails?.runtime || null
  const runtimeDisplay = runtime ? `${Math.floor(runtime / 60)}h ${runtime % 60}m` : null
  const genreList = movie?.genres ?? (tmdbDetails?.genres ? tmdbDetails.genres.map((g: { id: number; name: string }) => g.name) : null)
  const overview = tmdbDetails?.overview || 'No overview available.'
  const isWatched = movie?.watched ?? false
  const displayTitle = movie?.title || tmdbDetails?.title || 'Unknown'

  const handleToggleWatched = useCallback(() => {
    if (movie) toggleWatchedMutation.mutate(movie.id)
  }, [movie, toggleWatchedMutation])

  const handleBack = useCallback(() => {
    router.back()
  }, [])

  // ── Loading ──
  const isFallbackLoading = !movie && !isLoading && isTmdbIdParam && tmdbLoading
  if (isLoading || isFallbackLoading) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  // ── Error ──
  // UUID param failed in DB, or TMDB fallback also failed
  const isRealDbError = error && !movie && !isTmdbIdParam
  const isFallbackError = !movie && !tmdbDetails && isTmdbIdParam && !tmdbLoading
  if (isRealDbError || isFallbackError) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.onSurfaceVariant} />
        <Text style={styles.errorText}>Could not load movie details</Text>
        <Pressable onPress={handleBack} style={styles.goBackButton}>
          <Text style={styles.goBackText}>Go back</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <Animated.ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
      >
        {/* ── Backdrop Hero — Stitch design ── */}
        <View style={styles.backdropContainer}>
          {backdropUrl ? (
            <Image
              source={{ uri: backdropUrl }}
              style={styles.backdrop}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          ) : displayPoster ? (
            <Image
              source={{ uri: displayPoster }}
              style={styles.backdrop}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          ) : (
            <View style={styles.backdropPlaceholder} />
          )}

          {/* Gradient overlay */}
          <LinearGradient
            colors={['transparent', colors.surface]}
            locations={[0.4, 1]}
            style={styles.gradient}
          />

          {/* Back button */}
          <Pressable onPress={handleBack} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color={colors.primary} />
          </Pressable>

          {/* Library toggle — top-right */}
          {resolvedTmdbId && (
            <View style={[styles.libraryOverlay, { top: insets.top + 8 }]}>
              <LibraryToggle
                tmdbId={resolvedTmdbId}
                mediaType="movie"
                title={displayTitle}
                posterPath={movie?.poster_path || tmdbDetails?.poster_path || null}
                year={year}
                inLibrary={movie?.is_watchlist ?? false}
                libraryId={movie?.id}
                size={28}
              />
            </View>
          )}
        </View>

        {/* ── Movie Info Section ── */}
        <View style={styles.infoSection}>
          {/* Poster + Title row */}
          <View style={styles.titleRow}>
            {displayPoster ? (
              <Image
                source={{ uri: displayPoster }}
                style={styles.posterThumb}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
            ) : (
              <View style={[styles.posterThumb, styles.posterPlaceholder]}>
                <Ionicons name="film-outline" size={28} color={colors.outlineVariant} />
              </View>
            )}
            <View style={styles.titleMeta}>
              <Text style={styles.title}>{displayTitle}</Text>
              <View style={styles.metaRow}>
                {year ? <Text style={styles.metaText}>{year}</Text> : null}
                {runtimeDisplay ? (
                  <>
                    <View style={styles.metaDot} />
                    <Text style={styles.metaText}>{runtimeDisplay}</Text>
                  </>
                ) : null}
                {genreList && genreList.length > 0 ? (
                  <>
                    <View style={styles.metaDot} />
                    <Text style={styles.metaText} numberOfLines={1}>
                      {genreList.slice(0, 2).join(', ')}
                    </Text>
                  </>
                ) : null}
              </View>
            </View>
          </View>

          {/* ── Watched Status (library items only) ── */}
          {movie && isWatched ? (
            <Pressable onPress={handleToggleWatched}>
              {({ pressed }) => (
                <View style={[styles.watchedButton, pressed && { opacity: 0.9 }]}>
                  <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                  <Text style={styles.watchedText}>Watched</Text>
                </View>
              )}
            </Pressable>
          ) : movie && !isWatched ? (
            <Pressable onPress={handleToggleWatched}>
              {({ pressed }) => (
                <View style={[styles.watchButton, pressed && styles.watchButtonPressed]}>
                  <Ionicons name="checkmark" size={18} color={colors.onPrimary} />
                  <Text style={styles.watchButtonText}>Mark as watched</Text>
                </View>
              )}
            </Pressable>
          ) : null}

          {/* ── Overview ── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Overview</Text>
            <Text style={styles.overviewText}>{overview}</Text>
          </View>
        </View>
      </Animated.ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
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
  scrollContent: {
    paddingBottom: 40,
  },

  // ── Backdrop ──
  backdropContainer: {
    width: SCREEN_WIDTH,
    height: BACKDROP_HEIGHT,
    position: 'relative',
  },
  backdrop: {
    width: '100%',
    height: '100%',
  },
  backdropPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.surfaceContainer,
  },
  gradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 160,
  },
  backButton: {
    position: 'absolute',
    top: 8,
    left: spacing.marginMobile,
    width: 44,
    height: 44,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  libraryOverlay: {
    position: 'absolute',
    right: spacing.marginMobile,
    zIndex: 10,
  },

  // ── Info ──
  infoSection: {
    marginTop: -40,
    paddingHorizontal: spacing.marginMobile,
  },
  titleRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  posterThumb: {
    width: 90,
    height: 135,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surfaceContainer,
  },
  posterPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleMeta: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: 4,
  },
  title: {
    fontSize: typography.headlineSm.fontSize,
    fontWeight: '700',
    color: colors.onSurface,
    lineHeight: typography.headlineSm.lineHeight,
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  metaText: {
    fontSize: typography.labelMd.fontSize,
    fontWeight: '500',
    letterSpacing: typography.labelMd.letterSpacing,
    color: colors.onSurfaceVariant,
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: borderRadius.full,
    backgroundColor: colors.onSurfaceVariant,
    opacity: 0.5,
  },

  // ── Watch / Watched ──
  watchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingVertical: 14,
    paddingHorizontal: 24,
    marginBottom: 24,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  watchButtonPressed: {
    transform: [{ scale: 0.98 }],
  },
  watchButtonText: {
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '700',
    color: colors.onPrimary,
  },
  watchedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    borderRadius: borderRadius.full,
    paddingVertical: 14,
    paddingHorizontal: 24,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.3)',
  },
  watchedText: {
    fontSize: typography.labelMd.fontSize,
    fontWeight: '600',
    letterSpacing: typography.labelMd.letterSpacing,
    color: colors.success,
  },

  // ── Section ──
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: typography.bodyLg.fontSize,
    fontWeight: '700',
    color: colors.onSurface,
    marginBottom: 12,
  },
  overviewText: {
    fontSize: typography.bodyMd.fontSize,
    color: colors.onSurfaceVariant,
    lineHeight: typography.bodyMd.lineHeight,
  },
})
