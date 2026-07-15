// ─── Shows Tab — TV Time-style Watch List + Upcoming ───

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native'
import { FlashList } from '@shopify/flash-list'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useQueries } from '@tanstack/react-query'
import { useShows, useMarkWatched, useNewSeasonIds, deriveWatchNextEpisodes, deriveHaventWatchedEpisodes } from '@/lib/queries/shows'
import type { NextEpisodeInfo } from '@/lib/queries/shows'
import { getSeasonDetails, getShowBasicDetails } from '@/lib/tmdb'
import { useWatchedEpisodesHistory } from '@/lib/queries/episodes'
import { useUpcomingEpisodes } from '@/lib/queries/upcoming'
import { useAppStore } from '@/stores/appStore'
import { useTheme } from '@/contexts/ThemeContext'
import { typography, spacing, borderRadius } from '@/theme'
import ShowCard from '@/components/shows/ShowCard'
import EpisodeCard from '@/components/shows/EpisodeCard'
import EpisodeSection from '@/components/shows/EpisodeSection'
import SkeletonEpisodeCard from '@/components/shows/SkeletonEpisodeCard'
import SkeletonBlock from '@/components/skeletons/SkeletonBlock'
import ShowsTabSwitcher from '@/components/shows/ShowsTabSwitcher'

import type { ShowWithUserData } from '@/lib/queries/shows'
import type { ShowsTabKind, ShowsListItem } from '@/types'
import { isAired } from '@/utils'

// ── Screen ──

