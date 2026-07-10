// ─── ContinueWatchingSection — horizontal scroll row at top of Shows tab ───

import { useCallback } from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { Image } from 'expo-image'
import { FlashList } from '@shopify/flash-list'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { getImageUrl } from '@/lib/queries/shows'
import ProgressBar from './ProgressBar'
import type { ShowWithUserData } from '@/lib/queries/shows'

const ITEM_WIDTH = 120
const ITEM_HEIGHT = ITEM_WIDTH * 1.5

interface ContinueWatchingSectionProps {
  shows: ShowWithUserData[]
  isLoading: boolean
}

export default function ContinueWatchingSection({
  shows,
  isLoading,
}: ContinueWatchingSectionProps) {
  const renderItem = useCallback(
    ({ item }: { item: ShowWithUserData }) => {
      const posterUrl = getImageUrl(item.poster_path, 'w185')
      const totalEps = item.total_episodes
      const seenEps = item.episodes_seen
      const hasProgress = totalEps !== null && totalEps > 0

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
                <Ionicons name="tv-outline" size={24} color="#555" />
              </View>
            )}

            {/* Play indicator */}
            <View style={styles.playOverlay}>
              <Ionicons
                name="play-circle"
                size={22}
                color="rgba(255,255,255,0.9)"
              />
            </View>
          </View>

          {/* Progress bar */}
          {hasProgress && (
            <ProgressBar
              episodesSeen={seenEps}
              totalEpisodes={totalEps}
              height={3}
              color="#6C63FF"
            />
          )}

          {/* Title */}
          <Text style={styles.title} numberOfLines={2}>
            {item.name}
          </Text>

          {/* Episode count */}
          {hasProgress && (
            <Text style={styles.episodeCount}>
              {seenEps}/{totalEps}
            </Text>
          )}
        </Pressable>
      )
    },
    []
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
        estimatedItemSize={ITEM_WIDTH}
        contentContainerStyle={styles.scrollContent}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  scrollContent: {
    paddingRight: 24,
  },
  card: {
    width: ITEM_WIDTH,
    marginRight: 12,
  },
  posterContainer: {
    width: ITEM_WIDTH,
    height: ITEM_HEIGHT,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#1A1A1A',
    position: 'relative',
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
  playOverlay: {
    position: 'absolute',
    top: 6,
    left: 6,
  },
  title: {
    fontSize: 12,
    color: '#FFF',
    fontWeight: '600',
    marginTop: 6,
    lineHeight: 16,
  },
  episodeCount: {
    fontSize: 11,
    color: '#888',
    marginTop: 2,
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
    borderRadius: 8,
    backgroundColor: '#2A2A2A',
  },
  skeletonText: {
    width: '60%',
    height: 12,
    borderRadius: 4,
    backgroundColor: '#2A2A2A',
    marginTop: 8,
  },
})
