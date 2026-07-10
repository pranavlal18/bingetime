// ─── Movie Detail Screen ───

import { useCallback } from 'react'
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native'
import { useLocalSearchParams, router, Stack } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { useMovie, useMarkMovieWatched } from '@/lib/queries/movies'
import { getMovieDetails, getImageUrl } from '@/lib/tmdb'
import { useQuery } from '@tanstack/react-query'

export default function MovieDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const insets = useSafeAreaInsets()

  const { data: movie, isLoading, error } = useMovie(id)
  const markWatchedMutation = useMarkMovieWatched()

  // Fetch TMDb details for overview + runtime
  const { data: tmdbDetails } = useQuery({
    queryKey: ['tmdb', 'movie-details', movie?.tmdb_id],
    queryFn: () => getMovieDetails(movie!.tmdb_id!),
    enabled: !!movie?.tmdb_id,
    staleTime: 1000 * 60 * 60,
  })

  const posterUrl = getImageUrl(movie?.poster_path, 'w500')
  const tmdbPosterUrl = tmdbDetails ? getImageUrl(tmdbDetails.poster_path, 'w500') : null
  const displayPoster = posterUrl || tmdbPosterUrl

  const year = movie?.release_date?.slice(0, 4)
  const runtime = movie?.runtime || tmdbDetails?.runtime || null
  const runtimeDisplay = runtime ? `${Math.floor(runtime / 60)}h ${runtime % 60}m` : null
  const overview = tmdbDetails?.overview || 'No overview available.'
  const isWatched = movie?.watched ?? false
  const rewatchCount = movie?.rewatch_count ?? 0

  const handleMarkWatched = useCallback(() => {
    if (movie) markWatchedMutation.mutate(movie.id)
  }, [movie, markWatchedMutation])

  const handleBack = useCallback(() => {
    router.back()
  }, [])

  // Loading state
  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#6C63FF" />
      </View>
    )
  }

  // Error state
  if (error || !movie) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <Ionicons name="alert-circle-outline" size={48} color="#555" />
        <Text style={styles.errorText}>Could not load movie details</Text>
        <Pressable onPress={handleBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>Go back</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Poster ── */}
        <View style={styles.posterContainer}>
          {displayPoster ? (
            <Image
              source={{ uri: displayPoster }}
              style={styles.poster}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          ) : (
            <View style={styles.posterPlaceholder}>
              <Ionicons name="film-outline" size={48} color="#444" />
            </View>
          )}

          {/* Back button overlay */}
          <Pressable onPress={handleBack} style={[styles.backOverlay, { top: insets.top + 8 }]}>
            <Ionicons name="chevron-back" size={24} color="#FFF" />
          </Pressable>
        </View>

        {/* ── Info ── */}
        <View style={styles.infoSection}>
          <Text style={styles.title}>{movie.title}</Text>

          <View style={styles.metaRow}>
            {year ? <Text style={styles.metaText}>{year}</Text> : null}
            {runtimeDisplay ? (
              <Text style={styles.metaText}>{runtimeDisplay}</Text>
            ) : null}
            {rewatchCount > 0 && (
              <View style={styles.rewatchBadge}>
                <Text style={styles.rewatchText}>
                  Rewatched {rewatchCount}x
                </Text>
              </View>
            )}
          </View>

          {/* ── Watched Button ── */}
          {isWatched ? (
            <View style={styles.watchedBanner}>
              <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
              <Text style={styles.watchedText}>Watched</Text>
              <Pressable
                style={styles.rewatchButton}
                onPress={handleMarkWatched}
              >
                <Text style={styles.rewatchButtonText}>Watch again</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              style={({ pressed }) => [
                styles.watchButton,
                pressed && styles.watchButtonPressed,
              ]}
              onPress={handleMarkWatched}
            >
              <Ionicons name="checkmark" size={18} color="#FFF" />
              <Text style={styles.watchButtonText}>Mark as watched</Text>
            </Pressable>
          )}

          {/* ── Overview ── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Overview</Text>
            <Text style={styles.overviewText}>{overview}</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F0F',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#888',
    marginTop: 12,
    marginBottom: 16,
  },
  backButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
  },
  backButtonText: {
    color: '#6C63FF',
    fontSize: 14,
    fontWeight: '600',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },

  // Poster
  posterContainer: {
    width: '100%',
    height: 420,
    backgroundColor: '#1A1A1A',
  },
  poster: {
    width: '100%',
    height: '100%',
  },
  posterPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backOverlay: {
    position: 'absolute',
    left: 8,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Info
  infoSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 8,
    lineHeight: 30,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  metaText: {
    fontSize: 13,
    color: '#888',
    fontWeight: '500',
  },
  rewatchBadge: {
    backgroundColor: 'rgba(255,167,38,0.15)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  rewatchText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFA726',
  },

  // Watch button
  watchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#4CAF50',
    borderRadius: 10,
    paddingVertical: 14,
    marginBottom: 24,
  },
  watchButtonPressed: {
    backgroundColor: '#388E3C',
    opacity: 0.9,
  },
  watchButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
  },

  // Watched banner
  watchedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(76,175,80,0.1)',
    borderRadius: 10,
    paddingVertical: 12,
    marginBottom: 24,
  },
  watchedText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4CAF50',
  },
  rewatchButton: {
    marginLeft: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: 'rgba(76,175,80,0.2)',
    borderRadius: 6,
  },
  rewatchButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4CAF50',
  },

  // Section
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 12,
  },
  overviewText: {
    fontSize: 14,
    color: '#AAA',
    lineHeight: 22,
  },
})
