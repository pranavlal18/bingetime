// ─── ShowCard — poster image + progress bar + swipe-to-watch ───

import { useRef, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Pressable,
} from 'react-native'
import { Image } from 'expo-image'
import { Swipeable } from 'react-native-gesture-handler'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { getImageUrl } from '@/lib/queries/shows'
import ProgressBar from './ProgressBar'
import type { ShowWithUserData } from '@/lib/queries/shows'

const SCREEN_WIDTH = Dimensions.get('window').width
const CARD_WIDTH = (SCREEN_WIDTH - 24 - 12) / 2 // 24 padding, 12 gap = 2 cols
const POSTER_ASPECT = 2 / 3

interface ShowCardProps {
  show: ShowWithUserData
  onMarkWatched: (showId: string) => void
}

export default function ShowCard({ show, onMarkWatched }: ShowCardProps) {
  const swipeableRef = useRef<Swipeable>(null)

  const handlePress = useCallback(() => {
    router.push(`/show/${show.id}`)
  }, [show.id])

  const posterUrl = getImageUrl(show.poster_path, 'w342')
  const totalEps = show.total_episodes
  const seenEps = show.episodes_seen

  // Show is complete if:
  // 1. known total + seen >= total, OR
  // 2. show ended/canceled and seen >= total, OR
  // 3. show ended/canceled with no total but seen > 0 (user confirmed finished)
  const isComplete =
    (totalEps !== null && totalEps > 0 && seenEps >= totalEps) ||
    ((show.status === 'Ended' || show.status === 'Canceled') &&
      totalEps !== null &&
      seenEps >= totalEps)

  const hasProgress = seenEps > 0 || (totalEps !== null && totalEps > 0)

  const renderRightActions = () => {
    // Swipe right = mark watched
    if (isComplete) return null
    return (
      <Pressable
        style={styles.swipeAction}
        onPress={() => {
          onMarkWatched(show.id)
          swipeableRef.current?.close()
        }}
      >
        <Ionicons name="checkmark" size={28} color="#FFF" />
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
      <Pressable style={styles.card} onPress={handlePress}>
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
              <Ionicons name="tv-outline" size={32} color="#555" />
            </View>
          )}

          {/* Complete badge */}
          {isComplete && (
            <View style={styles.completeBadge}>
              <Ionicons name="checkmark-circle" size={18} color="#4CAF50" />
            </View>
          )}

          {/* Rewatch indicator — if episodes_seen > total, they're rewatching */}
          {totalEps !== null && seenEps > totalEps && totalEps > 0 && (
            <View style={styles.rewatchBadge}>
              <Ionicons name="repeat" size={12} color="#FFF" />
              <Text style={styles.rewatchText}>
                +{seenEps - totalEps}
              </Text>
            </View>
          )}
        </View>

        {/* Progress bar */}
        {hasProgress && (
          <ProgressBar
            episodesSeen={seenEps}
            totalEpisodes={totalEps || seenEps}
            height={3}
          />
        )}

        {/* Title */}
        <Text style={styles.title} numberOfLines={2}>
          {show.name}
        </Text>

        {/* Episode count */}
        {seenEps > 0 && (
          <Text style={styles.episodeCount}>
            {totalEps ? `${seenEps}/${totalEps}` : `${seenEps} eps`}
          </Text>
        )}
      </Pressable>
    </Swipeable>
  )
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    marginBottom: 16,
  },
  posterContainer: {
    width: CARD_WIDTH,
    height: CARD_WIDTH * 1.5,
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
  completeBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 12,
    padding: 2,
  },
  rewatchBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: 'rgba(108,99,255,0.9)',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  rewatchText: {
    fontSize: 11,
    color: '#FFF',
    fontWeight: '700',
  },
  title: {
    fontSize: 13,
    color: '#FFF',
    fontWeight: '600',
    marginTop: 6,
    lineHeight: 18,
  },
  episodeCount: {
    fontSize: 11,
    color: '#888',
    marginTop: 2,
  },
  swipeAction: {
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    width: 72,
    borderRadius: 8,
    marginLeft: 8,
  },
  swipeLabel: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
})
