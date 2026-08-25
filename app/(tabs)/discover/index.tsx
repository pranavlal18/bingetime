// ─── Discover Tab — Always-visible search + recent searches + filter chips ───

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native'
import { FlashList } from '@shopify/flash-list'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect } from 'expo-router'
import {
  useTrending,
  useSearch,
  useGenres,
  useAddToLibrary,
  useRemoveFromLibrary,
} from '@/lib/queries/discover'
import DiscoverCard from '@/components/discover/DiscoverCard'
import TrendingSection from '@/components/discover/TrendingSection'
import RecommendedSection from '@/components/discover/RecommendedSection'
import SkeletonBlock from '@/components/skeletons/SkeletonBlock'
import SearchBar from '@/components/discover/SearchBar'
import FilterChips from '@/components/discover/FilterChips'
import RecentSearchesRow from '@/components/discover/RecentSearchesRow'
import { useSearchStore } from '@/stores/searchStore'
import { useTheme } from '@/contexts/ThemeContext'
import { spacing, borderRadius } from '@/theme'
import type { DiscoverResult, MediaFilter } from '@/lib/queries/discover'
import { router } from 'expo-router'
import { hapticLight } from '@/utils/haptics'

const SCREEN_WIDTH = Dimensions.get('window').width

// ── Main Screen ──

