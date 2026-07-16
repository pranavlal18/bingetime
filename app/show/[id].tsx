// ─── Show Detail Screen — All-in-one: hero + synopsis + season tabs + episode list ───

import { useCallback, useState, useRef, useMemo, useEffect } from 'react'
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
} from 'react-native'
import { useLocalSearchParams, router, Stack } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import { useShow, useMarkWatched, useToggleFavorite, useUpdateShowRuntime } from '@/lib/queries/shows'
import { useSeasonEpisodes, useToggleEpisodeWatched, useBatchMarkWatched } from '@/lib/queries/episodes'
import { getShowDetails, getImageUrl } from '@/lib/tmdb'
import { useQuery } from '@tanstack/react-query'
import LibraryToggle from '@/components/ui/LibraryToggle'
import FavoriteToggle from '@/components/ui/FavoriteToggle'
import { typography, spacing, borderRadius } from '@/theme'
import { useTheme } from '@/contexts/ThemeContext'
import EpisodeDetailModal from '@/components/episodes/EpisodeDetailModal'

import { isAired, getDaysUntilAiring, isNew, formatRuntime } from '@/utils'
import type { EpisodeWithStatus } from '@/lib/queries/episodes'
import type { TMDbShowDetails } from '@/types'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const BACKDROP_HEIGHT = 380
const POSTER_W = 100
const POSTER_H = POSTER_W * 1.5

