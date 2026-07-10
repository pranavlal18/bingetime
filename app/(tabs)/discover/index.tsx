// ─── Discover Tab — search, trending, add-to-library ───

import { useState, useCallback, useEffect, useRef } from 'react'
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Keyboard,
} from 'react-native'
import { FlashList } from '@shopify/flash-list'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import {
  useTrending,
  useSearch,
  useAddToLibrary,
} from '@/lib/queries/discover'
import DiscoverCard from '@/components/discover/DiscoverCard'
import type { DiscoverResult, MediaFilter } from '@/lib/queries/discover'

const FILTERS: { label: string; value: MediaFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'TV', value: 'tv' },
  { label: 'Movies', value: 'movie' },
]

export default function DiscoverScreen() {
  const insets = useSafeAreaInsets()

  // ── Search state ──
  const [searchText, setSearchText] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [filter, setFilter] = useState<MediaFilter>('all')
  const [addingIds, setAddingIds] = useState<Set<number>>(new Set())
  const inputRef = useRef<TextInput>(null)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounce search input (300ms)
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => {
      setDebouncedQuery(searchText.trim())
    }, 300)
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
    }
  }, [searchText])

  // ── Queries ──
  const isSearching = debouncedQuery.length > 0

  const {
    data: trending,
    isLoading: trendingLoading,
    isRefetching: trendingRefetching,
    refetch: refetchTrending,
  } = useTrending(isSearching ? 'all' : filter)

  const {
    data: searchResults,
    isLoading: searchLoading,
    isRefetching: searchRefetching,
    refetch: refetchSearch,
  } = useSearch(debouncedQuery, filter)

  const addMutation = useAddToLibrary()

  // ── Current data ──
  const data = isSearching ? searchResults : trending
  const isLoading = isSearching ? searchLoading : trendingLoading
  const isRefetching = isSearching ? searchRefetching : trendingRefetching
  const refetch = useCallback(() => {
    if (isSearching) return refetchSearch()
    return refetchTrending()
  }, [isSearching, refetchSearch, refetchTrending])

  // ── Add to library handler ──
  const handleAdd = useCallback(
    (item: DiscoverResult) => {
      if (addingIds.has(item.tmdbId)) return

      setAddingIds((prev) => new Set(prev).add(item.tmdbId))
      addMutation.mutate(item, {
        onSettled: () => {
          setAddingIds((prev) => {
            const next = new Set(prev)
            next.delete(item.tmdbId)
            return next
          })
        },
      })
    },
    [addMutation, addingIds]
  )

  // ── Render item ──
  const renderItem = useCallback(
    ({ item }: { item: DiscoverResult }) => (
      <DiscoverCard
        item={item}
        onAdd={handleAdd}
        isAdding={addingIds.has(item.tmdbId)}
      />
    ),
    [handleAdd, addingIds]
  )

  const keyExtractor = useCallback(
    (item: DiscoverResult) => `${item.mediaType}-${item.tmdbId}`,
    []
  )

  // ── Clear search ──
  const clearSearch = useCallback(() => {
    setSearchText('')
    setDebouncedQuery('')
    inputRef.current?.blur()
    Keyboard.dismiss()
  }, [])

  // ── Empty state ──
  const emptyState = (
    <View style={styles.emptyState}>
      <Ionicons
        name={isSearching ? 'search-outline' : 'compass-outline'}
        size={48}
        color="#444"
      />
      <Text style={styles.emptyTitle}>
        {isSearching ? 'No results found' : 'Discover new shows & movies'}
      </Text>
      <Text style={styles.emptySubtitle}>
        {isSearching
          ? 'Try a different search term or filter'
          : 'Search for your favorite titles or browse trending content'}
      </Text>
    </View>
  )

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Discover</Text>
      </View>

      {/* Search bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color="#666" />
          <TextInput
            ref={inputRef}
            style={styles.searchInput}
            placeholder="Search shows & movies..."
            placeholderTextColor="#666"
            value={searchText}
            onChangeText={setSearchText}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchText.length > 0 && (
            <Pressable onPress={clearSearch} style={styles.clearButton}>
              <Ionicons name="close-circle" size={18} color="#666" />
            </Pressable>
          )}
        </View>
      </View>

      {/* Filters */}
      <View style={styles.filtersRow}>
        {FILTERS.map((f) => (
          <Pressable
            key={f.value}
            style={[
              styles.filterChip,
              filter === f.value && styles.filterChipActive,
            ]}
            onPress={() => setFilter(f.value)}
          >
            <Text
              style={[
                styles.filterChipText,
                filter === f.value && styles.filterChipTextActive,
              ]}
            >
              {f.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Results */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6C63FF" />
          <Text style={styles.loadingText}>
            {isSearching ? 'Searching...' : 'Loading trending...'}
          </Text>
        </View>
      ) : (
        <FlashList
          data={data || []}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          estimatedItemSize={92}
          contentContainerStyle={[
            styles.listContent,
            (data?.length ?? 0) === 0 && styles.listContentEmpty,
          ]}
          ListEmptyComponent={emptyState}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor="#6C63FF"
              colors={['#6C63FF']}
            />
          }
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F0F',
  },

  // Header
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFF',
  },

  // Search bar
  searchContainer: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#FFF',
    height: '100%',
  },
  clearButton: {
    padding: 4,
  },

  // Filters
  filtersRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#1A1A1A',
  },
  filterChipActive: {
    backgroundColor: '#6C63FF',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
  },
  filterChipTextActive: {
    color: '#FFF',
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: '#888',
    marginTop: 12,
  },

  // List
  listContent: {
    paddingHorizontal: 16,
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
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    lineHeight: 20,
  },
})
