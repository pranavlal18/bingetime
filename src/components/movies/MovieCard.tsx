// ─── MovieCard — poster image + title + year + swipe-to-watch ───

import { useRef, memo, useCallback } from 'react'
import { View, Text, StyleSheet, Dimensions, Pressable } from 'react-native'
import { Image } from 'expo-image'
import { Swipeable } from 'react-native-gesture-handler'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { getImageUrl } from '@/lib/queries/movies'
import type { MovieWithUserData } from '@/lib/queries/movies'

const SCREEN_WIDTH = Dimensions.get('window').width
const CARD_WIDTH = (SCREEN_WIDTH - 24 - 12) / 2
const POSTER_ASPECT = 2 / 3

interface MovieCardProps {
  movie: MovieWithUserData
  onMarkWatched: (movieId: string) => void
}

const MovieCard = memo(function MovieCard({ movie, onMarkWatched }: MovieCardProps) {
  const swipeableRef = useRef<Swipeable>(null)

  const handlePress = useCallback(() => {
    router.push(`/movie/${movie.id}`)
  }, [movie.id])

  const posterUrl = getImageUrl(movie.poster_path, 'w342')
  const year = movie.release_date ? movie.release_date.slice(0, 4) : null

  const renderRightActions = () => {
    if (movie.watched) return null
    return (
      <Pressable
        style={styles.swipeAction}
        onPress={() => {
          onMarkWatched(movie.id)
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
      renderRightActions={movie.watched ? undefined : renderRightActions}
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
              <Ionicons name="film-outline" size={32} color="#555" />
            </View>
          )}

          {/* Watched badge */}
          {movie.watched && (
            <View style={styles.watchedBadge}>
              <Ionicons name="checkmark-circle" size={18} color="#4CAF50" />
            </View>
          )}

          {/* Year badge */}
          {year ? (
            <View style={styles.yearBadge}>
              <Text style={styles.yearText}>{year}</Text>
            </View>
          ) : null}
        </View>

        {/* Title */}
        <Text style={styles.title} numberOfLines={2}>
          {movie.title}
        </Text>

        {/* Watched indicator */}
        {movie.rewatch_count > 0 ? (
          <Text style={styles.rewatchText}>
            Watched {movie.rewatch_count + 1}x
          </Text>
        ) : movie.watched ? (
          <Text style={styles.watchedText}>Watched</Text>
        ) : null}
      </Pressable>
    </Swipeable>
  )
})

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
  watchedBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 12,
    padding: 2,
  },
  yearBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  yearText: {
    fontSize: 11,
    color: '#FFF',
    fontWeight: '600',
  },
  title: {
    fontSize: 13,
    color: '#FFF',
    fontWeight: '600',
    marginTop: 6,
    lineHeight: 18,
  },
  watchedText: {
    fontSize: 11,
    color: '#4CAF50',
    marginTop: 2,
    fontWeight: '500',
  },
  rewatchText: {
    fontSize: 11,
    color: '#FFA726',
    marginTop: 2,
    fontWeight: '500',
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

export default MovieCard
