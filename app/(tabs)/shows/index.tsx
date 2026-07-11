// ─── Shows Tab — Stitch "Shows Home" design ───

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
} from 'react-native'
import { FlashList } from '@shopify/flash-list'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { usePathname } from 'expo-router'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { useShows, useContinueWatching, useMarkWatched } from '@/lib/queries/shows'
import { useAppStore } from '@/stores/appStore'
import { getImageUrl } from '@/lib/tmdb'
import { colors, typography, spacing, borderRadius } from '@/theme'
import ShowCard from '@/components/shows/ShowCard'
import ShowListItem from '@/components/shows/ShowListItem'
import ContinueWatchingSection from '@/components/shows/ContinueWatchingSection'
import type { ShowWithUserData } from '@/lib/queries/shows'
import type { Show } from '@/types'

// ── Filter chips from Stitch design ──

type FilterKey = 'all' | 'watching' | 'up-to-date' | 'finished' | 'stopped'

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'watching', label: 'Watching' },
  { key: 'up-to-date', label: 'Up to Date' },
  { key: 'finished', label: 'Finished' },
  { key: 'stopped', label: 'Stopped' },
]

// ── Screen ──

export default function ShowsScreen() {
  const insets = useSafeAreaInsets()
  const viewMode = useAppStore((s) => s.viewMode)
  const setViewMode = useAppStore((s) => s.setViewMode)
  const showArchived = useAppStore((s) => s.showArchived)
  const toggleShowArchived = useAppStore((s) => s.toggleShowArchived)
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all')

  const { data: shows, isLoading, isRefetching, refetch } = useShows(showArchived)
  const { data: continueWatching, isLoading: cwLoading, refetch: refetchCW } = useContinueWatching()
  const markWatchedMutation = useMarkWatched()

  // Refetch when navigating back to the shows tab — syncs counters across all shows
  const pathname = usePathname()
  const prevPathname = useRef(pathname)
  useEffect(() => {
    if (prevPathname.current !== pathname) {
      prevPathname.current = pathname
      if (pathname === '/(tabs)/shows') {
        refetch()
        refetchCW()
      }
    }
  }, [pathname, refetch, refetchCW])

  const isGrid = viewMode === 'poster-grid'

  const handleMarkWatched = useCallback(
    (showId: string) => {
      markWatchedMutation.mutate(showId)
    },
    [markWatchedMutation]
  )

  const toggleViewMode = useCallback(() => {
    setViewMode(isGrid ? 'thumbnail-list' : 'poster-grid')
  }, [isGrid, setViewMode])

  const renderItem = useCallback(
    ({ item }: { item: ShowWithUserData }) => {
      if (isGrid) {
        return <ShowCard show={item} onMarkWatched={handleMarkWatched} />
      }
      return <ShowListItem show={item} onMarkWatched={handleMarkWatched} />
    },
    [isGrid, handleMarkWatched]
  )

  const keyExtractor = useCallback((item: ShowWithUserData) => item.id, [])

  const hasContinueWatching = continueWatching && continueWatching.length > 0

  // ── Filter chips + Continue Watching as ListHeader ──
  const ListHeader = useMemo(() => {
    return (
      <View>
        {hasContinueWatching && (
          <ContinueWatchingSection
            shows={continueWatching!}
            isLoading={cwLoading}
          />
        )}

        {/* Filter Chips — matching Stitch design */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterChipsContainer}
          style={styles.filterChipsScroll}
        >
          {FILTERS.map((f) => {
            const isActive = activeFilter === f.key
            return (
              <Pressable
                key={f.key}
                style={[
                  styles.filterChip,
                  isActive && styles.filterChipActive,
                ]}
                onPress={() => setActiveFilter(f.key)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    isActive && styles.filterChipTextActive,
                  ]}
                >
                  {f.label}
                </Text>
              </Pressable>
            )
          })}
        </ScrollView>
      </View>
    )
  }, [hasContinueWatching, continueWatching, cwLoading, activeFilter])

  const emptyState = useMemo(() => {
    if (isLoading) return null
    return (
      <View style={styles.emptyState}>
        <Ionicons name="tv-outline" size={48} color={colors.outline} />
        <Text style={styles.emptyTitle}>No shows yet</Text>
        <Text style={styles.emptySubtitle}>
          Import your TV Time data or start adding shows from Discover
        </Text>
      </View>
    )
  }, [isLoading])

  // Loading state
  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading your shows...</Text>
      </View>
    )
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* TopAppBar — matches Stitch design */}
      <View style={styles.topAppBar}>
        <View style={styles.topAppBarLeft}>
          <Ionicons name="menu" size={24} color={colors.primary} />
          <Text style={styles.topAppBarTitle}>BingeTime</Text>
        </View>
        <View style={styles.topAppBarRight}>
          <Pressable
            onPress={toggleViewMode}
            style={styles.topAppBarButton}
          >
            <Ionicons
              name={isGrid ? 'grid-outline' : 'list-outline'}
              size={20}
              color={colors.onSurfaceVariant}
            />
          </Pressable>
          <Pressable style={styles.topAppBarButton}>
            <Ionicons name="search-outline" size={20} color={colors.onSurfaceVariant} />
          </Pressable>
        </View>
      </View>

      {/* Content */}
      <FlashList
        data={shows || []}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        numColumns={isGrid ? 2 : 1}
        key={isGrid ? 'grid' : 'list'}
        estimatedItemSize={isGrid ? 280 : 100}
        contentContainerStyle={[
          styles.listContent,
          shows?.length === 0 && styles.listContentEmpty,
        ]}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={emptyState}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  )
}

// ── Styles ──

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: colors.outline,
    marginTop: spacing.stackSm,
  },

  // TopAppBar — fixed header matching Stitch
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
    gap: 8,
  },
  topAppBarTitle: {
    fontFamily: 'Inter',
    fontSize: typography.headlineMd.fontSize,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: -0.01,
  },
  topAppBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  topAppBarButton: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Filter Chips
  filterChipsScroll: {
    marginTop: spacing.stackSm,
    marginBottom: spacing.stackSm,
  },
  filterChipsContainer: {
    paddingHorizontal: spacing.marginMobile,
    gap: spacing.stackSm,
  },
  filterChip: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceContainerHigh,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
  },
  filterChipText: {
    fontFamily: 'Inter',
    fontSize: typography.labelMd.fontSize,
    fontWeight: '600',
    lineHeight: typography.labelMd.lineHeight,
    letterSpacing: typography.labelMd.letterSpacing,
    color: colors.onSurfaceVariant,
  },
  filterChipTextActive: {
    color: colors.onPrimary,
  },

  // List
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
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.onSurface,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.outline,
    textAlign: 'center',
    lineHeight: 20,
  },
})
