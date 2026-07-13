// ─── TrendingSection — horizontal carousel of large poster cards ───

import { memo, useCallback } from 'react'
import { View, Text, Pressable, StyleSheet, Dimensions, ActivityIndicator } from 'react-native'
import { FlashList } from '@shopify/flash-list'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { getImageUrl } from '@/lib/tmdb'
import { colors, typography, borderRadius } from '@/theme'
import type { DiscoverResult } from '@/lib/queries/discover'

const SCREEN_WIDTH = Dimensions.get('window').width
const CARD_WIDTH = SCREEN_WIDTH * 0.58 // 58% of screen — immersive Stitch scale
const CARD_HEIGHT = CARD_WIDTH * 1.5 // 2:3 aspect ratio
const SIDE_OFFSET = 20 // matches spacing.marginMobile

interface TrendingSectionProps {
  data: DiscoverResult[]
  onAdd: (item: DiscoverResult) => void
  onRemove: (item: DiscoverResult) => void
  addingIds: Set<number>
  removingIds: Set<number>
}

// ── Individual Poster Card ──

interface PosterCardProps {
  item: DiscoverResult
  onAdd: (item: DiscoverResult) => void
  onRemove: (item: DiscoverResult) => void
  isAdding: boolean
  isRemoving: boolean
}

const PosterCard = memo(function PosterCard({
  item,
  onAdd,
  onRemove,
  isAdding,
  isRemoving,
}: PosterCardProps) {
  const posterUrl = getImageUrl(item.poster_path, 'w500')

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
      {/* Poster image */}
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
            <Ionicons name="film-outline" size={36} color={colors.outlineVariant} />
          </View>
        )}

        <Pressable
            style={[
              styles.inLibraryBadge,
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
              size={16}
              color="#fff"
            />
          )}
        </Pressable>
      </View>

      {/* Info below poster */}
      <Text style={styles.title} numberOfLines={1}>
        {item.title}
      </Text>
      <Text style={styles.subtitle} numberOfLines={1}>
        {item.mediaType === 'tv' ? 'TV Series' : 'Movie'}
        {item.year ? ` • ${item.year}` : ''}
      </Text>
    </Pressable>
  )
})

// ── Trending Section ──

function TrendingSection({ data, onAdd, onRemove, addingIds, removingIds }: TrendingSectionProps) {
  const renderItem = useCallback(
    ({ item }: { item: DiscoverResult }) => (
      <PosterCard
        item={item}
        onAdd={onAdd}
        onRemove={onRemove}
        isAdding={addingIds.has(item.tmdbId)}
        isRemoving={removingIds.has(item.tmdbId)}
      />
    ),
    [onAdd, onRemove, addingIds, removingIds]
  )

  const keyExtractor = useCallback((item: DiscoverResult) => item.tmdbId.toString(), [])

  const handleSeeAll = useCallback(() => {
    // Scroll to the end or future expansion
  }, [])

  return (
    <View style={styles.section}>
      {/* Section header */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Trending Now</Text>
        <Pressable onPress={handleSeeAll} style={styles.seeAllBtn}>
          <Text style={styles.seeAllText}>See All</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.primary} />
        </Pressable>
      </View>

      {/* Horizontal carousel */}
      <FlashList
        data={data}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <View style={{ width: 16 }} />}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SIDE_OFFSET,
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: 'Inter',
    fontSize: 22,
    fontWeight: '700',
    color: colors.onSurface,
    letterSpacing: -0.01,
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  seeAllText: {
    fontFamily: 'Inter',
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  listContent: {
    paddingLeft: SIDE_OFFSET,
    paddingEnd: SIDE_OFFSET + 20,
  },

  // ── Card ──
  card: {
    width: CARD_WIDTH,
  },
  posterContainer: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.surfaceDim,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    position: 'relative',
  },
  poster: {
    width: '100%',
    height: '100%',
  },
  posterPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surfaceDim,
  },

  // ── Badges ──
  newEpisodeBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  newEpisodeText: {
    fontFamily: 'Inter',
    fontSize: 11,
    fontWeight: '700',
    color: colors.onPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inLibraryBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  toggleButtonActive: {
    backgroundColor: colors.primary,
  },

  // ── Info ──
  title: {
    fontFamily: 'Inter',
    fontSize: 14,
    fontWeight: '600',
    color: colors.onSurface,
    marginTop: 8,
    lineHeight: 18,
  },
  subtitle: {
    fontFamily: 'Inter',
    fontSize: 12,
    fontWeight: '400',
    color: colors.onSurfaceVariant,
    marginTop: 4,
    opacity: 0.7,
  },
})

export default TrendingSection
