// ─── MovieCard — poster image + title + year + swipe-to-watch ───

import { useRef, memo, useCallback, useMemo } from 'react'
import { View, Text, StyleSheet, Dimensions, Pressable } from 'react-native'
import { Image } from 'expo-image'
import { Swipeable } from 'react-native-gesture-handler'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { getImageUrl } from '@/lib/queries/movies'
import { typography, borderRadius, spacing } from '@/theme'
import { useTheme } from '@/contexts/ThemeContext'
import type { MovieWithUserData } from '@/lib/queries/movies'

const SCREEN_WIDTH = Dimensions.get('window').width
const CARD_WIDTH = (SCREEN_WIDTH - 40 - 16) / 2 // 40 outer margins, 16 gap = 2 cols
const POSTER_ASPECT = 2 / 3

interface MovieCardProps {
  movie: MovieWithUserData
  onMarkWatched: (movieId: string) => void
}

const MovieCard = memo(function MovieCard({ movie, onMarkWatched }: MovieCardProps) {
  const swipeableRef = useRef<Swipeable>(null)
  const { colors } = useTheme()
  const styles = useMemo(() => StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    marginBottom: 16,
  },
  posterContainer: {
    width: CARD_WIDTH,
    height: CARD_WIDTH * 1.5,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.surfaceDim,
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
  watchedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 12,
    padding: spacing.unit,
  },
  yearBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: spacing.unit,
  },
  yearText: {
    fontSize: 11,
    color: colors.onPrimary,
    fontWeight: '600',
  },
  title: {
    fontSize: typography.bodyXs.fontSize,
    color: colors.onSurface,
    fontWeight: '600',
    marginTop: 8,
    lineHeight: 18,
  },
  watchedText: {
    fontSize: typography.bodyXs.fontSize,
    color: colors.success,
    marginTop: spacing.unit,
    fontWeight: '500',
  },
  swipeAction: {
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    width: 72,
    borderRadius: borderRadius.lg,
    marginLeft: 8,
  },
  swipeLabel: {
    color: colors.onPrimary,
    fontSize: typography.bodyXs.fontSize,
    fontWeight: '600',
    marginTop: spacing.unit,
  },
}), [colors])

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
        <Ionicons name="checkmark" size={28} color={colors.onPrimary} />
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
              <Ionicons name="film-outline" size={32} color={colors.outlineVariant} />
            </View>
          )}

          {/* Watched badge */}
          {movie.watched && (
            <View style={styles.watchedBadge}>
              <Ionicons name="checkmark-circle" size={18} color={colors.success} />
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

      </Pressable>
    </Swipeable>
  )
})

export default MovieCard
