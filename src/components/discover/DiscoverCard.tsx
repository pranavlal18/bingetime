// ─── DiscoverCard — poster + info + add button ───

import { memo, useCallback } from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { getImageUrl } from '@/lib/tmdb'
import type { DiscoverResult } from '@/lib/queries/discover'

interface DiscoverCardProps {
  item: DiscoverResult
  onAdd: (item: DiscoverResult) => void
  isAdding: boolean
}

const DiscoverCard = memo(function DiscoverCard({
  item,
  onAdd,
  isAdding,
}: DiscoverCardProps) {
  const posterUrl = getImageUrl(item.poster_path, 'w92')

  const handlePress = useCallback(() => {
    // If already in library, navigate to detail page
    if (item.inLibrary && item.libraryId) {
      if (item.mediaType === 'tv') {
        router.push(`/show/${item.libraryId}`)
      } else {
        router.push(`/movie/${item.libraryId}`)
      }
      return
    }
    // Not in library — add it
    onAdd(item)
  }, [item, onAdd])

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
            <Ionicons name="film-outline" size={24} color="#555" />
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

        {item.overview ? (
          <Text style={styles.overview} numberOfLines={2}>
            {item.overview}
          </Text>
        ) : null}
      </View>

      {item.inLibrary ? (
        <View style={styles.addedBadge}>
          <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
          <Text style={styles.addedText}>Added</Text>
        </View>
      ) : (
        <Pressable
          style={({ pressed }) => [
            styles.addButton,
            pressed && styles.addButtonPressed,
          ]}
          onPress={() => onAdd(item)}
          disabled={isAdding}
        >
          <Ionicons
            name={isAdding ? 'hourglass-outline' : 'add'}
            size={18}
            color="#FFF"
          />
        </Pressable>
      )}
    </Pressable>
  )
})

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: '#1A1A1A',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    alignItems: 'flex-start',
  },
  posterContainer: {
    width: 48,
    height: 72,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: '#2A2A2A',
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
    backgroundColor: 'rgba(108,99,255,0.2)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: 4,
  },
  movieBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,167,38,0.2)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 2,
  },
  year: {
    fontSize: 12,
    color: '#888',
    marginBottom: 2,
  },
  overview: {
    fontSize: 11,
    color: '#666',
    lineHeight: 15,
  },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#6C63FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  addButtonPressed: {
    backgroundColor: '#5A52E0',
    opacity: 0.8,
  },
  addedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 24,
  },
  addedText: {
    fontSize: 11,
    color: '#4CAF50',
    fontWeight: '600',
  },
})

export default DiscoverCard
