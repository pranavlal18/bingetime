// ─── MovieListItem — thumbnail + title + year + swipe-to-watch ───

import { useRef, memo, useCallback } from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { Image } from 'expo-image'
import { Swipeable } from 'react-native-gesture-handler'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { getImageUrl } from '@/lib/queries/movies'
import { colors, typography, borderRadius, spacing } from '@/theme'
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
        <Ionicons name="checkmark" size={24} color={colors.onPrimary} />
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
              <Ionicons name="film-outline" size={20} color={colors.outlineVariant} />
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

          <Text style={[styles.statusText, { color: movie.watched ? colors.success : colors.onSurfaceVariant }]}>
            {movie.watched ? 'Watched' : 'Not watched'}
          </Text>
        </View>

        {/* Right actions */}
        <View style={styles.rightActions}>
          {movie.watched && (
            <Ionicons
              name="checkmark-circle"
              size={20}
              color={colors.success}
            />
          )}
        </View>
      </Pressable>
    </Swipeable>
  )
})

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainer,
    borderRadius: borderRadius.lg,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  thumbnailContainer: {
    width: 48,
    height: 72,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: colors.surfaceDim,
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
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '600',
    color: colors.onSurface,
    marginBottom: spacing.unit,
  },
  yearText: {
    fontSize: typography.bodyXs.fontSize,
    color: colors.onSurfaceVariant,
    marginBottom: spacing.unit,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  completeIcon: {
    marginLeft: 8,
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 8,
  },
  swipeAction: {
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    width: 64,
    borderRadius: borderRadius.lg,
    marginLeft: 8,
    marginBottom: 8,
  },
  swipeLabel: {
    color: colors.onPrimary,
    fontSize: typography.bodyXs.fontSize,
    fontWeight: '600',
    marginTop: spacing.unit,
  },
})

export default MovieListItem
