// ─── Shows Tab — TV Time-style Watch List + Upcoming ───

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native'
import { FlashList } from '@shopify/flash-list'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { usePathname } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useQueries } from '@tanstack/react-query'
import { useShows, useMarkWatched, deriveWatchNextEpisodes, deriveHaventWatchedEpisodes } from '@/lib/queries/shows'
import type { NextEpisodeInfo } from '@/lib/queries/shows'
import { getSeasonDetails, getShowBasicDetails } from '@/lib/tmdb'
import { useWatchedEpisodesHistory } from '@/lib/queries/episodes'
import { useUpcomingEpisodes } from '@/lib/queries/upcoming'
import { useAppStore } from '@/stores/appStore'
import { colors, typography, spacing, borderRadius } from '@/theme'
import ShowCard from '@/components/shows/ShowCard'
import EpisodeCard from '@/components/shows/EpisodeCard'
import EpisodeSection from '@/components/shows/EpisodeSection'
import ShowsTabSwitcher from '@/components/shows/ShowsTabSwitcher'
import type { ShowWithUserData } from '@/lib/queries/shows'
import type { ShowsTabKind, ShowsListItem } from '@/types'

// ── Screen ──

export default function ShowsScreen() {
  const insets = useSafeAreaInsets()
  const [activeTab, setActiveTab] = useState<ShowsTabKind>('watchlist')
  const viewMode = useAppStore((s) => s.showsViewMode)
  const setViewMode = useAppStore((s) => s.setShowsViewMode)

  // Data hooks
  const { data: shows, isLoading: showsLoading, isRefetching, refetch } = useShows()
  const { data: watchedHistory, refetch: refetchHistory } = useWatchedEpisodesHistory()
  const {
    data: upcomingSections,
    isLoading: upcomingLoading,
    isRefetching: upcomingRefetching,
    refetch: refetchUpcoming,
  } = useUpcomingEpisodes()
  const markWatchedMutation = useMarkWatched()

  const isGrid = viewMode === 'poster-grid'

  // Refetch when navigating back
  const pathname = usePathname()
  const prevPathname = useRef(pathname)
  useEffect(() => {
    if (prevPathname.current !== pathname) {
      prevPathname.current = pathname
      if (pathname === '/(tabs)/shows') {
        refetch()
        refetchHistory()
        refetchUpcoming()
      }
    }
  }, [pathname, refetch, refetchHistory, refetchUpcoming])

  // ── Watch List sections (list mode) ──

  // 1. Raw derivation: NextEpisodeInfo[] (no episode names yet)
  const rawWatchNext = useMemo(() => {
    if (!shows || isGrid) return []
    return deriveWatchNextEpisodes(shows)
  }, [shows, isGrid])

  const rawHaventWatched = useMemo(() => {
    if (!shows || isGrid) return []
    return deriveHaventWatchedEpisodes(shows)
  }, [shows, isGrid])

  // 2a. Extract unique TMDb IDs per show (for season boundary info from getShowBasicDetails)
  const showPairs = useMemo(() => {
    const seen = new Set<string>()
    return [...rawWatchNext, ...rawHaventWatched]
      .filter((ep): ep is NextEpisodeInfo & { tmdbId: number } => ep.tmdbId != null)
      .filter(ep => {
        if (seen.has(ep.showId)) return false
        seen.add(ep.showId)
        return true
      })
      .map(ep => ({ showId: ep.showId, tmdbId: ep.tmdbId }))
  }, [rawWatchNext, rawHaventWatched])

  // 2b. Extract unique (tmdbId, seasonNumber) pairs for TMDb episode name lookup
  const episodeNamePairs = useMemo(() => {
    const seen = new Set<string>()
    return [...rawWatchNext, ...rawHaventWatched]
      .filter((ep): ep is NextEpisodeInfo & { tmdbId: number } => ep.tmdbId != null)
      .filter(ep => {
        const key = `${ep.tmdbId}:${ep.seasonNumber}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      .map(ep => ({ showId: ep.showId, tmdbId: ep.tmdbId, seasonNumber: ep.seasonNumber }))
  }, [rawWatchNext, rawHaventWatched])

  // 3a. Fetch show-level details for ALL season episode counts (boundary detection)
  const showQueries = useQueries({
    queries: showPairs.map(pair => ({
      queryKey: ['tmdb', 'show-basic', pair.tmdbId],
      queryFn: () => getShowBasicDetails(pair.tmdbId),
      staleTime: 1000 * 60 * 60,
      enabled: showPairs.length > 0,
    })),
  })

  // 3b. Batch-fetch TMDb season details for episode names
  const seasonQueries = useQueries({
    queries: episodeNamePairs.map(pair => ({
      queryKey: ['tmdb', 'season-details', pair.tmdbId, pair.seasonNumber],
      queryFn: () => getSeasonDetails(pair.tmdbId, pair.seasonNumber),
      staleTime: 1000 * 60 * 60, // 1 hour — episode names don't change
      enabled: episodeNamePairs.length > 0,
    })),
  })

  // 4. Build episode name map: `${showId}:${episodeNumber}` → episode name
  const episodeNameMap = useMemo(() => {
    const map = new Map<string, string>()
    for (let i = 0; i < episodeNamePairs.length; i++) {
      const pair = episodeNamePairs[i]
      const data = seasonQueries[i]?.data
      if (!data) continue
      for (const ep of data.episodes) {
        map.set(`${pair.showId}:${ep.episode_number}`, ep.name)
      }
    }
    return map
  }, [episodeNamePairs, seasonQueries])

  // 4b. Build season structure: showId → { seasonNumber → episodeCount }
  //     Uses getShowBasicDetails (all seasons per show) for complete boundary detection
  const seasonInfoMap = useMemo(() => {
    const map = new Map<string, Map<number, number>>()
    for (let i = 0; i < showPairs.length; i++) {
      const pair = showPairs[i]
      const data = showQueries[i]?.data
      if (!data?.seasons) continue
      const seasonMap = new Map<number, number>()
      for (const season of data.seasons) {
        if (season.season_number > 0) {
          seasonMap.set(season.season_number, season.episode_count)
        }
      }
      map.set(pair.showId, seasonMap)
    }
    return map
  }, [showPairs, showQueries])

  // 5. Final mapping to ShowsListItem with season-boundary fixes + remaining count
  const watchNextEpisodes = useMemo(() => {
    return rawWatchNext
      .map((ep): ShowsListItem | null => {
        // Fix season boundary: if computeNextEpisode returned S01E11 but S01 has only 10 eps
        let sn = ep.seasonNumber
        let en = ep.episodeNumber
        const seasonCounts = seasonInfoMap.get(ep.showId)
        if (seasonCounts) {
          const limit = seasonCounts.get(sn)
          if (limit != null && en > limit) {
            // Advance to next season
            sn = sn + 1
            en = 1
            // Next season not in TMDb data — show is genuinely complete
            if (!seasonCounts.has(sn)) return null
          }
        }
        return {
          type: 'episode',
          sectionKind: 'watch-next',
          data: {
            showId: ep.showId,
            showName: ep.showName,
            posterPath: ep.posterPath,
            seasonNumber: sn,
            episodeNumber: en,
            episodeName: episodeNameMap.get(`${ep.showId}:${en}`) || null,
            totalEpisodes: ep.totalEpisodes,
            episodesRemaining: ep.episodesRemaining,
            isWatched: false,
            showStatus: ep.showStatus,
          },
        }
      })
      .filter((item): item is ShowsListItem => item !== null)
  }, [rawWatchNext, episodeNameMap, seasonInfoMap])

  const haventWatchedEpisodes = useMemo(() => {
    return rawHaventWatched
      .map((ep): ShowsListItem | null => {
        let sn = ep.seasonNumber
        let en = ep.episodeNumber
        const seasonCounts = seasonInfoMap.get(ep.showId)
        if (seasonCounts) {
          const limit = seasonCounts.get(sn)
          if (limit != null && en > limit) {
            sn = sn + 1
            en = 1
            if (!seasonCounts.has(sn)) return null
          }
        }
        return {
          type: 'episode',
          sectionKind: 'haven-watched',
          data: {
            showId: ep.showId,
            showName: ep.showName,
            posterPath: ep.posterPath,
            seasonNumber: sn,
            episodeNumber: en,
            episodeName: episodeNameMap.get(`${ep.showId}:${en}`) || null,
            totalEpisodes: ep.totalEpisodes,
            episodesRemaining: ep.episodesRemaining,
            isWatched: false,
            showStatus: ep.showStatus,
          },
        }
      })
      .filter((item): item is ShowsListItem => item !== null)
  }, [rawHaventWatched, episodeNameMap, seasonInfoMap])

  // Build flattened list for Watch List (list mode)
  const watchListItems: ShowsListItem[] = useMemo(() => {
    if (isGrid) return [] // Grid mode uses separate FlashList

    const items: ShowsListItem[] = []

    // Section: Watch Next (primary — what to watch next)
    if (watchNextEpisodes.length > 0) {
      items.push({ type: 'section-header', kind: 'watch-next', title: 'WATCH NEXT' })
      items.push(...watchNextEpisodes)
    }

    // Section: Watched History (recently watched)
    if (watchedHistory && watchedHistory.length > 0) {
      items.push({ type: 'section-header', kind: 'watched-history', title: 'WATCHED HISTORY' })
      for (const ep of watchedHistory) {
        items.push({ type: 'episode', sectionKind: 'watched-history', data: ep })
      }
    }

    // Section: Haven't Watched
    if (haventWatchedEpisodes.length > 0) {
      items.push({ type: 'section-header', kind: 'haven-watched', title: "HAVEN'T WATCHED..." })
      items.push(...haventWatchedEpisodes)
    }

    return items
  }, [watchedHistory, watchNextEpisodes, haventWatchedEpisodes, isGrid])

  // Build flattened list for Upcoming tab
  const upcomingItems: ShowsListItem[] = useMemo(() => {
    if (!upcomingSections || upcomingSections.length === 0) return []

    const items: ShowsListItem[] = []
    for (const section of upcomingSections) {
      items.push({ type: 'section-header', kind: 'upcoming', title: section.title })
      for (const ep of section.episodes) {
        items.push({ type: 'episode', sectionKind: 'upcoming', data: ep })
      }
    }
    return items
  }, [upcomingSections])

  // ── Callbacks ──

  const handleMarkWatched = useCallback(
    (showId: string, seasonNumber?: number, episodeNumber?: number) => {
      markWatchedMutation.mutate({ showId, seasonNumber, episodeNumber })
    },
    [markWatchedMutation]
  )

  const toggleViewMode = useCallback(() => {
    setViewMode(isGrid ? 'thumbnail-list' : 'poster-grid')
  }, [isGrid, setViewMode])

  const handleRefresh = useCallback(() => {
    if (activeTab === 'watchlist') {
      refetch()
      refetchHistory()
    } else {
      refetchUpcoming()
    }
  }, [activeTab, refetch, refetchHistory, refetchUpcoming])

  const isRefreshing = activeTab === 'watchlist' ? isRefetching : upcomingRefetching

  // ── Render helpers ──

  const renderGridItem = useCallback(
    ({ item }: { item: ShowWithUserData }) => (
      <ShowCard show={item} />
    ),
    []
  )

  const renderEpisodeItem = useCallback(
    ({ item }: { item: ShowsListItem }) => {
      if (item.type === 'section-header') {
        return <EpisodeSection title={item.title} />
      }
      return (
        <EpisodeCard
          data={item.data}
          sectionKind={item.sectionKind}
          onMarkWatched={handleMarkWatched}
        />
      )
    },
    [handleMarkWatched]
  )

  const gridKeyExtractor = useCallback((item: ShowWithUserData) => item.id, [])

  const episodeKeyExtractor = useCallback(
    (item: ShowsListItem, index: number) => {
      if (item.type === 'section-header') {
        return `header-${item.kind}-${index}`
      }
      return `ep-${item.data.showId}-${item.data.seasonNumber}-${item.data.episodeNumber}`
    },
    []
  )

  // ── Empty state ──

  const renderEmptyState = useCallback(() => {
    const isWatchList = activeTab === 'watchlist'

    return (
      <View style={styles.emptyState}>
        <Ionicons
          name={isWatchList ? 'tv-outline' : 'calendar-outline'}
          size={48}
          color={colors.outline}
        />
        <Text style={styles.emptyTitle}>
          {isWatchList ? 'No shows yet' : 'No upcoming episodes'}
        </Text>
        <Text style={styles.emptySubtitle}>
          {isWatchList
            ? 'Import your TV Time data or start adding shows from Discover'
            : 'Check back later for upcoming episodes'}
        </Text>
      </View>
    )
  }, [activeTab])

  // ── Loading state ──

  if (showsLoading && activeTab === 'watchlist') {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading your shows...</Text>
      </View>
    )
  }

  if (upcomingLoading && activeTab === 'upcoming') {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading upcoming episodes...</Text>
      </View>
    )
  }

  // ── Render ──

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* TopAppBar — compact, matches TV Time style */}
      <View style={styles.topAppBar}>
        <ShowsTabSwitcher activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Right actions */}
        {activeTab === 'watchlist' && (
          <Pressable onPress={toggleViewMode} style={styles.gridToggle}>
            <Ionicons
              name={isGrid ? 'list-outline' : 'grid-outline'}
              size={20}
              color={colors.onSurfaceVariant}
            />
          </Pressable>
        )}
      </View>

      {/* Content — separate FlashList for each tab */}
      {activeTab === 'watchlist' && (
        isGrid ? (
          <FlashList
            data={shows || []}
            keyExtractor={gridKeyExtractor}
            renderItem={renderGridItem}
            numColumns={2}
            key="grid"
            contentContainerStyle={[
              styles.listContent,
              (shows?.length ?? 0) === 0 && styles.listContentEmpty,
            ]}
            ListEmptyComponent={renderEmptyState}
            refreshControl={
              <RefreshControl
                refreshing={isRefetching}
                onRefresh={handleRefresh}
                tintColor={colors.primary}
                colors={[colors.primary]}
              />
            }
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <FlashList
            data={watchListItems}
            keyExtractor={episodeKeyExtractor}
            renderItem={renderEpisodeItem}
            key="watchlist-list"
            contentContainerStyle={[
              styles.listContentTight,
              watchListItems.length === 0 && styles.listContentEmpty,
            ]}
            ListEmptyComponent={renderEmptyState}
            refreshControl={
              <RefreshControl
                refreshing={isRefetching}
                onRefresh={handleRefresh}
                tintColor={colors.primary}
                colors={[colors.primary]}
              />
            }
            showsVerticalScrollIndicator={false}
          />
        )
      )}

      {activeTab === 'upcoming' && (
        <FlashList
          data={upcomingItems}
          keyExtractor={episodeKeyExtractor}
          renderItem={renderEpisodeItem}
          key="upcoming"
          contentContainerStyle={[
            styles.listContentTight,
            upcomingItems.length === 0 && styles.listContentEmpty,
          ]}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl
              refreshing={upcomingRefetching}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
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

  // TopAppBar
  topAppBar: {
    position: 'relative',
    backgroundColor: 'rgba(21,18,27,0.8)',
  },
  gridToggle: {
    position: 'absolute',
    right: spacing.marginMobile,
    top: spacing.stackSm + 4,
    width: 44,
    height: 44,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },

  // List
  listContent: {
    paddingHorizontal: spacing.marginMobile,
    paddingBottom: 24,
    paddingTop: spacing.unit,
  },
  listContentTight: {
    paddingBottom: 24,
    paddingTop: spacing.unit,
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
