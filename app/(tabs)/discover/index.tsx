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
  Keyboard,
  Alert,
} from 'react-native'
import { FlashList } from '@shopify/flash-list'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { router, usePathname } from 'expo-router'
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
import { useTheme } from '@/contexts/ThemeContext'
import { typography, spacing, borderRadius } from '@/theme'
import type { DiscoverResult, MediaFilter } from '@/lib/queries/discover'

// ── Main Screen ──

export default function DiscoverScreen() {
  const insets = useSafeAreaInsets()
  const [searchText, setSearchText] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [isSearchVisible, setIsSearchVisible] = useState(false)
  const [addingIds, setAddingIds] = useState<Set<number>>(new Set())
  const [removingIds, setRemovingIds] = useState<Set<number>>(new Set())
  const localLibraryRef = useRef<Map<number, 'added' | 'removed'>>(new Map())
  const inputRef = useRef<TextInput>(null)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { colors } = useTheme()

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
  const pathname = usePathname()
  const prevPathname = useRef(pathname)
  useEffect(() => {
    if (prevPathname.current !== pathname) {
      prevPathname.current = pathname
      if (pathname === '/(tabs)/discover') {
        localLibraryRef.current = new Map()
        refetch()
      }
    }
  }, [pathname, refetch])

  const { data: searchResults, isLoading: searchLoading } = useSearch(
    isSearching ? debouncedQuery : '',
    'all'
  )
  const addMutation = useAddToLibrary()
  const removeMutation = useRemoveFromLibrary()

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
          console.log('✅ [DiscoverScreen] Add mutation succeeded')
        },
        onError: (error: Error) => {
          console.error('❌ [DiscoverScreen] Add error:', error.message)
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
          console.log('✅ [DiscoverScreen] Remove mutation succeeded')
        },
        onError: (error: Error) => {
          console.error('❌ [DiscoverScreen] Remove error:', error.message)
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

  const clearSearch = useCallback(() => {
    setSearchText('')
    setDebouncedQuery('')
    setIsSearchVisible(false)
    inputRef.current?.blur()
    Keyboard.dismiss()
  }, [])

  // ── Search bar (inline, theme-aware) ──

  const SearchBar = useCallback(function SearchBar({
    visible,
    value,
    onChangeText,
    onClear,
  }: {
    visible: boolean
    value: string
    onChangeText: (text: string) => void
    onClear: () => void
  }) {
    if (!visible) return null
    return (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          marginHorizontal: spacing.marginMobile,
          marginBottom: spacing.stackSm,
          backgroundColor: colors.surfaceContainerLow,
          borderRadius: borderRadius.full,
          paddingHorizontal: spacing.gutter,
          height: 44,
          gap: spacing.stackSm,
        }}
      >
        <Ionicons name="search" size={18} color={colors.onSurfaceVariant} />
        <TextInput
          ref={inputRef}
          style={{
            flex: 1,
            fontSize: typography.bodyMd.fontSize,
            color: colors.onSurface,
            height: '100%',
          }}
          placeholder="Movies, shows and more..."
          placeholderTextColor={colors.outline}
          value={value}
          onChangeText={onChangeText}
          autoFocus
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {value.length > 0 && (
          <Pressable onPress={onClear} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={colors.onSurfaceVariant} />
          </Pressable>
        )}
      </View>
    )
  }, [colors])

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

  // ── Footer: trending/recommended sections (only when not searching) ──
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

        // TopAppBar
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
        iconButton: {
          padding: 8,
          borderRadius: borderRadius.full,
          justifyContent: 'center',
          alignItems: 'center',
        },
        iconButtonActive: {
          backgroundColor: colors.surfaceContainerHigh,
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
      }),
    [colors]
  )

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
      {/* TopAppBar */}
      <View style={styles.topAppBar}>
        <Text style={styles.topAppBarTitle}>Discover</Text>
        <Pressable
          style={[styles.iconButton, isSearchVisible && styles.iconButtonActive]}
          onPress={() => {
            setIsSearchVisible((v) => !v)
            if (isSearchVisible) {
              setSearchText('')
              setDebouncedQuery('')
            }
          }}
        >
          <Ionicons
            name={isSearchVisible ? 'close' : 'search'}
            size={24}
            color={isSearchVisible ? colors.onSurface : colors.primary}
          />
        </Pressable>
      </View>

      {/* Search bar — outside FlashList for stable refs */}
      <SearchBar
        visible={isSearchVisible}
        value={searchText}
        onChangeText={setSearchText}
        onClear={() => setSearchText('')}
      />

      {/* Single FlashList — Search/genre above, trending in footer */}
      <FlashList
        data={isSearching ? (searchResults || []) : []}
        keyExtractor={searchKeyExtractor}
        renderItem={renderSearchItem}
        ListFooterComponent={listFooterElement}
        ListEmptyComponent={
          searchLoading && isSearching ? (
            <ActivityIndicator size="large" color={colors.primary} style={styles.loadingContainer} />
          ) : (
            !isSearching ? null : undefined
          )
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
        extraData={{ addingIds, removingIds }}
      />
    </View>
  )
}