export default function DiscoverScreen() {
  const insets = useSafeAreaInsets()
  const [searchText, setSearchText] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [filter, setFilter] = useState<MediaFilter>('all')
  const [addingIds, setAddingIds] = useState<Set<number>>(new Set())
  const [removingIds, setRemovingIds] = useState<Set<number>>(new Set())
  const localLibraryRef = useRef<Map<number, 'added' | 'removed'>>(new Map())
  const inputRef = useRef<TextInput>(null)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { colors } = useTheme()
  const recents = useSearchStore((s) => s.recents)
  const addRecent = useSearchStore((s) => s.addRecent)
  const removeRecent = useSearchStore((s) => s.removeRecent)
  const clearAllRecents = useSearchStore((s) => s.clearAll)

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

  // Refetch trending when navigating back to this tab
  // Clear local library tracking so previously-added items disappear
  useFocusEffect(
    useCallback(() => {
      localLibraryRef.current = new Map()
      refetch()
    }, [refetch])
  )

  const { data: searchResults, isLoading: searchLoading } = useSearch(
    isSearching ? debouncedQuery : '',
    filter
  )
  const { data: genreData } = useGenres('movie')
  const addMutation = useAddToLibrary()
  const removeMutation = useRemoveFromLibrary()

  // Persist successful searches to recent history (deduped, cap 8)
  useEffect(() => {
    if (isSearching && !searchLoading && searchResults && searchResults.length > 0) {
      addRecent(debouncedQuery)
    }
  }, [isSearching, searchLoading, searchResults, debouncedQuery, addRecent])

  // Filter trending list to exclude items already in the library
  // (Unless they were added or removed in the current session)
  const filteredTrending = useMemo(() => {
    if (!trending) return []
    return trending.filter((item) => {
      const localStatus = localLibraryRef.current.get(item.tmdbId)
      if (localStatus === 'added') return true
      if (localStatus === 'removed') return true
      return !item.inLibrary
    })
  }, [trending])

  // Split trending into two sets for visual variety
  const trendingForYou = useMemo(() => {
    return filteredTrending.slice(0, Math.ceil(filteredTrending.length / 2))
  }, [filteredTrending])

  const recommended = useMemo(() => {
    return filteredTrending.slice(Math.ceil(filteredTrending.length / 2))
  }, [filteredTrending])

  const handleAdd = useCallback(
    (item: DiscoverResult) => {
      localLibraryRef.current.set(item.tmdbId, 'added')
      setAddingIds((prev) => new Set(prev).add(item.tmdbId))
      addMutation.mutate(item, {
        onSuccess: () => {
          if (__DEV__) console.log('✅ [DiscoverScreen] Add mutation succeeded')
        },
        onError: (error: Error) => {
          if (__DEV__) console.error('❌ [DiscoverScreen] Add error:', error.message)
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
        onSuccess: () => {
          if (__DEV__) console.log('✅ [DiscoverScreen] Remove mutation succeeded')
        },
        onError: (error: Error) => {
          if (__DEV__) console.error('❌ [DiscoverScreen] Remove error:', error.message)
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

  // ── Search results render ──

  const addingRef = useRef(addingIds)
  addingRef.current = addingIds
  const removingRef = useRef(removingIds)
  removingRef.current = removingIds

  const renderSearchItem = useCallback(
    ({ item }: { item: DiscoverResult }) => {
      const localStatus = localLibraryRef.current.get(item.tmdbId)
      const effectiveInLibrary = localStatus === 'added' || (localStatus !== 'removed' && item.inLibrary)

      return (
        <DiscoverCard
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

  const searchKeyExtractor = useCallback((item: DiscoverResult) => item.tmdbId.toString(), [])

  const genreChips = useMemo(() => {
    if (isSearching) return null
    const genres = genreData?.genres ?? []
    if (genres.length === 0) return null
    return (
      <View style={{ marginBottom: 16 }}>
        <Text
          style={{
            fontFamily: 'Inter',
            fontSize: 14,
            fontWeight: '700',
            color: colors.onSurface,
            paddingHorizontal: spacing.marginMobile,
            marginBottom: 10,
          }}
        >
          Browse genres
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: spacing.marginMobile, gap: 8 }}
        >
          {genres.slice(0, 12).map((g) => (
            <Pressable
              key={g.id}
              onPress={() => {
                hapticLight()
                router.push(`/discover/genre?id=${g.id}&name=${encodeURIComponent(g.name)}&type=movie`)
              }}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: borderRadius.full,
                backgroundColor: colors.surfaceContainer,
                borderWidth: 1,
                borderColor: colors.outlineVariant,
              }}
            >
              <Text style={{ fontFamily: 'Inter', fontSize: 13, fontWeight: '600', color: colors.onSurfaceVariant }}>
                {g.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    )
  }, [isSearching, genreData, colors])

  const listHeaderElement = useMemo(() => {
    if (!isSearching && recents.length > 0) {
      return (
        <>
          {genreChips}
          <RecentSearchesRow
            recents={recents}
            onSelect={(q) => setSearchText(q)}
            onRemove={removeRecent}
            onClearAll={clearAllRecents}
          />
        </>
      )
    }
    if (isSearching) {
      return <FilterChips value={filter} onChange={setFilter} />
    }
    return genreChips
  }, [isSearching, recents, removeRecent, clearAllRecents, filter, genreChips])

  const listFooterElement = useMemo(() => {
    if (isSearching) return null
    return (
      <>
        <TrendingSection
          data={trendingForYou}
          onAdd={handleAdd}
          onRemove={handleRemove}
          addingIds={addingIds}
          removingIds={removingIds}
          localLibrary={localLibraryRef.current}
        />
        <RecommendedSection
          data={recommended}
          onAdd={handleAdd}
          onRemove={handleRemove}
          addingIds={addingIds}
          removingIds={removingIds}
          localLibrary={localLibraryRef.current}
        />
        <View style={{ height: 32 }} />
      </>
    )
  }, [isSearching, trendingForYou, recommended, handleAdd, handleRemove, addingIds, removingIds])

  // ── Styles ──

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.background,
        },
        centered: {
          justifyContent: 'center',
          alignItems: 'center',
        },
        // TopAppBar — title only, search is always-visible below
        topAppBar: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: spacing.marginMobile,
          height: 64,
          backgroundColor: colors.surfaceContainer,
        },
        topAppBarTitle: {
          fontFamily: 'Inter',
          fontSize: 24,
          fontWeight: '700',
          color: colors.primary,
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
          paddingBottom: 24,
        },
        emptyState: {
          paddingTop: 48,
          alignItems: 'center',
          gap: 12,
          paddingHorizontal: spacing.marginMobile,
        },
        emptyTitle: {
          fontFamily: 'Inter',
          fontSize: 16,
          fontWeight: '700',
          color: colors.onSurface,
          textAlign: 'center',
        },
        emptySubtitle: {
          fontFamily: 'Inter',
          fontSize: 13,
          color: colors.outline,
          textAlign: 'center',
          lineHeight: 18,
        },
      }),
    [colors]
  )

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* TopAppBar — static title, no toggle */}
      <View style={styles.topAppBar}>
        <Text style={styles.topAppBarTitle}>Discover</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Always-visible search bar */}
      <SearchBar
        ref={inputRef}
        value={searchText}
        onChangeText={setSearchText}
        onClear={() => setSearchText('')}
      />

      {trendingLoading && !isSearching ? (
        /* ── Skeleton layout ── */
        <View style={{ flex: 1, paddingTop: 8 }}>
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Trending section header */}
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingHorizontal: 20,
                marginBottom: 12,
              }}
            >
              <SkeletonBlock width={160} height={22} borderRadius={4} />
              <SkeletonBlock width={60} height={16} borderRadius={4} />
            </View>

            {/* Trending posters horizontal */}
            <View style={{ flexDirection: 'row', paddingLeft: 20, gap: 16, marginBottom: 24 }}>
              <SkeletonBlock
                width={SCREEN_WIDTH * 0.58}
                height={SCREEN_WIDTH * 0.58 * 1.5}
                borderRadius={16}
              />
              <SkeletonBlock
                width={SCREEN_WIDTH * 0.58}
                height={SCREEN_WIDTH * 0.58 * 1.5}
                borderRadius={16}
              />
            </View>

            {/* Recommended section header */}
            <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
              <SkeletonBlock width={200} height={22} borderRadius={4} />
            </View>

            {/* Recommended posters horizontal */}
            <View style={{ flexDirection: 'row', paddingLeft: 20, gap: 16 }}>
              <SkeletonBlock
                width={SCREEN_WIDTH * 0.32}
                height={SCREEN_WIDTH * 0.32 * 1.5}
                borderRadius={12}
              />
              <SkeletonBlock
                width={SCREEN_WIDTH * 0.32}
                height={SCREEN_WIDTH * 0.32 * 1.5}
                borderRadius={12}
              />
              <SkeletonBlock
                width={SCREEN_WIDTH * 0.32}
                height={SCREEN_WIDTH * 0.32 * 1.5}
                borderRadius={12}
              />
            </View>
          </ScrollView>
        </View>
      ) : (
        /* ── Single FlashList — results when searching, recents+trending in header/footer when idle ── */
        <FlashList
          data={isSearching ? searchResults || [] : []}
          keyExtractor={searchKeyExtractor}
          renderItem={renderSearchItem}
          ListHeaderComponent={listHeaderElement}
          ListFooterComponent={listFooterElement}
          ListEmptyComponent={
            searchLoading && isSearching ? (
              <ActivityIndicator size="large" color={colors.primary} style={styles.loadingContainer} />
            ) : isSearching && !searchLoading && (searchResults?.length ?? 0) === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="search-outline" size={48} color={colors.outlineVariant} />
                <Text style={styles.emptyTitle}>No results for “{debouncedQuery}”</Text>
                <Text style={styles.emptySubtitle}>Try another title or add a year{'\n'}e.g. “Dune 2021”</Text>
              </View>
            ) : !isSearching ? null : undefined
          }
          contentContainerStyle={[
            styles.listContent,
            !isSearching && { flexGrow: 1 },
            isSearching && { paddingHorizontal: spacing.marginMobile },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          extraData={{ addingIds, removingIds, filter, recents }}
        />
      )}
    </View>
  )
}
