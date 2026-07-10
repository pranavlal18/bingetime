// ─── MovieListItem — thumbnail + title + year + swipe-to-watch ───

import { useRef, memo, useCallback } from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { Image } from 'expo-image'
import { Swipeable } from 'react-native-gesture-handler'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { getImageUrl } from '@/lib/queries/movies'
import type { MovieWithUserData } from '@/lib/queries/movies'

interface MovieListItemProps {
  movie: MovieWithUserData
  onMarkWatched: (movieId: string) => void
}

const MovieListItem = memo(function MovieListItem({
  movie,
  onMarkWatched,
}: MovieListItemProps) {
  const swipeableRef = useRef<Swipeable>(null)

  const handlePress = useCallback(() => {
    router.push(`/movie/${movie.id}`)
  }, [movie.id])

  const posterUrl = getImageUrl(movie.poster_path, 'w92')
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
        <Ionicons name="checkmark" size={24} color="#FFF" />
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
              <Ionicons name="film-outline" size={20} color="#555" />
            </View>
          )}
        </View>

        {/* Info */}
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>
            {movie.title}
          </Text>

          {year ? (
            <Text style={styles.yearText}>{year}</Text>
          ) : null}

          <Text style={[styles.statusText, { color: movie.watched ? '#4CAF50' : '#666' }]}>
            {movie.rewatch_count > 0
              ? `Watched ${movie.rewatch_count + 1}x`
              : movie.watched
                ? 'Watched'
                : 'Not watched'}
          </Text>
        </View>

        {/* Watched check */}
        {movie.watched && (
          <Ionicons
            name="checkmark-circle"
            size={20}
            color="#4CAF50"
            style={styles.completeIcon}
          />
        )}
      </Pressable>
    </Swipeable>
  )
})

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
  yearText: {
    fontSize: 12,
    color: '#888',
    marginBottom: 2,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  completeIcon: {
    marginLeft: 8,
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

export default MovieListItem
