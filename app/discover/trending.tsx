// ─── Trending Now — Full-screen grid of all trending content ───

import { useCallback, useState, useRef, useMemo, memo } from 'react'
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native'
import { FlashList } from '@shopify/flash-list'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import {
  useTrending,
  useAddToLibrary,
  useRemoveFromLibrary,
} from '@/lib/queries/discover'
import { getImageUrl } from '@/lib/tmdb'
import { typography, spacing, borderRadius } from '@/theme'
import { useTheme } from '@/contexts/ThemeContext'
import type { DiscoverResult, MediaFilter } from '@/lib/queries/discover'

const SCREEN_WIDTH = Dimensions.get('window').width
const SIDE_OFFSET = 20
const GAP = 16
const CARD_WIDTH = (SCREEN_WIDTH - SIDE_OFFSET * 2 - GAP) / 2
const CARD_HEIGHT = CARD_WIDTH * 1.5 // 2:3 aspect ratio

const FILTERS: { key: MediaFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'tv', label: 'TV' },
  { key: 'movie', label: 'Movies' },
]

// ── Individual Grid Card ──

interface GridCardProps {
  item: DiscoverResult
  onAdd: (item: DiscoverResult) => void
  onRemove: (item: DiscoverResult) => void
  isAdding: boolean
  isRemoving: boolean
  isInLibrary: boolean
}

const GridCard = memo(function GridCard({ item, onAdd, onRemove, isAdding, isRemoving, isInLibrary }: GridCardProps) {
  const { colors } = useTheme()
  const posterUrl = getImageUrl(item.poster_path, 'w342')
  const isLoading = isAdding || isRemoving

  const cardStyles = useMemo(() => StyleSheet.create({
    card: {
      width: CARD_WIDTH,
      marginBottom: GAP,
    },
    posterContainer: {
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      borderRadius: borderRadius.md,
      overflow: 'hidden',
      backgroundColor: colors.surfaceDim,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
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
    toggleButton: {
      position: 'absolute',
      top: 8,
      right: 8,
      width: 26,
      height: 26,
      borderRadius: 13,
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
    title: {
      fontFamily: 'Inter',
      fontSize: 13,
      fontWeight: '600',
      color: colors.onSurface,
      marginTop: 8,
      lineHeight: 18,
    },
    subtitle: {
      fontFamily: 'Inter',
      fontSize: 11,
      fontWeight: '400',
      color: colors.onSurfaceVariant,
      marginTop: 2,
      opacity: 0.7,
    },
  }), [colors])

  const handlePress = useCallback(() => {
    if (item.mediaType === 'tv') {
      router.push(`/show/${item.libraryId || item.tmdbId}`)
    } else {
      router.push(`/movie/${item.libraryId || item.tmdbId}`)
    }
  }, [item])

  return (
    <Pressable style={cardStyles.card} onPress={handlePress}>
      <View style={cardStyles.posterContainer}>
        {posterUrl ? (
          <Image
            source={{ uri: posterUrl }}
            style={cardStyles.poster}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={cardStyles.posterPlaceholder}>
            <Ionicons name="film-outline" size={28} color={colors.outlineVariant} />
          </View>
        )}

        <Pressable
          style={[
            cardStyles.toggleButton,
            isInLibrary && cardStyles.toggleButtonActive,
          ]}
          onPress={() => (isInLibrary ? onRemove(item) : onAdd(item))}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons
              name={isInLibrary ? 'checkmark' : 'add'}
              size={16}
              color="#fff"
            />
          )}
        </Pressable>
      </View>

      <Text style={cardStyles.title} numberOfLines={1}>
        {item.title}
      </Text>
      <Text style={cardStyles.subtitle} numberOfLines={1}>
        {item.mediaType === 'tv' ? 'TV Series' : 'Movie'}
        {item.year ? ` • ${item.year}` : ''}
      </Text>
    </Pressable>
  )
})

// ── Screen ──

