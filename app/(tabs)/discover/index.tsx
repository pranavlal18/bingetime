// ─── Discover Tab — Stitch "Discover Content" design ───
// Sections: Trending Now (large posters) + Recommended for You (small posters)

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Keyboard,
  Alert,
} from 'react-native'
import { FlashList } from '@shopify/flash-list'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import {
  useTrending,
  useSearch,
  useAddToLibrary,
  useRemoveFromLibrary,
} from '@/lib/queries/discover'
import { getImageUrl } from '@/lib/tmdb'
import DiscoverCard from '@/components/discover/DiscoverCard'
import TrendingSection from '@/components/discover/TrendingSection'
import RecommendedSection from '@/components/discover/RecommendedSection'
import { colors, typography, spacing, borderRadius } from '@/theme'
import type { DiscoverResult, MediaFilter } from '@/lib/queries/discover'

// ── Genre chips from Stitch design ──
const GENRES = ['For You', 'Sci-Fi', 'Drama', 'Comedy', 'Horror', 'Thriller', 'Animation']

// ── Main Screen ──

export default function DiscoverScreen() {
  const insets = useSafeAreaInsets()
  const [searchText, setSearchText] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [activeGenre, setActiveGenre] = useState('For You')
  const [addingIds, setAddingIds] = useState<Set<number>>(new Set())
  const [removingIds, setRemovingIds] = useState<Set<number>>(new Set())
  const inputRef = useRef<TextInput>(null)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounce search
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => {
      setDebouncedQuery(searchText.trim())
    }, 300)
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
    }
  }, [searchText])

  const isSearching = debouncedQuery.length > 0

  const { data: trending, isLoading: trendingLoading, isRefetching, refetch } = useTrending('all')
  const { data: searchResults, isLoading: searchLoading } = useSearch(
    isSearching ? debouncedQuery : '',
    'all'
  )
  const addMutation = useAddToLibrary()
  const removeMutation = useRemoveFromLibrary()

  // Split trending into two sets for visual variety
  const trendingForYou = useMemo(() => {
    if (!trending) return []
    return trending.slice(0, Math.ceil(trending.length / 2))
  }, [trending])

  const recommended = useMemo(() => {
    if (!trending) return []
    return trending.slice(Math.ceil(trending.length / 2))
  }, [trending])

  const handleAdd = useCallback(
    (item: DiscoverResult) => {
      setAddingIds((prev) => new Set(prev).add(item.tmdbId))
      addMutation.mutate(item, {
        onSuccess: () => {
          console.log('✅ [DiscoverScreen] Add mutation succeeded')
        },
        onError: (error: Error) => {
          console.error('❌ [DiscoverScreen] Add error:', error.message)
          Alert.alert('Failed to add', error.message)
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
      setRemovingIds((prev) => new Set(prev).add(item.tmdbId))
      removeMutation.mutate(item, {
        onSuccess: () => {
          console.log('✅ [DiscoverScreen] Remove mutation succeeded')
        },
        onError: (error: Error) => {
          console.error('❌ [DiscoverScreen] Remove error:', error.message)
          Alert.alert('Failed to remove', error.message)
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

  const clearSearch = useCallback(() => {
    setSearchText('')
    setDebouncedQuery('')
    inputRef.current?.blur()
    Keyboard.dismiss()
  }, [])

  // ── Search results render ──

  const renderSearchItem = useCallback(
    ({ item }: { item: DiscoverResult }) => (
      <DiscoverCard 
        item={item} 
        onAdd={handleAdd} 
        onRemove={handleRemove}
        isAdding={addingIds.has(item.tmdbId)} 
        isRemoving={removingIds.has(item.tmdbId)}
      />
    ),
    [handleAdd, handleRemove, addingIds, removingIds]
  )

  const searchKeyExtractor = useCallback((item: DiscoverResult) => item.tmdbId.toString(), [])

  // ── Loading state ──

  if (trendingLoading && !isSearching) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Discovering content...</Text>
      </View>
    )
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* TopAppBar — matches HTML reference */}
      <View style={styles.topAppBar}>
        <View style={styles.topAppBarLeft}>
          <Pressable style={styles.iconButton}>
            <Ionicons name="menu" size={24} color={colors.primary} />
          </Pressable>
          <Text style={styles.topAppBarTitle}>BingeTime</Text>
        </View>
        <Pressable style={styles.iconButton}>
          <Ionicons name="search" size={24} color={colors.primary} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Pinned Search Bar — refactored to align with HTML */}
        <View style={styles.searchContainer}>
          <View style={styles.glassSearch}>
            <Ionicons name="search" size={18} color={colors.outline} />
            <TextInput
              ref={inputRef}
              style={styles.searchInput}
              placeholder="Movies, shows and more..."
              placeholderTextColor={colors.outline}
              value={searchText}
              onChangeText={setSearchText}
            />
            <Ionicons name="mic" size={18} color={colors.outline} />
          </View>
        </View>

        {/* Genre Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.genreChipsContainer}
        >
          {GENRES.map((genre) => {
            const isActive = activeGenre === genre
            return (
              <Pressable
                key={genre}
                style={[styles.genreChip, isActive && styles.genreChipActive]}
                onPress={() => setActiveGenre(genre)}
              >
                <Text style={[styles.genreChipText, isActive && styles.genreChipTextActive]}>
                  {genre}
                </Text>
              </Pressable>
            )
          })}
        </ScrollView>

        {/* ── Content ── */}
        {isSearching ? (
          searchLoading ? (
            <ActivityIndicator size="large" color={colors.primary} style={styles.loadingContainer} />
          ) : (
            <FlashList
              data={searchResults || []}
              keyExtractor={searchKeyExtractor}
              renderItem={renderSearchItem}
              estimatedItemSize={92}
              contentContainerStyle={styles.listContent}
            />
          )
        ) : (
          <View>
            <TrendingSection
              data={trendingForYou}
              onAdd={handleAdd}
              onRemove={handleRemove}
              addingIds={addingIds}
              removingIds={removingIds}
            />
            <RecommendedSection
              data={recommended}
              onAdd={handleAdd}
              onRemove={handleRemove}
              addingIds={addingIds}
              removingIds={removingIds}
            />
            <View style={{ height: 32 }} />
          </View>
        )}
      </ScrollView>
    </View>
  )
}

// ── Styles ──

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  // TopAppBar
  topAppBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.marginMobile,
    height: 64,
    backgroundColor: 'rgba(21,18,27,0.8)',
  },
  topAppBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  topAppBarTitle: {
    fontFamily: 'Inter',
    fontSize: 24,
    fontWeight: '700',
    color: colors.primary,
  },
  iconButton: {
    padding: 8,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    paddingHorizontal: spacing.marginMobile,
    paddingVertical: spacing.stackSm,
  },
  glassSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(26,29,36,0.8)',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.onSurface,
  },
  genreChipsContainer: {
    paddingHorizontal: spacing.marginMobile,
    gap: 12,
    paddingBottom: spacing.stackMd,
  },
  genreChip: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1,
    borderColor: 'rgba(148,142,160,0.3)',
  },
  genreChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  genreChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
  },
  genreChipTextActive: {
    color: colors.onPrimary,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: colors.outline,
    marginTop: spacing.stackSm,
  },

  // Search list
  listContent: {
    paddingHorizontal: spacing.marginMobile,
    paddingBottom: 24,
  },
  listContentEmpty: {
    flex: 1,
    justifyContent: 'center',
  },

  // Empty
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.onSurface,
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.outline,
    textAlign: 'center',
    lineHeight: 20,
  },
})
