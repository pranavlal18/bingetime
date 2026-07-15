// ─── ContinueWatchingSection — Stitch-aligned horizontal scroll ───

import { useCallback, useMemo } from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { Image } from 'expo-image'
import { FlashList } from '@shopify/flash-list'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { getImageUrl } from '@/lib/queries/shows'
import ProgressBar from './ProgressBar'
import { typography, spacing, borderRadius } from '@/theme'
import { useTheme } from '@/contexts/ThemeContext'
import type { ShowWithUserData } from '@/lib/queries/shows'

const ITEM_WIDTH = 110
const ITEM_HEIGHT = ITEM_WIDTH * 1.5

interface ContinueWatchingSectionProps {
  shows: ShowWithUserData[]
  isLoading: boolean
}

export default function ContinueWatchingSection({
  shows,
  isLoading,
}: ContinueWatchingSectionProps) {
  const { colors } = useTheme()

  const styles = useMemo(() => StyleSheet.create({
  container: {
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: typography.bodyLg.fontSize,
    fontWeight: '700',
    color: colors.onSurface,
    marginBottom: 12,
    paddingHorizontal: spacing.unit,
  },
  scrollContent: {
    paddingRight: spacing.marginMobile,
  },
  card: {
    width: ITEM_WIDTH,
    marginRight: 10,
  },
  posterContainer: {
    width: ITEM_WIDTH,
    height: ITEM_HEIGHT,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surfaceContainer,
    position: 'relative',
    borderWidth: 1,
    borderColor: colors.outlineVariant,
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
  completeBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 10,
    padding: spacing.unit,
  },
  title: {
    fontSize: typography.bodyXs.fontSize,
    color: colors.onSurface,
    fontWeight: '600',
    marginTop: 6,
    lineHeight: 16,
  },
  episodeCount: {
    fontSize: typography.bodyXs.fontSize,
    color: colors.onSurfaceVariant,
    marginTop: spacing.unit,
  },
  loadingRow: {
    flexDirection: 'row',
  },
  skeletonCard: {
    width: ITEM_WIDTH - 4,
    marginRight: 10,
  },
  skeletonPoster: {
    width: '100%',
    height: ITEM_HEIGHT,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceContainerHighest,
  },
  skeletonText: {
    width: '60%',
    height: 12,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceContainerHighest,
    marginTop: 8,
  },
}), [colors])

  const renderItem = useCallback(
    ({ item }: { item: ShowWithUserData }) => {
      const posterUrl = getImageUrl(item.poster_path, 'w185')
      const totalEps = item.total_episodes
      const seenEps = item.episodes_seen
      const hasProgress = totalEps !== null && totalEps > 0

      const allCaughtUp = totalEps !== null && totalEps > 0 && seenEps >= totalEps
      const isComplete = allCaughtUp && (item.status === 'Ended' || item.status === 'Canceled')
      const isUpToDate = allCaughtUp && !isComplete
      const newSeason = item.next_air_episode != null &&
        item.last_watched_episode_data?.season_number != null &&
        item.next_air_episode.season_number > item.last_watched_episode_data.season_number &&
        item.next_air_episode.episode_number === 1

      return (
        <Pressable style={styles.card} onPress={() => router.push(`/show/${item.id}`)}>
          {/* Poster */}
          <View style={styles.posterContainer}>
            {posterUrl ? (
              <Image
                source={{ uri: posterUrl }}
                style={styles.poster}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
            ) : (
              <View style={styles.posterPlaceholder}>
                <Ionicons name="tv-outline" size={24} color={colors.outlineVariant} />
              </View>
            )}

            {/* Poster only — no decorative play icon (misleading) */}

            {/* New Season badge */}
            {newSeason && (
              <View style={{ position: 'absolute', top: 4, left: 4, backgroundColor: colors.primaryContainer, borderRadius: 8, padding: 3 }}>
                <Ionicons name="sparkles" size={12} color={colors.onPrimaryContainer} />
              </View>
            )}

            {/* Status badge */}
            {isComplete && (
              <View style={styles.completeBadge}>
                <Ionicons name="checkmark-circle" size={14} color={colors.statusFinished} />
              </View>
            )}
            {isUpToDate && (
              <View style={styles.completeBadge}>
                <Ionicons name="checkmark-circle" size={14} color={colors.statusUpToDate} />
              </View>
            )}
          </View>

          {/* Progress bar */}
          {hasProgress && (
            <ProgressBar
              episodesSeen={seenEps}
              totalEpisodes={totalEps}
              height={3}
              color={colors.primary}
            />
          )}

          {/* Title */}
          <Text style={styles.title} numberOfLines={2}>
            {item.name}
          </Text>

          {/* Episode count */}
          {hasProgress && (
            <Text style={styles.episodeCount}>
              {Math.min(seenEps, totalEps!)}/{totalEps}
            </Text>
          )}
        </Pressable>
      )
    },
    [colors, styles]
  )

  const keyExtractor = useCallback((item: ShowWithUserData) => item.id, [])

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.sectionTitle}>Continue Watching</Text>
        <View style={styles.loadingRow}>
          {[1, 2, 3].map((i) => (
            <View key={i} style={styles.skeletonCard}>
              <View style={styles.skeletonPoster} />
              <View style={styles.skeletonText} />
            </View>
          ))}
        </View>
      </View>
    )
  }

  if (!shows || shows.length === 0) return null

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Continue Watching</Text>
      <FlashList
        data={shows}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      />
    </View>
  )
}

