// ─── ShowListItem — thumbnail + title + progress + episode info ───

import { useRef, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
} from 'react-native'
import { Image } from 'expo-image'
import { Swipeable } from 'react-native-gesture-handler'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { getImageUrl } from '@/lib/queries/shows'
import ProgressBar from './ProgressBar'
import type { ShowWithUserData } from '@/lib/queries/shows'

interface ShowListItemProps {
  show: ShowWithUserData
  onMarkWatched: (showId: string) => void
}

export default function ShowListItem({ show, onMarkWatched }: ShowListItemProps) {
  const swipeableRef = useRef<Swipeable>(null)

  const handlePress = useCallback(() => {
    router.push(`/show/${show.id}`)
  }, [show.id])

  const posterUrl = getImageUrl(show.poster_path, 'w92')
  const totalEps = show.total_episodes
  const seenEps = show.episodes_seen

  // Show is complete if:
  // 1. known total + seen >= total, OR
  // 2. show ended/canceled and seen >= total
  const isComplete =
    (totalEps !== null && totalEps > 0 && seenEps >= totalEps) ||
    ((show.status === 'Ended' || show.status === 'Canceled') &&
      totalEps !== null &&
      seenEps >= totalEps)

  const hasProgress = seenEps > 0 || (totalEps !== null && totalEps > 0)

  const lastEpisodeLabel = show.last_watched_episode_data
    ? (() => {
        const data = show.last_watched_episode_data
        if (data.season_number != null && data.episode_number != null) {
          return `S${data.season_number}E${data.episode_number}`
        }
        // Fallback: show episode count if available
        return seenEps > 0 ? `${seenEps} episodes watched` : ''
      })()
    : ''

  const renderRightActions = () => {
    if (isComplete) return null
    return (
      <Pressable
        style={styles.swipeAction}
        onPress={() => {
          onMarkWatched(show.id)
          swipeableRef.current?.close()
        }}
      >
        <Ionicons name="checkmark" size={24} color="#FFF" />
        <Text style={styles.swipeLabel}>Watch</Text>
      </Pressable>
    )
  }

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={isComplete ? undefined : renderRightActions}
      overshootRight={false}
      rightThreshold={40}
    >
      <Pressable style={styles.container} onPress={handlePress}>
        {/* Thumbnail */}
        <View style={styles.thumbnailContainer}>
          {posterUrl ? (
            <Image
              source={{ uri: posterUrl }}
              style={styles.thumbnail}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          ) : (
            <View style={styles.thumbnailPlaceholder}>
              <Ionicons name="tv-outline" size={20} color="#555" />
            </View>
          )}
        </View>

        {/* Info */}
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>
            {show.name}
          </Text>

          {lastEpisodeLabel ? (
            <Text style={styles.episodeInfo} numberOfLines={1}>
              {lastEpisodeLabel}
            </Text>
          ) : null}

          {hasProgress && (
            <View style={styles.progressRow}>
              <View style={styles.progressBarWrapper}>
                <ProgressBar
                  episodesSeen={seenEps}
                  totalEpisodes={totalEps || seenEps}
                  height={4}
                />
              </View>
              <Text style={styles.count}>
                {totalEps ? `${seenEps}/${totalEps}` : `${seenEps} eps`}
              </Text>
            </View>
          )}

          {!hasProgress && (
            <Text style={styles.episodeInfo}>
              {seenEps > 0 ? `${seenEps} eps` : 'Not started'}
            </Text>
          )}
        </View>

        {/* Complete check */}
        {isComplete && (
          <Ionicons name="checkmark-circle" size={20} color="#4CAF50" style={styles.completeIcon} />
        )}
      </Pressable>
    </Swipeable>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  thumbnailContainer: {
    width: 48,
    height: 72,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: '#2A2A2A',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  thumbnailPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: {
    flex: 1,
    marginLeft: 12,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 2,
  },
  episodeInfo: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  count: {
    fontSize: 11,
    color: '#888',
    minWidth: 40,
    textAlign: 'right',
  },
  completeIcon: {
    marginLeft: 8,
  },
  progressBarWrapper: {
    flex: 1,
  },
  swipeAction: {
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    width: 64,
    borderRadius: 10,
    marginLeft: 8,
    marginBottom: 8,
  },
  swipeLabel: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
})
