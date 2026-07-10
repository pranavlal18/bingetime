// ─── Show Detail Screen ───

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
import { useShow, useMarkWatched } from '@/lib/queries/shows'
import { getShowDetails, getImageUrl } from '@/lib/tmdb'
import { useQuery } from '@tanstack/react-query'
import type { TMDbShowDetails } from '@/types'

export default function ShowDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const insets = useSafeAreaInsets()

  const { data: show, isLoading, error } = useShow(id)
  const markWatchedMutation = useMarkWatched()

  // Fetch TMDb details for overview + seasons
  const { data: tmdbDetails } = useQuery({
    queryKey: ['tmdb', 'show-details', show?.tmdb_id],
    queryFn: () => getShowDetails(show!.tmdb_id!),
    enabled: !!show?.tmdb_id,
    staleTime: 1000 * 60 * 60, // 1 hour
  })

  const posterUrl = getImageUrl(show?.poster_path, 'w500')
  const tmdbPosterUrl = tmdbDetails ? getImageUrl(tmdbDetails.poster_path, 'w500') : null
  const displayPoster = posterUrl || tmdbPosterUrl

  const year = show?.last_air_date?.slice(0, 4)
  const episodesSeen = show?.episodes_seen ?? 0
  const totalEpisodes = show?.total_episodes
  const progress = totalEpisodes ? episodesSeen / totalEpisodes : 0
  const isComplete = show ? (show.status === 'Ended' || show.status === 'Canceled') && episodesSeen >= (totalEpisodes || 0) : false
  const overview = tmdbDetails?.overview || 'No overview available.'
  const seasons = tmdbDetails?.seasons?.filter((s) => s.season_number > 0) || []

  const handleMarkWatched = useCallback(() => {
    if (show) markWatchedMutation.mutate(show.id)
  }, [show, markWatchedMutation])

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
  if (error || !show) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <Ionicons name="alert-circle-outline" size={48} color="#555" />
        <Text style={styles.errorText}>Could not load show details</Text>
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
              <Ionicons name="tv-outline" size={48} color="#444" />
            </View>
          )}

          {/* Back button overlay */}
          <Pressable onPress={handleBack} style={[styles.backOverlay, { top: insets.top + 8 }]}>
            <Ionicons name="chevron-back" size={24} color="#FFF" />
          </Pressable>
        </View>

        {/* ── Info ── */}
        <View style={styles.infoSection}>
          <Text style={styles.title}>{show.name}</Text>

          <View style={styles.metaRow}>
            {year ? <Text style={styles.metaText}>{year}</Text> : null}
            {show.status ? (
              <View style={[
                styles.statusBadge,
                isComplete && styles.statusComplete,
              ]}>
                <Text style={styles.statusText}>{show.status}</Text>
              </View>
            ) : null}
            {totalEpisodes ? (
              <Text style={styles.metaText}>{totalEpisodes} eps</Text>
            ) : null}
          </View>

          {/* ── Progress ── */}
          <View style={styles.progressSection}>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.min(progress * 100, 100)}%` },
                  isComplete && styles.progressComplete,
                ]}
              />
            </View>
            <Text style={styles.progressLabel}>
              {episodesSeen}
              {totalEpisodes ? ` / ${totalEpisodes}` : ' eps'} seen
            </Text>
          </View>

          {/* ── Continue Watching Button ── */}
          {!isComplete && (
            <Pressable
              style={({ pressed }) => [
                styles.watchButton,
                pressed && styles.watchButtonPressed,
              ]}
              onPress={handleMarkWatched}
            >
              <Ionicons name="play" size={18} color="#FFF" />
              <Text style={styles.watchButtonText}>
                {episodesSeen === 0
                  ? 'Start watching'
                  : totalEpisodes && episodesSeen >= totalEpisodes
                    ? 'Completed'
                    : 'Mark next episode watched'}
              </Text>
            </Pressable>
          )}

          {isComplete && (
            <View style={styles.completeBanner}>
              <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
              <Text style={styles.completeText}>All episodes watched</Text>
            </View>
          )}

          {/* ── Overview ── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Overview</Text>
            <Text style={styles.overviewText}>{overview}</Text>
          </View>

          {/* ── Seasons ── */}
          {seasons.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Seasons</Text>
              {seasons.map((season) => (
                <Pressable
                  key={season.id}
                  style={({ pressed }) => [
                    styles.seasonRow,
                    pressed && styles.seasonRowPressed,
                  ]}
                  onPress={() => router.push(`/show/${id}/season/${season.season_number}`)}
                >
                  <View style={styles.seasonBadge}>
                    <Text style={styles.seasonBadgeText}>{season.season_number}</Text>
                  </View>
                  <View style={styles.seasonInfo}>
                    <Text style={styles.seasonName}>
                      Season {season.season_number}
                    </Text>
                    <Text style={styles.seasonEps}>
                      {season.episode_count} episodes
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#555" />
                </Pressable>
              ))}
            </View>
          )}
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
  },
  metaText: {
    fontSize: 13,
    color: '#888',
    fontWeight: '500',
  },
  statusBadge: {
    backgroundColor: 'rgba(255,167,38,0.15)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusComplete: {
    backgroundColor: 'rgba(76,175,80,0.15)',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFA726',
  },

  // Progress
  progressSection: {
    marginBottom: 16,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#2A2A2A',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#6C63FF',
    borderRadius: 3,
  },
  progressComplete: {
    backgroundColor: '#4CAF50',
  },
  progressLabel: {
    fontSize: 12,
    color: '#888',
    fontWeight: '500',
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

  // Complete banner
  completeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(76,175,80,0.1)',
    borderRadius: 10,
    paddingVertical: 12,
    marginBottom: 24,
  },
  completeText: {
    fontSize: 14,
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

  // Seasons
  seasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    gap: 12,
  },
  seasonRowPressed: {
    backgroundColor: '#252525',
  },
  seasonBadge: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#2A2A2A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  seasonBadgeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
  seasonInfo: {
    flex: 1,
  },
  seasonName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  seasonEps: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
})