export default function TrendingScreen() {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const [filter, setFilter] = useState<MediaFilter>('all')

  const { data, isLoading, isRefetching, refetch } = useTrending(filter)
  const addMutation = useAddToLibrary()
  const removeMutation = useRemoveFromLibrary()
  const [addingIds, setAddingIds] = useState<Set<number>>(new Set())
  const [removingIds, setRemovingIds] = useState<Set<number>>(new Set())
  const localLibraryRef = useRef<Map<number, 'added' | 'removed'>>(new Map())

  // Refs for stable renderItem
  const addingRef = useRef(addingIds)
  addingRef.current = addingIds
  const removingRef = useRef(removingIds)
  removingRef.current = removingIds

  const handleAdd = useCallback(
    (item: DiscoverResult) => {
      localLibraryRef.current.set(item.tmdbId, 'added')
      setAddingIds((prev) => new Set(prev).add(item.tmdbId))
      addMutation.mutate(item, {
        onError: (error: Error) => {
          if (__DEV__) console.error('[TrendingScreen] Add error:', error.message)
          Alert.alert('Failed to add', error.message)
          localLibraryRef.current.delete(item.tmdbId)
        },
        onSettled: () => {
          setAddingIds((prev) => {
            const next = new Set(prev)
            next.delete(item.tmdbId)
            return next
          })
        },
      })
    },
    [addMutation]
  )

  const handleRemove = useCallback(
    (item: DiscoverResult) => {
      localLibraryRef.current.set(item.tmdbId, 'removed')
      setRemovingIds((prev) => new Set(prev).add(item.tmdbId))
      removeMutation.mutate(item, {
        onError: (error: Error) => {
          if (__DEV__) console.error('[TrendingScreen] Remove error:', error.message)
          Alert.alert('Failed to remove', error.message)
          localLibraryRef.current.delete(item.tmdbId)
        },
        onSettled: () => {
          setRemovingIds((prev) => {
            const next = new Set(prev)
            next.delete(item.tmdbId)
            return next
          })
        },
      })
    },
    [removeMutation]
  )

  const renderItem = useCallback(
    ({ item }: { item: DiscoverResult }) => {
      const localStatus = localLibraryRef.current.get(item.tmdbId)
      const effectiveInLibrary = localStatus === 'added' || (localStatus !== 'removed' && item.inLibrary)

      return (
        <GridCard
          item={item}
          onAdd={handleAdd}
          onRemove={handleRemove}
          isAdding={addingRef.current.has(item.tmdbId)}
          isRemoving={removingRef.current.has(item.tmdbId)}
          isInLibrary={effectiveInLibrary}
        />
      )
    },
    [handleAdd, handleRemove]
  )

  const keyExtractor = useCallback((item: DiscoverResult) => item.tmdbId.toString(), [])

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    centered: {
      justifyContent: 'center',
      alignItems: 'center',
    },

    // ── Header ──
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.marginMobile,
      height: 56,
    },
    backButton: {
      padding: 4,
    },
    headerTitle: {
      fontFamily: 'Inter',
      fontSize: 20,
      fontWeight: '700',
      color: colors.onSurface,
    },
    headerRight: {
      width: 32,
    },

    // ── Filter chips ──
    filterRow: {
      flexDirection: 'row',
      paddingHorizontal: spacing.marginMobile,
      gap: 8,
      marginBottom: 16,
    },
    filterChip: {
      paddingHorizontal: 20,
      paddingVertical: 8,
      borderRadius: borderRadius.full,
      backgroundColor: colors.surfaceContainer,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
    },
    filterChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    filterChipText: {
      fontFamily: 'Inter',
      fontSize: 14,
      fontWeight: '600',
      color: colors.onSurfaceVariant,
    },
    filterChipTextActive: {
      color: colors.onPrimary,
    },

    // ── Grid ──
    gridContent: {
      paddingHorizontal: SIDE_OFFSET,
      paddingBottom: 24,
    },

    // ── Loading ──
    loadingText: {
      fontFamily: 'Inter',
      fontSize: 14,
      color: colors.outline,
      marginTop: spacing.stackSm,
    },

    // ── Empty ──
    emptyState: {
      paddingTop: 80,
      alignItems: 'center',
      gap: 12,
    },
    emptyTitle: {
      fontFamily: 'Inter',
      fontSize: 18,
      fontWeight: '700',
      color: colors.onSurface,
    },
    emptySubtitle: {
      fontFamily: 'Inter',
      fontSize: 14,
      color: colors.outline,
      textAlign: 'center',
    },
  }), [colors])

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading trending...</Text>
      </View>
    )
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={colors.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>Trending Now</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Filter chips */}
      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <Pressable
            key={f.key}
            style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text
              style={[
                styles.filterChipText,
                filter === f.key && styles.filterChipTextActive,
              ]}
            >
              {f.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Grid */}
      <FlashList
        data={data || []}
        keyExtractor={keyExtractor}

        renderItem={renderItem}
        numColumns={2}
        contentContainerStyle={styles.gridContent}
        showsVerticalScrollIndicator={false}
        extraData={{ addingIds, removingIds }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="film-outline" size={48} color={colors.outlineVariant} />
            <Text style={styles.emptyTitle}>Nothing trending</Text>
            <Text style={styles.emptySubtitle}>Check back later for new content</Text>
          </View>
        }
      />
    </View>
  )
}

