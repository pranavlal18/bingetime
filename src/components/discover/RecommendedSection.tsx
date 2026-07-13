// ─── RecommendedSection — horizontal carousel of small poster cards ───

import { memo, useCallback } from 'react'
import { View, Text, Pressable, StyleSheet, Dimensions, ActivityIndicator } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { FlashList } from '@shopify/flash-list'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { getImageUrl } from '@/lib/tmdb'
import { colors, typography, borderRadius, spacing } from '@/theme'
import type { DiscoverResult } from '@/lib/queries/discover'

const SCREEN_WIDTH = Dimensions.get('window').width
const CARD_WIDTH = SCREEN_WIDTH * 0.32 // ~32% of screen
const CARD_HEIGHT = CARD_WIDTH * 1.5 // 2:3 aspect ratio
const SIDE_OFFSET = 20 // matches spacing.marginMobile

interface RecommendedSectionProps {
  data: DiscoverResult[]
  onAdd: (item: DiscoverResult) => void
  onRemove: (item: DiscoverResult) => void
  addingIds: Set<number>
  removingIds: Set<number>
}

// ── Individual Small Poster Card ──

interface SmallCardProps {
  item: DiscoverResult
  onAdd: (item: DiscoverResult) => void
  onRemove: (item: DiscoverResult) => void
  isAdding: boolean
  isRemoving: boolean
}

const SmallCard = memo(function SmallCard({
  item,
  onAdd,
  onRemove,
  isAdding,
  isRemoving,
}: SmallCardProps) {
  const posterUrl = getImageUrl(item.poster_path, 'w342')

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
            <Ionicons name="film-outline" size={24} color={colors.outlineVariant} />
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

      {/* Title below poster */}
      <Text style={styles.title} numberOfLines={1}>
        {item.title}
      </Text>
    </Pressable>
  )
})

// ── Recommended Section ──

function RecommendedSection({ data, onAdd, onRemove, addingIds, removingIds }: RecommendedSectionProps) {
  const renderItem = useCallback(
    ({ item }: { item: DiscoverResult }) => (
      <SmallCard
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

  return (
    <View style={styles.section}>
      {/* Section header */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recommended for You</Text>
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
  listContent: {
    paddingHorizontal: SIDE_OFFSET,
  },

  // ── Card ──
  card: {
    width: CARD_WIDTH,
  },
  posterContainer: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 12,
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
  topScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 56,
  },

  // ── Badges ──
  discoverBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.82)', // higher opacity for readability over bright posters
    paddingHorizontal: 8,
    paddingVertical: spacing.unit,
    borderRadius: borderRadius.full,
  },
  discoverBadgeText: {
    fontFamily: 'Inter',
    fontSize: 10,
    fontWeight: '600',
    color: colors.onSurface,
    letterSpacing: 0.3,
  },
  inLibraryBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  toggleButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },

  // ── Info ──
  title: {
    fontFamily: 'Inter',
    fontSize: 12,
    fontWeight: '600',
    color: colors.onSurface,
    marginTop: 8,
    lineHeight: 16,
  },
})

export default RecommendedSection
