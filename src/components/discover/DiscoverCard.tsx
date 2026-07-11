// ─── DiscoverCard — poster + info + add/remove toggle ───

import { memo, useCallback } from 'react'
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { getImageUrl } from '@/lib/tmdb'
import { colors, typography, borderRadius, spacing } from '@/theme'
import type { DiscoverResult } from '@/lib/queries/discover'

interface DiscoverCardProps {
  item: DiscoverResult
  onAdd: (item: DiscoverResult) => void
  onRemove: (item: DiscoverResult) => void
  isAdding: boolean
  isRemoving: boolean
}

const DiscoverCard = memo(function DiscoverCard({
  item,
  onAdd,
  onRemove,
  isAdding,
  isRemoving,
}: DiscoverCardProps) {
  const posterUrl = getImageUrl(item.poster_path, 'w92')

  const handlePress = useCallback(() => {
    if (item.mediaType === 'tv') {
      router.push(`/show/${item.libraryId || item.tmdbId}`)
    } else {
      router.push(`/movie/${item.libraryId || item.tmdbId}`)
    }
  }, [item])

  const isLoading = isAdding || isRemoving

  return (
    <Pressable style={styles.card} onPress={handlePress}>
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
            <Ionicons name="film-outline" size={24} color={colors.onSurfaceVariant} />
          </View>
        )}
      </View>

      <View style={styles.info}>
        <View style={item.mediaType === 'tv' ? styles.tvBadge : styles.movieBadge}>
          <Text style={styles.badgeText}>
            {item.mediaType === 'tv' ? 'TV' : 'Movie'}
          </Text>
        </View>

        <Text style={styles.title} numberOfLines={2}>
          {item.title}
        </Text>

        {item.year ? (
          <Text style={styles.year}>{item.year}</Text>
        ) : null}
      </View>

      <Pressable
        style={[
          styles.toggleButton,
          item.inLibrary && styles.toggleButtonActive,
        ]}
        onPress={() => (item.inLibrary ? onRemove(item) : onAdd(item))}
        disabled={isLoading}
      >
          {isLoading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons
              name={item.inLibrary ? 'checkmark' : 'add'}
              size={20}
              color="#fff"
            />
          )}
      </Pressable>
    </Pressable>
  )
})


const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceContainer,
    borderRadius: borderRadius.lg,
    padding: 12,
    marginBottom: 10,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  posterContainer: {
    width: 48,
    height: 72,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: colors.surfaceContainerHighest,
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
  info: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  tvBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary + '33',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: spacing.unit,
    marginBottom: 4,
  },
  movieBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.warning + '33',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: spacing.unit,
    marginBottom: 4,
  },
  badgeText: {
    fontSize: typography.bodyXs.fontSize,
    fontWeight: '700',
    color: colors.onPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: typography.bodySm.fontSize,
    fontWeight: '600',
    color: colors.onSurface,
    marginBottom: spacing.unit,
  },
  year: {
    fontSize: typography.bodyXs.fontSize,
    color: colors.onSurfaceVariant,
    marginBottom: spacing.unit,
  },
  overview: {
    fontSize: typography.bodyXs.fontSize,
    color: colors.onSurfaceVariant,
    lineHeight: 15,
  },
  toggleButton: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  toggleButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
})

export default DiscoverCard