export default function ShowsScreen() {
  const insets = useSafeAreaInsets()
  const [activeTab, setActiveTab] = useState<ShowsTabKind>('watchlist')
  const viewMode = useAppStore((s) => s.showsViewMode)
  const setViewMode = useAppStore((s) => s.setShowsViewMode)
  const { colors } = useTheme()

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

  // New season detection (async, fires after render)
  const newSeasonIds = useNewSeasonIds()

  // Haven't watched pagination
  const HAVENT_BATCH_SIZE = 20
  const [haventLimit, setHaventLimit] = useState(5)

  const isGrid = viewMode === 'poster-grid'

  // Refetch when screen comes into focus
  const watchListRef = useRef<any>(null)
  useFocusEffect(
    useCallback(() => {
      refetch()
      refetchHistory()
      // Force scroll to top so Watch Next section is always visible first
      watchListRef.current?.scrollToOffset({ offset: 0, animated: false })
    }, [refetch, refetchHistory])
  )

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

  // Memoize query arrays to stabilize useQueries references
  const showQueriesConfig = useMemo(() => showPairs.map(pair => ({
    queryKey: ['tmdb', 'show-basic', pair.tmdbId],
    queryFn: () => getShowBasicDetails(pair.tmdbId),
    staleTime: 1000 * 60 * 60,
    enabled: showPairs.length > 0,
  })), [showPairs])

  const seasonQueriesConfig = useMemo(() => episodeNamePairs.map(pair => ({
    queryKey: ['tmdb', 'season-details', pair.tmdbId, pair.seasonNumber],
    queryFn: () => getSeasonDetails(pair.tmdbId, pair.seasonNumber),
    staleTime: 1000 * 60 * 60, // 1 hour — episode names don't change
    enabled: episodeNamePairs.length > 0,
  })), [episodeNamePairs])

  // 3a. Fetch show-level details for ALL season episode counts (boundary detection)
  const showQueries = useQueries({ queries: showQueriesConfig })

  // 3b. Batch-fetch TMDb season details for episode names
  const seasonQueries = useQueries({ queries: seasonQueriesConfig })

  // 3c. Watch Next loading state: ready when shows loaded AND all TMDb queries resolved
  const isWatchNextReady = useMemo(() => {
    if (showsLoading || !shows) return false
    const tmdbDone = showPairs.length === 0 || showQueries.every(q => !q.isLoading)
    const namesDone = episodeNamePairs.length === 0 || seasonQueries.every(q => !q.isLoading)
    return tmdbDone && namesDone
  }, [showsLoading, shows, showPairs, showQueries, episodeNamePairs, seasonQueries])

  // 4. Build episode name map: `${showId}:${episodeNumber}` → episode name
  //    AND airDate map: `${showId}:${episodeNumber}` → airDate
  const episodeDataMap = useMemo(() => {
    const nameMap = new Map<string, string>()
    const airDateMap = new Map<string, string | null>()
    for (let i = 0; i < episodeNamePairs.length; i++) {
      const pair = episodeNamePairs[i]
      const data = seasonQueries[i]?.data
      if (!data) continue
      for (const ep of data.episodes) {
        nameMap.set(`${pair.showId}:${ep.episode_number}`, ep.name)
        airDateMap.set(`${pair.showId}:${ep.episode_number}`, ep.air_date)
      }
    }
    return { nameMap, airDateMap }
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

        // Get air date for this episode
        const airDate = episodeDataMap.airDateMap.get(`${ep.showId}:${en}`) || null

        // Filter out episodes that haven't aired yet
        if (!isAired(airDate)) return null

        return {
          type: 'episode',
          sectionKind: 'watch-next',
          data: {
            showId: ep.showId,
            showName: ep.showName,
            posterPath: ep.posterPath,
            seasonNumber: sn,
            episodeNumber: en,
            episodeName: episodeDataMap.nameMap.get(`${ep.showId}:${en}`) || null,
            airDate,
            totalEpisodes: ep.totalEpisodes,
            episodesRemaining: ep.episodesRemaining,
            isWatched: false,
            showStatus: ep.showStatus,
          },
        }
      })
      .filter((item): item is ShowsListItem => item !== null)
  }, [rawWatchNext, episodeDataMap, seasonInfoMap])

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

        // Get air date for this episode
        const airDate = episodeDataMap.airDateMap.get(`${ep.showId}:${en}`) || null

        // Filter out episodes that haven't aired yet
        if (!isAired(airDate)) return null

        return {
          type: 'episode',
          sectionKind: 'haven-watched',
          data: {
            showId: ep.showId,
            showName: ep.showName,
            posterPath: ep.posterPath,
            seasonNumber: sn,
            episodeNumber: en,
            episodeName: episodeDataMap.nameMap.get(`${ep.showId}:${en}`) || null,
            airDate,
            totalEpisodes: ep.totalEpisodes,
            episodesRemaining: ep.episodesRemaining,
            isWatched: false,
            showStatus: ep.showStatus,
          },
        }
      })
      .filter((item): item is ShowsListItem => item !== null)
  }, [rawHaventWatched, episodeDataMap, seasonInfoMap])

  // Build flattened list for Watch List (list mode)
  const watchListItems: ShowsListItem[] = useMemo(() => {
    if (isGrid) return [] // Grid mode uses separate FlashList

    const items: ShowsListItem[] = []

    // Section: Watch Next
    items.push({ type: 'section-header', kind: 'watch-next', title: 'WATCH NEXT' })
    if (watchNextEpisodes.length > 0) {
      items.push(...watchNextEpisodes)
    } else if (!isWatchNextReady) {
      // Show skeletons while TMDb data loads
      items.push({ type: 'skeleton', kind: 'watch-next' })
      items.push({ type: 'skeleton', kind: 'watch-next' })
      items.push({ type: 'skeleton', kind: 'watch-next' })
    }

    // Section: Watched History (recently watched) — ALWAYS show immediately
    if (watchedHistory && watchedHistory.length > 0) {
      items.push({ type: 'section-header', kind: 'watched-history', title: 'WATCHED HISTORY' })
      for (const ep of watchedHistory) {
        items.push({ type: 'episode', sectionKind: 'watched-history', data: ep })
      }
    }

    // Section: Haven't Watched (paginated)
    if (haventWatchedEpisodes.length > 0) {
      items.push({ type: 'section-header', kind: 'haven-watched', title: "HAVEN'T WATCHED FOR A WHILE" })
      const visible = haventWatchedEpisodes.slice(0, haventLimit)
      items.push(...visible)
      const remaining = haventWatchedEpisodes.length - haventLimit
      if (remaining > 0) {
        items.push({ type: 'more', kind: 'haven-watched', remaining })
      }
    }

    return items
  }, [watchedHistory, watchNextEpisodes, haventWatchedEpisodes, isGrid, haventLimit, isWatchNextReady])

  // Auto-scroll to top when Watch Next data first loads (fresh login / cold cache)
  const prevWatchNextLength = useRef(0)
  useEffect(() => {
    if (prevWatchNextLength.current === 0 && watchNextEpisodes.length > 0) {
      watchListRef.current?.scrollToOffset({ offset: 0, animated: true })
    }
    prevWatchNextLength.current = watchNextEpisodes.length
  }, [watchNextEpisodes.length])

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
      <ShowCard show={item} isNewSeason={newSeasonIds.includes(item.id)} />
    ),
    [newSeasonIds]
  )

  const renderEpisodeItem = useCallback(
    ({ item }: { item: ShowsListItem }) => {
      if (item.type === 'section-header') {
        return <EpisodeSection title={item.title} />
      }
      if (item.type === 'skeleton') {
        return <SkeletonEpisodeCard />
      }

      if (item.type === 'more') {
        return (
          <Pressable
            onPress={() => setHaventLimit((prev) => prev + HAVENT_BATCH_SIZE)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 14,
              paddingHorizontal: spacing.marginMobile,
              gap: 6,
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.primary }}>
              More ({item.remaining} left)
            </Text>
            <Ionicons name="chevron-down" size={16} color={colors.primary} />
          </Pressable>
        )
      }
      return (
        <EpisodeCard
          data={item.data}
          sectionKind={item.sectionKind}
          onMarkWatched={handleMarkWatched}
        />
      )
    },
    [handleMarkWatched, colors, HAVENT_BATCH_SIZE]
  )

  const gridKeyExtractor = useCallback((item: ShowWithUserData) => item.id, [])

  const episodeKeyExtractor = useCallback(
    (item: ShowsListItem, index: number) => {
      if (item.type === 'section-header') {
        return `header-${item.kind}-${index}`
      }
      if (item.type === 'skeleton') {
        return `skeleton-${item.kind}-${index}`
      }
      if (item.type === 'more') {
        return `more-${item.kind}-${index}`
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
  }, [activeTab, colors])

  // ── Styles ──

  const styles = useMemo(
    () =>
      StyleSheet.create({
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
          backgroundColor: colors.surfaceContainer,
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
      }),
    [colors]
  )

  // ── Loading state (initial Supabase query only — fast) ──

// ── Render helpers ──

  const renderWatchlist = useCallback(() => {
    if (isGrid) {
      return (
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
      )
    }

    return (
      <FlashList
        ref={watchListRef}
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
  }, [
    isGrid,
    isWatchNextReady,
    shows,
    watchListItems,
    watchListRef,
    isRefetching,
    handleRefresh,
    renderEmptyState,
    gridKeyExtractor,
    renderGridItem,
    episodeKeyExtractor,
    renderEpisodeItem,
    styles,
  ])

  // ── Loading state (initial Supabase query only — fast) ──

  if (showsLoading && activeTab === 'watchlist') {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.primary} />
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
      {activeTab === 'watchlist' && <View style={{ flex: 1 }}>{renderWatchlist()}</View>}

      {activeTab === 'upcoming' && (
        upcomingLoading && upcomingItems.length === 0 ? (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 24, paddingTop: spacing.unit }}
            showsVerticalScrollIndicator={false}
          >
            {/* Section header pill skeleton */}
            <View
              style={{
                alignSelf: 'flex-start',
                paddingHorizontal: spacing.gutter,
                paddingVertical: spacing.stackSm - 2,
                marginBottom: spacing.stackSm,
                marginHorizontal: spacing.marginMobile,
                marginTop: spacing.stackMd,
              }}
            >
              <SkeletonBlock width={100} height={14} borderRadius={7} />
            </View>
            <SkeletonEpisodeCard />
            <SkeletonEpisodeCard />

            {/* Another section */}
            <View
              style={{
                alignSelf: 'flex-start',
                paddingHorizontal: spacing.gutter,
                paddingVertical: spacing.stackSm - 2,
                marginBottom: spacing.stackSm,
                marginHorizontal: spacing.marginMobile,
                marginTop: spacing.stackMd,
              }}
            >
              <SkeletonBlock width={130} height={14} borderRadius={7} />
            </View>
            <SkeletonEpisodeCard />
            <SkeletonEpisodeCard />
            <SkeletonEpisodeCard />

            {/* Another section */}
            <View
              style={{
                alignSelf: 'flex-start',
                paddingHorizontal: spacing.gutter,
                paddingVertical: spacing.stackSm - 2,
                marginBottom: spacing.stackSm,
                marginHorizontal: spacing.marginMobile,
                marginTop: spacing.stackMd,
              }}
            >
              <SkeletonBlock width={160} height={14} borderRadius={7} />
            </View>
            <SkeletonEpisodeCard />
            <SkeletonEpisodeCard />
          </ScrollView>
        ) : (
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
        )
      )}
    </View>
  )
}