export default function ShowDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const insets = useSafeAreaInsets()
  const scrollRef = useRef<ScrollView>(null)
  const { colors } = useTheme()

  const styles = useMemo(
    () =>
      StyleSheet.create({
        episodeTitleContainer: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        },
        newBadge: {
          backgroundColor: colors.primary,
          paddingHorizontal: 6,
          paddingVertical: 2,
          borderRadius: 4,
        },
        newBadgeText: {
          fontFamily: 'Inter',
          fontSize: 10,
          fontWeight: '800',
          color: colors.onPrimary,
        },
        daysUntilText: {
          fontFamily: 'Inter',
          fontSize: typography.bodySm.fontSize,
          fontWeight: '600',
          color: colors.onSurfaceVariant,
        },
        container: {
          flex: 1,
          backgroundColor: colors.surface,
        },
        centered: {
          justifyContent: 'center',
          alignItems: 'center',
        },
        errorText: {
          fontSize: typography.bodyMd.fontSize,
          color: colors.outline,
          marginTop: 12,
          marginBottom: 16,
        },
        errorBackBtn: {
          paddingHorizontal: 20,
          paddingVertical: 10,
          backgroundColor: colors.surfaceContainer,
          borderRadius: borderRadius.DEFAULT,
        },
        errorBackBtnText: {
          color: colors.primary,
          fontSize: typography.bodySm.fontSize,
          fontWeight: '600',
        },
        scroll: {
          flex: 1,
        },

        // Backdrop
        backdropSection: {
          width: SCREEN_WIDTH,
          height: BACKDROP_HEIGHT,
          overflow: 'hidden',
          position: 'relative',
        },
        backdropImage: {
          width: '100%',
          height: '100%',
        },
        backdropPlaceholder: {
          width: '100%',
          height: '100%',
          backgroundColor: colors.surfaceContainer,
          justifyContent: 'center',
          alignItems: 'center',
        },
        backdropGradient: {
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '100%',
        },
        heroInfo: {
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          paddingHorizontal: spacing.marginMobile,
          paddingBottom: 24,
          gap: spacing.stackSm,
          maxWidth: SCREEN_WIDTH - POSTER_W - spacing.marginMobile * 2 - 16,
        },
        heroInfoContent: {
          flex: 1,
          justifyContent: 'flex-end',
          gap: spacing.stackSm,
        },
        statusBadge: {
          alignSelf: 'flex-start',
          paddingHorizontal: 12,
          paddingVertical: 4,
          borderRadius: borderRadius.full,
          backgroundColor: colors.tertiary,
        },
        statusBadgeComplete: {
          backgroundColor: colors.statusFinished,
        },
        statusBadgeWatching: {
          backgroundColor: colors.tertiary,
        },
        statusBadgeUpToDate: {
          backgroundColor: colors.statusUpToDate,
        },
        statusBadgeText: {
          fontFamily: 'Inter',
          fontSize: typography.labelSm.fontSize,
          fontWeight: '600',
          lineHeight: typography.labelSm.lineHeight,
          letterSpacing: typography.labelSm.letterSpacing,
          color: colors.onTertiaryContainer,
        },
        heroTitle: {
          fontFamily: 'Inter',
          fontSize: typography.headlineLgMobile.fontSize,
          fontWeight: '700',
          lineHeight: typography.headlineLgMobile.lineHeight,
          color: colors.onSurface,
          letterSpacing: -0.01,
          textShadowColor: 'rgba(0,0,0,0.5)',
          textShadowOffset: { width: 0, height: 2 },
          textShadowRadius: 8,
        },
        heroYear: {
          fontFamily: 'Inter',
          fontSize: typography.labelMd.fontSize,
          fontWeight: '500',
          color: colors.onSurfaceVariant,
        },
        posterOverlay: {
          position: 'absolute',
          bottom: -POSTER_H * 0.3,
          right: spacing.marginMobile,
          width: POSTER_W,
          height: POSTER_H,
          borderRadius: borderRadius.lg,
          overflow: 'hidden',
          borderWidth: 2,
          borderColor: 'rgba(255,255,255,0.08)',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.4,
          shadowRadius: 12,
          elevation: 8,
        },
        posterThumb: {
          width: '100%',
          height: '100%',
        },

        // Progress
        progressContainer: {
          marginTop: spacing.stackSm,
          gap: 8,
          maxWidth: 400,
        },
        progressLabels: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
        },
        progressLabelText: {
          fontFamily: 'Inter',
          fontSize: typography.labelSm.fontSize,
          fontWeight: '600',
          lineHeight: typography.labelSm.lineHeight,
          letterSpacing: typography.labelSm.letterSpacing,
          color: colors.onSurfaceVariant,
        },
        progressPercentText: {
          fontFamily: 'Inter',
          fontSize: typography.labelSm.fontSize,
          fontWeight: '500',
          lineHeight: typography.labelSm.lineHeight,
          letterSpacing: typography.labelSm.letterSpacing,
          color: colors.primary,
        },
        progressTrack: {
          height: 6,
          backgroundColor: colors.surfaceContainerHighest,
          borderRadius: borderRadius.full,
          overflow: 'hidden',
        },
        progressFill: {
          height: '100%',
          backgroundColor: colors.primary,
          shadowColor: colors.primary,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.4,
          shadowRadius: 8,
          elevation: 4,
        },
        progressFillComplete: {
          backgroundColor: colors.statusFinished,
        },
        progressFillUpToDate: {
          backgroundColor: colors.statusUpToDate,
        },

        // Back button
        backOverlay: {
          position: 'absolute',
          left: spacing.marginMobile,
          width: 44,
          height: 44,
          borderRadius: borderRadius.full,
          backgroundColor: 'rgba(33,30,39,0.6)',
          justifyContent: 'center',
          alignItems: 'center',
        },

        // Action buttons (top-right)
        actionOverlay: {
          position: 'absolute',
          right: spacing.marginMobile,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
        },

        // Content body
        contentBody: {
          paddingHorizontal: spacing.marginMobile,
          marginTop: POSTER_H * 0.3 - 8,
        },

        // Synopsis
        synopsisSection: {
          paddingVertical: spacing.stackMd,
        },
        sectionLabel: {
          fontFamily: 'Inter',
          fontSize: typography.bodyLg.fontSize,
          fontWeight: '700',
          lineHeight: typography.bodyLg.lineHeight,
          color: colors.onSurface,
          marginBottom: 8,
        },
        synopsisText: {
          fontFamily: 'Inter',
          fontSize: typography.bodyMd.fontSize,
          fontWeight: '400',
          lineHeight: typography.bodyMd.lineHeight,
          color: colors.onSurfaceVariant,
          opacity: 0.85,
        },

        // Details section
        detailsSection: {
          paddingVertical: spacing.stackMd,
        },
        detailsGrid: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: spacing.stackMd,
        },
        detailItem: {
          flex: 1,
          minWidth: 120,
          gap: 4,
        },
        detailLabel: {
          fontFamily: 'Inter',
          fontSize: typography.bodyXs.fontSize,
          fontWeight: '600',
          lineHeight: typography.bodyXs.lineHeight,
          color: colors.outline,
          textTransform: 'uppercase',
        },
        detailValue: {
          fontFamily: 'Inter',
          fontSize: typography.bodyMd.fontSize,
          fontWeight: '500',
          lineHeight: typography.bodyMd.lineHeight,
          color: colors.onSurface,
        },

        // Season selector
        seasonSelector: {
          flexDirection: 'row',
          paddingVertical: spacing.stackSm,
          gap: spacing.stackSm,
        },
        seasonChip: {
          paddingHorizontal: 20,
          paddingVertical: 10,
          borderRadius: borderRadius.full,
          backgroundColor: colors.surfaceContainer,
          borderWidth: 1,
          borderColor: colors.outlineVariant,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        },
        seasonChipActive: {
          backgroundColor: colors.primary,
          borderColor: colors.primary,
          shadowColor: colors.primary,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.2,
          shadowRadius: 4,
          elevation: 4,
        },
        seasonChipText: {
          fontFamily: 'Inter',
          fontSize: typography.labelSm.fontSize,
          fontWeight: '600',
          lineHeight: typography.labelSm.lineHeight,
          letterSpacing: typography.labelSm.letterSpacing,
          color: colors.onSurfaceVariant,
        },
        seasonChipTextActive: {
          color: colors.onPrimary,
        },
        seasonChipEps: {
          fontFamily: 'Inter',
          fontSize: typography.bodyXs.fontSize,
          fontWeight: '500',
          color: colors.onSurfaceVariant,
          opacity: 0.6,
        },
        seasonChipEpsActive: {
          color: colors.onPrimary,
          opacity: 0.8,
        },

        // Season loading
        seasonLoadingContainer: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          paddingVertical: 32,
        },
        seasonLoadingText: {
          fontFamily: 'Inter',
          fontSize: typography.bodySm.fontSize,
          color: colors.onSurfaceVariant,
        },

        // Episodes section
        episodesSection: {
          marginTop: spacing.stackSm,
          gap: 10,
        },

        // Play Next inline button (replaces FAB)
        playNextButton: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          paddingVertical: 14,
          borderRadius: borderRadius.full,
          backgroundColor: colors.primary,
          shadowColor: colors.primary,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 6,
        },
        playNextText: {
          fontFamily: 'Inter',
          fontSize: typography.bodyMd.fontSize,
          fontWeight: '700',
          lineHeight: typography.bodyMd.lineHeight,
          color: colors.onPrimary,
        },

        // Batch button
        batchButton: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          paddingVertical: 10,
          borderRadius: borderRadius.full,
          backgroundColor: colors.primary + '18',
          borderWidth: 1,
          borderColor: colors.primary + '30',
        },
        batchButtonText: {
          fontFamily: 'Inter',
          fontSize: typography.labelSm.fontSize,
          fontWeight: '600',
          lineHeight: typography.labelSm.lineHeight,
          letterSpacing: typography.labelSm.letterSpacing,
          color: colors.primary,
        },

        // Episode list
        episodesList: {
          backgroundColor: colors.surfaceContainerLow,
          borderRadius: borderRadius.lg,
          borderWidth: 1,
          borderColor: colors.outlineVariant,
          overflow: 'hidden',
        },
        episodeRow: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 14,
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(255,255,255,0.04)',
          position: 'relative',
        },
        episodeRowCurrent: {
          backgroundColor: 'rgba(55,51,61,0.4)',
        },
        episodeCurrentIndicator: {
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 4,
          backgroundColor: colors.primary,
          borderTopRightRadius: 2,
          borderBottomRightRadius: 2,
        },
        episodeNumber: {
          fontFamily: 'Inter',
          fontSize: typography.headlineMd.fontSize,
          fontWeight: '600',
          lineHeight: typography.headlineMd.lineHeight,
          color: 'rgba(203,195,215,0.35)',
          width: 36,
        },
        episodeNumberCurrent: {
          color: colors.primary,
        },
        episodeInfo: {
          flex: 1,
          marginRight: 12,
        },
        episodeTitle: {
          fontFamily: 'Inter',
          fontSize: typography.bodySm.fontSize,
          fontWeight: '600',
          lineHeight: typography.bodySm.lineHeight,
          color: colors.onSurface,
        },
        episodeTitleWatched: {
          color: colors.onSurfaceVariant,
          textDecorationLine: 'line-through',
        },
        episodeMeta: {
          fontFamily: 'Inter',
          fontSize: typography.bodyXs.fontSize,
          fontWeight: '500',
          lineHeight: typography.bodyXs.lineHeight,
          color: colors.onSurfaceVariant,
          marginTop: spacing.unit,
        },

        // Check toggle
        episodeCheckArea: {
          width: 44,
          height: 44,
          justifyContent: 'center',
          alignItems: 'center',
        },
        episodeCheck: {
          width: 32,
          height: 32,
          borderRadius: borderRadius.full,
          backgroundColor: colors.surfaceContainer,
          justifyContent: 'center',
          alignItems: 'center',
          borderWidth: 1.5,
          borderColor: colors.outlineVariant,
        },
        episodeCheckActive: {
          backgroundColor: 'rgba(160,120,255,0.15)',
          borderColor: 'rgba(208,188,255,0.3)',
        },
      }),
    [colors],
  )

  // Detect if the id param is a TMDb ID (numeric) vs a UUID
  const isTmdbIdParam = /^\d+$/.test(id)

  // ── Data ──
  const { data: show, isLoading, error } = useShow(id)
  const markWatchedMutation = useMarkWatched()
  const toggleFavoriteMutation = useToggleFavorite()
  const updateShowRuntimeMutation = useUpdateShowRuntime()

  // Resolve TMDb ID — either from the DB record or directly from the param
  const resolvedTmdbId = show?.tmdb_id ?? (isTmdbIdParam ? parseInt(id, 10) : null)

  const { data: tmdbDetails, isLoading: tmdbLoading } = useQuery({
    queryKey: ['tmdb', 'show-details', resolvedTmdbId],
    queryFn: () => getShowDetails(resolvedTmdbId!),
    enabled: !!resolvedTmdbId,
    staleTime: 1000 * 60 * 60,
  })

  // Calculate average runtime from TMDb episode_run_time (minutes) -> convert to seconds
  const tmdbAverageRuntime = tmdbDetails?.episode_run_time && tmdbDetails.episode_run_time.length > 0
    ? Math.round((tmdbDetails.episode_run_time.reduce((a, b) => a + b, 0) / tmdbDetails.episode_run_time.length) * 60)
    : null

  // ── Auto-fetch & save average_runtime if missing from DB but available from TMDb ──
  useEffect(() => {
    if (!show || !tmdbDetails) return
    // If DB has no runtime but TMDb does, save it
    if (!show.average_runtime && tmdbAverageRuntime) {
      updateShowRuntimeMutation.mutate(
        { showId: show.id, averageRuntime: tmdbAverageRuntime },
        {
          onSuccess: () => {
            console.log('✅ [ShowDetail] Saved average_runtime to DB:', tmdbAverageRuntime)
          },
          onError: (err) => {
            console.error('❌ [ShowDetail] Failed to save average_runtime:', err)
          },
        }
      )
    }
  }, [show, tmdbDetails, tmdbAverageRuntime, updateShowRuntimeMutation])

  // ── Derived ──
  const posterUrl = getImageUrl(show?.poster_path ?? null, 'w342')
  const tmdbPosterUrl = tmdbDetails ? getImageUrl(tmdbDetails.poster_path ?? null, 'w342') : null
  const displayPoster = posterUrl || tmdbPosterUrl
  const backdropUrl = tmdbDetails?.backdrop_path
    ? getImageUrl(tmdbDetails.backdrop_path, 'w780')
    : null

  const displayName = show?.name || tmdbDetails?.name || 'Unknown'
  const year = show?.last_air_date?.slice(0, 4) || tmdbDetails?.last_air_date?.slice(0, 4)
  const totalEpisodes = show?.total_episodes ?? null
  const episodesSeen = Math.min(show?.episodes_seen ?? 0, totalEpisodes ?? Infinity)
  const progress = totalEpisodes && totalEpisodes > 0
    ? episodesSeen / totalEpisodes
    : episodesSeen > 0 ? 1 : 0
  const progressPercent = Math.round(progress * 100)
  const allCaughtUp = totalEpisodes !== null && totalEpisodes > 0 && episodesSeen >= totalEpisodes

  const isFinished = show
    ? allCaughtUp && (show.status === 'Ended' || show.status === 'Canceled')
    : false

  const isUpToDate = allCaughtUp && !isFinished

  const overview = tmdbDetails?.overview || 'No overview available.'
  const seasons = tmdbDetails?.seasons?.filter((s) => s.season_number > 0) || []

  // Use database average_runtime if available, otherwise fall back to TMDb
  const averageRuntime = show?.average_runtime ?? tmdbAverageRuntime

  const statusLabel = isFinished
    ? 'Finished'
    : isUpToDate
      ? 'Up to Date'
      : episodesSeen > 0
        ? 'Watching'
        : 'Not Started'

  // ── State ──
  const [selectedSeasonNumber, setSelectedSeasonNumber] = useState<number | null>(null)
  const [selectedEpisode, setSelectedEpisode] = useState<EpisodeWithStatus | null>(null)
  const [showEpisodeModal, setShowEpisodeModal] = useState(false)

  // Determine default season from last watched data, or 1
  const defaultSeason = useMemo(() => {
    if (seasons.length === 0) return 1
    const fromLastWatched = show?.last_watched_episode_data?.season_number
    if (fromLastWatched && seasons.some((s) => s.season_number === fromLastWatched)) {
      return fromLastWatched
    }
    return seasons[0].season_number
  }, [seasons, show?.last_watched_episode_data])

  // Initialize selectedSeasonNumber once we have seasons
  const resolvedSeason = selectedSeasonNumber ?? defaultSeason

  // ── Season episodes query (works for library items and TMDB fallback) ──
  const hasLocalData = !!show
  const {
    data: season,
    isLoading: seasonLoading,
  } = useSeasonEpisodes(id, resolvedTmdbId, resolvedSeason)

  // ── Toggle mutation (only for library items) ──
  const toggleMutation = useToggleEpisodeWatched()
  const [pendingEpisodeKeys, setPendingEpisodeKeys] = useState<Set<string>>(new Set())

  const handleToggleEpisode = useCallback(
    (episode: EpisodeWithStatus) => {
      if (!hasLocalData) return
      const key = `${episode.episodeNumber}`
      setPendingEpisodeKeys((prev) => new Set(prev).add(key))
      toggleMutation.mutate(
        {
          showId: id,
          seasonNumber: resolvedSeason,
          episodeNumber: episode.episodeNumber,
          watched: !episode.watched,
        },
        {
          onSettled: () => {
            setPendingEpisodeKeys((prev) => {
              const next = new Set(prev)
              next.delete(key)
              return next
            })
          },
          onSuccess: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
          },
        }
      )
    },
    [id, resolvedSeason, toggleMutation, hasLocalData]
  )

  // ── Play Next — marks first unwatched as watched ──
  const handlePlayNext = useCallback(() => {
    if (!season) return
    const nextEp = season.episodes.find((ep) => !ep.watched)
    if (nextEp) handleToggleEpisode(nextEp)
  }, [season, handleToggleEpisode])

  const nextEpisode = useMemo(() => {
    if (!season) return null
    return season.episodes.find((ep) => !ep.watched)
  }, [season])

  // ── Mark all watched (batch) ──
  const batchMarkWatched = useBatchMarkWatched()

  const handleMarkAllWatched = useCallback(() => {
    if (!season) return
    const unwatched = season.episodes.filter((ep) => !ep.watched)
    const episodeNumbers = unwatched.map((ep) => ep.episodeNumber)
    if (episodeNumbers.length === 0) return
    batchMarkWatched.mutate({
      showId: id,
      seasonNumber: resolvedSeason,
      episodeNumbers,
    })
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
  }, [season, id, resolvedSeason, batchMarkWatched])

  // ── Modal ──
  const handleRowPress = useCallback((episode: EpisodeWithStatus) => {
    setSelectedEpisode(episode)
    setShowEpisodeModal(true)
  }, [])

  const handleCloseModal = useCallback(() => {
    setShowEpisodeModal(false)
    setSelectedEpisode(null)
  }, [])

  const handleModalToggle = useCallback(
    (episode: EpisodeWithStatus) => {
      handleToggleEpisode(episode)
    },
    [handleToggleEpisode]
  )

  // ── Season tab press ──
  const handleSeasonPress = useCallback((seasonNumber: number) => {
    setSelectedSeasonNumber(seasonNumber)
  }, [])

  // ── Callbacks ──
  const handleBack = useCallback(() => {
    router.back()
  }, [])

  // ── Loading ──
  const isFallbackLoading = !show && !isLoading && isTmdbIdParam && tmdbLoading
  if (isLoading || isFallbackLoading) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  // ── Error ──
  // UUID param failed in DB, or TMDB fallback also failed
  const isRealDbError = error && !show && !isTmdbIdParam
  const isFallbackError = !show && !tmdbDetails && isTmdbIdParam && !tmdbLoading
  if (isRealDbError || isFallbackError) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.outline} />
        <Text style={styles.errorText}>Could not load show details</Text>
        <Pressable onPress={handleBack} style={styles.errorBackBtn}>
          <Text style={styles.errorBackBtnText}>Go back</Text>
        </Pressable>
      </View>
    )
  }

  const allWatched = season ? season.episodes.length > 0 && season.episodes.every((ep) => ep.watched) : false

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={{
          paddingBottom: insets.bottom + 40,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Backdrop Hero ── */}
        <View style={styles.backdropSection}>
          {backdropUrl ? (
            <Image
              source={{ uri: backdropUrl }}
              style={styles.backdropImage}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          ) : displayPoster ? (
            <Image
              source={{ uri: displayPoster }}
              style={styles.backdropImage}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          ) : (
            <View style={styles.backdropPlaceholder}>
              <Ionicons name="tv-outline" size={48} color={colors.outlineVariant} />
            </View>
          )}

          <LinearGradient
            colors={['transparent', colors.surface]}
            locations={[0.3, 1]}
            style={styles.backdropGradient}
          />

          {/* Hero info */}
          <View style={styles.heroInfo}>
            {hasLocalData && (
              <View style={[
                styles.statusBadge,
                isFinished && styles.statusBadgeComplete,
                isUpToDate && styles.statusBadgeUpToDate,
                !isFinished && !isUpToDate && episodesSeen > 0 && styles.statusBadgeWatching,
              ]}>
                <Text style={styles.statusBadgeText}>{statusLabel}</Text>
              </View>
            )}
            <Text style={styles.heroTitle}>{displayName}</Text>
            {year && <Text style={styles.heroYear}>{year}</Text>}
            {hasLocalData && (
              <View style={styles.progressContainer}>
                <View style={styles.progressLabels}>
                  <Text style={styles.progressLabelText}>
                    {episodesSeen}{totalEpisodes ? ` / ${totalEpisodes}` : ''} episodes
                  </Text>
                  <Text style={styles.progressPercentText}>{progressPercent}%</Text>
                </View>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${progressPercent}%` },
                      isFinished && styles.progressFillComplete,
                      isUpToDate && styles.progressFillUpToDate,
                    ]}
                  />
                </View>
              </View>
            )}
          </View>

          {/* Back button */}
          <Pressable onPress={handleBack} style={[styles.backOverlay, { top: insets.top + 8 }]}>
            <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
          </Pressable>

          {/* Action buttons — top-right: Favorite + Library toggle */}
          {resolvedTmdbId && (
            <View style={[styles.actionOverlay, { top: insets.top + 8 }]}>
              {hasLocalData && (
                <FavoriteToggle
                  isFavorited={show?.is_favorited ?? false}
                  onToggle={() => toggleFavoriteMutation.mutate(show!.id)}
                  isPending={toggleFavoriteMutation.isPending}
                  size={28}
                />
              )}
              <LibraryToggle
                tmdbId={resolvedTmdbId}
                mediaType="tv"
                title={displayName}
                posterPath={show?.poster_path || tmdbDetails?.poster_path || null}
                year={year ?? null}
                inLibrary={show?.is_watchlist ?? false}
                libraryId={show?.id}
                size={28}
              />
            </View>
          )}

          {/* Poster thumbnail */}
          {displayPoster && (
            <View style={styles.posterOverlay}>
              <Image
                source={{ uri: displayPoster }}
                style={styles.posterThumb}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
            </View>
          )}
        </View>

        {/* ── Content Body ── */}
        <View style={styles.contentBody}>
          {/* Synopsis */}
          <View style={styles.synopsisSection}>
            <Text style={styles.sectionLabel}>Synopsis</Text>
            <Text style={styles.synopsisText}>{overview}</Text>
          </View>

          {/* Details */}
          {((tmdbDetails?.networks && tmdbDetails.networks.length > 0) ||
            (tmdbDetails?.genres && tmdbDetails.genres.length > 0) ||
            averageRuntime) && (
            <View style={styles.detailsSection}>
              <Text style={styles.sectionLabel}>Details</Text>
              <View style={styles.detailsGrid}>
                {tmdbDetails?.networks && tmdbDetails.networks.length > 0 && (
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Network</Text>
                    <Text style={styles.detailValue}>
                      {tmdbDetails.networks.map((n) => n.name).join(', ')}
                    </Text>
                  </View>
                )}
                {tmdbDetails?.genres && tmdbDetails.genres.length > 0 && (
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Genres</Text>
                    <Text style={styles.detailValue}>
                      {tmdbDetails.genres.map((g) => g.name).join(', ')}
                    </Text>
                  </View>
                )}
                {averageRuntime && (
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Avg. Runtime</Text>
                    <Text style={styles.detailValue}>
                      {formatRuntime(averageRuntime)}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Season Tabs */}
          {seasons.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.seasonSelector}
            >
              {seasons.map((season) => {
                const isActive = season.season_number === resolvedSeason
                return (
                  <Pressable
                    key={season.id}
                    style={[styles.seasonChip, isActive && styles.seasonChipActive]}
                    onPress={() => handleSeasonPress(season.season_number)}
                  >
                    <Text style={[styles.seasonChipText, isActive && styles.seasonChipTextActive]}>
                      Season {season.season_number}
                    </Text>
                    <Text style={[styles.seasonChipEps, isActive && styles.seasonChipEpsActive]}>
                      {season.episode_count} eps
                    </Text>
                  </Pressable>
                )
              })}
            </ScrollView>
          )}

          {/* Season loading */}
          {seasonLoading && (
            <View style={styles.seasonLoadingContainer}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.seasonLoadingText}>Loading episodes...</Text>
            </View>
          )}

          {/* Episode List */}
          {!seasonLoading && season && (
            <View style={styles.episodesSection}>
              {/* Play Next inline button — replaces floating FAB */}
              {nextEpisode && !allWatched && (
                <Pressable
                  style={({ pressed }) => [
                    styles.playNextButton,
                    pressed && { opacity: 0.85 },
                  ]}
                  onPress={handlePlayNext}
                >
                  <Ionicons name="play" size={18} color={colors.onPrimary} />
                  <Text style={styles.playNextText}>
                    Play Next: S{resolvedSeason} E{nextEpisode.episodeNumber}
                  </Text>
                </Pressable>
              )}

              {/* Mark All Watched */}
              {!allWatched && !seasonLoading && season.episodes.length > 0 && (
                <Pressable
                  style={({ pressed }) => [
                    styles.batchButton,
                    pressed && { opacity: 0.85 },
                  ]}
                  onPress={handleMarkAllWatched}
                >
                  <Ionicons name="checkmark-done" size={16} color={colors.primary} />
                  <Text style={styles.batchButtonText}>Mark All Watched</Text>
                </Pressable>
              )}

              {/* Episode rows */}
              <View style={styles.episodesList}>
                {season.episodes.map((ep) => {
                  const epNum = ep.episodeNumber
                  const isCurrent = epNum === (nextEpisode?.episodeNumber ?? -1)
                  const isWatched = ep.watched
                  const isPending = pendingEpisodeKeys.has(`${epNum}`)
                  const aired = isAired(ep.airDate)
                  const isNewEp = isNew(ep.airDate, ep.watched)
                  const daysUntil = getDaysUntilAiring(ep.airDate)
                  const canToggle = aired || ep.watched

                  return (
                    <Pressable
                      key={epNum}
                      style={[
                        styles.episodeRow,
                        isCurrent && styles.episodeRowCurrent,
                      ]}
                      onPress={() => handleRowPress(ep)}
                    >
                      {isCurrent && <View style={styles.episodeCurrentIndicator} />}

                      {/* Episode number */}
                      <Text
                        style={[
                          styles.episodeNumber,
                          isCurrent && styles.episodeNumberCurrent,
                        ]}
                      >
                        {String(epNum).padStart(2, '0')}
                      </Text>

                      {/* Info */}
                      <View style={styles.episodeInfo}>
                        <View style={styles.episodeTitleContainer}>
                           <Text
                            style={[
                              styles.episodeTitle,
                              isWatched && styles.episodeTitleWatched,
                            ]}
                            numberOfLines={1}
                          >
                            {ep.title}
                          </Text>
                          {isNewEp && (
                            <View style={styles.newBadge}>
                                <Text style={styles.newBadgeText}>NEW</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.episodeMeta}>
                          {isCurrent
                            ? 'Next up'
                            : isWatched
                              ? 'Watched'
                              : ep.airDate
                                ? ep.airDate
                                : 'Upcoming'}
                        </Text>
                      </View>

                      {/* Check toggle */}
                      <Pressable
                        hitSlop={8}
                        onPress={() => canToggle && handleToggleEpisode(ep)}
                        disabled={isPending || !canToggle}
                        style={styles.episodeCheckArea}
                      >
                        {!aired && !isWatched && daysUntil !== null ? (
                          <Text style={styles.daysUntilText}>{daysUntil}d</Text>
                        ) : (
                          <View
                            style={[
                              styles.episodeCheck,
                              isWatched && styles.episodeCheckActive,
                            ]}
                          >
                            {isPending ? (
                              <ActivityIndicator size="small" color={colors.primary} />
                            ) : (
                              <Ionicons
                                name={isWatched ? 'checkmark' : 'ellipse-outline'}
                                size={20}
                                color={isWatched ? colors.primary : colors.onSurfaceVariant}
                              />
                            )}
                          </View>
                        )}
                      </Pressable>
                    </Pressable>
                  )
                })}
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Episode Detail Modal */}
      <EpisodeDetailModal
        visible={showEpisodeModal}
        episode={selectedEpisode}
        seasonNumber={resolvedSeason}
        onClose={handleCloseModal}
        onToggleWatched={handleModalToggle}
        isPending={selectedEpisode ? pendingEpisodeKeys.has(`${selectedEpisode.episodeNumber}`) : false}
        isAired={selectedEpisode ? isAired(selectedEpisode.airDate) : false}
      />
    </View>
  )
}
