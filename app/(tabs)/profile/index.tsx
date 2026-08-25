// ─── Profile Tab — TV Time style: user + horizontal carousels ───

import { memo, useState, useMemo, useCallback } from 'react'
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  Linking,
} from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { hapticLight } from '@/utils/haptics'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAppStore } from '@/stores/appStore'
import { useAuth } from '@/contexts/AuthContext'
import { getImageUrl } from '@/lib/tmdb'
import { useShows, useContinueWatching, useTitleCredits } from '@/lib/queries/shows'
import { useMovies, useFavoriteMovies } from '@/lib/queries/movies'
import {
  useProfileStats,
  useFavorites,
} from '@/lib/queries/profile'
import { useWatchTimeBreakdown } from '@/lib/queries/stats'
import SkeletonBlock from '@/components/skeletons/SkeletonBlock'
import { useTheme } from '@/contexts/ThemeContext'

import type { ShowWithUserData } from '@/lib/queries/shows'
import type { MovieWithUserData } from '@/lib/queries/movies'
import type { ThemeKey } from '@/types'

const SCREEN_WIDTH = Dimensions.get('window').width
const POSTER_W = 100
const POSTER_H = POSTER_W * 1.5
const SIDE_OFFSET = 20

// ── Helpers ──

function formatNumber(n: number): string {
  return n.toLocaleString('en-US')
}

function getInitials(source: string): string {
  // Splits on spaces and email-style separators so both email prefixes
  // ("prana.lal") and custom display names ("Pranav Lal") yield two initials
  return source
    .split(/[\s._@-]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase())
    .slice(0, 2)
    .join('')
}

// ── Sub-components (theme-aware via useTheme) ──

// 2-column bento grid: (screen width - 2 × margin - 1 × gap) / 2
const STAT_CARD_WIDTH = (SCREEN_WIDTH - 20 * 2 - 16) / 2

const StatCard = memo(function StatCard({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme()

  return (
    <View
      style={{
        width: STAT_CARD_WIDTH,
        height: 88,
        backgroundColor: colors.surfaceContainer,
        borderRadius: 16,
        paddingVertical: 20,
        paddingHorizontal: 12,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
      }}
    >
      <Text
        style={{
          fontFamily: 'Inter',
          fontSize: 24,
          fontWeight: '600',
          color: colors.primary,
        }}
      >
        {value}
      </Text>
      <Text
        style={{
          fontFamily: 'Inter',
          fontSize: 12,
          fontWeight: '500',
          letterSpacing: 0.08,
          textTransform: 'uppercase' as const,
          color: colors.secondary,
          marginTop: 4,
        }}
      >
        {label}
      </Text>
    </View>
  )
})

const SectionHeader = memo(function SectionHeader({
  title,
  icon,
  iconColor,
  count,
  onPress,
}: {
  title: string
  icon?: keyof typeof Ionicons.glyphMap
  iconColor?: string
  count?: number
  onPress?: () => void
}) {
  const { colors } = useTheme()
  return (
    <Pressable
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: SIDE_OFFSET,
        marginBottom: 12,
      }}
      onPress={onPress}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {icon && <Ionicons name={icon} size={18} color={iconColor ?? colors.primary} />}
        <Text
          style={{
            fontFamily: 'Inter',
            fontSize: 20,
            fontWeight: '700',
            color: colors.onSurface,
            letterSpacing: -0.01,
          }}
        >
          {title}
        </Text>
        {count !== undefined && (
          <Text
            style={{
              fontFamily: 'Inter',
              fontSize: 14,
              fontWeight: '500',
              color: colors.outlineVariant,
            }}
          >
            {count}
          </Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.outlineVariant} />
    </Pressable>
  )
})

const PosterItem = memo(function PosterItem({
  posterPath,
  title,
  onPress,
}: {
  posterPath: string | null
  title: string
  onPress: () => void
}) {
  const { colors } = useTheme()
  const posterUrl = getImageUrl(posterPath, 'w185')

  return (
    <Pressable
      style={{ width: POSTER_W }}
      onPress={() => {
        hapticLight()
        onPress()
      }}
    >
      <View
        style={{
          width: POSTER_W,
          height: POSTER_H,
          borderRadius: 12,
          overflow: 'hidden',
          backgroundColor: colors.surfaceDim,
          borderWidth: 1,
          borderColor: colors.outlineVariant,
        }}
      >
        {posterUrl ? (
          <Image
            source={{ uri: posterUrl }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Ionicons name="film-outline" size={24} color={colors.outlineVariant} />
          </View>
        )}
      </View>
      <Text
        style={{
          fontFamily: 'Inter',
          fontSize: 11.5,
          fontWeight: '600',
          color: colors.onSurface,
          marginTop: 8,
          lineHeight: 15,
        }}
        numberOfLines={2}
      >
        {title}
      </Text>
    </Pressable>
  )
})

// ── Stats Preview Cards (horizontal carousel on Profile tab) ──

const STATS_CARD_GAP = 12
const STATS_CARD_W = (SCREEN_WIDTH - SIDE_OFFSET * 2 - STATS_CARD_GAP) / 2

interface TimeBreakdown {
  months: number
  days: number
  hours: number
}

function getTimeBreakdown(totalHours: number): TimeBreakdown {
  // 30 days per month, 24 hours per day
  const months = Math.floor(totalHours / (30 * 24))
  const remaining = totalHours - months * 30 * 24
  const days = Math.floor(remaining / 24)
  const hours = Math.floor(remaining - days * 24)
  return { months, days, hours }
}

const StatMiniCard = memo(function StatMiniCard({
  icon,
  title,
  primary,
  primaryLabel,
  breakdown,
  breakdownLabels,
}: {
  icon: keyof typeof Ionicons.glyphMap
  title: string
  primary?: number
  primaryLabel?: string
  breakdown?: TimeBreakdown
  breakdownLabels?: { months: string; days: string; hours: string }
}) {
  const { colors } = useTheme()
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.surfaceContainer,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
        padding: 16,
        minHeight: 130,
        justifyContent: 'space-between',
      }}
    >
      {/* Header: icon + title */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Ionicons name={icon} size={14} color={colors.secondary} />
        <Text
          style={{
            fontFamily: 'Inter',
            fontSize: 13,
            fontWeight: '500',
            color: colors.secondary,
          }}
          numberOfLines={1}
        >
          {title}
        </Text>
      </View>

      {/* Primary value (when no breakdown) */}
      {primary !== undefined && primaryLabel !== undefined && (
        <View style={{ marginTop: 8 }}>
          <Text
            style={{
              fontFamily: 'Inter',
              fontSize: 26,
              fontWeight: '700',
              color: colors.onSurface,
              lineHeight: 32,
              letterSpacing: -0.01,
            }}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {primary.toLocaleString('en-US')}
          </Text>
          <Text
            style={{
              fontFamily: 'Inter',
              fontSize: 11,
              fontWeight: '600',
              letterSpacing: 0.08,
              textTransform: 'uppercase',
              color: colors.secondary,
              marginTop: 4,
            }}
          >
            {primaryLabel}
          </Text>
        </View>
      )}

      {/* Time breakdown (months/days/hours) */}
      {breakdown && breakdownLabels && (
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 6 }}>
          <View style={{ alignItems: 'flex-start' }}>
            <Text
              style={{
                fontFamily: 'Inter',
                fontSize: 22,
                fontWeight: '700',
                color: colors.onSurface,
                lineHeight: 26,
                letterSpacing: -0.01,
              }}
            >
              {breakdown.months}
            </Text>
            <Text
              style={{
                fontFamily: 'Inter',
                fontSize: 9,
                fontWeight: '600',
                textTransform: 'uppercase',
                color: colors.secondary,
                marginTop: 4,
                letterSpacing: 0.08,
              }}
            >
              {breakdownLabels.months}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-start' }}>
            <Text
              style={{
                fontFamily: 'Inter',
                fontSize: 22,
                fontWeight: '700',
                color: colors.onSurface,
                lineHeight: 26,
                letterSpacing: -0.01,
              }}
            >
              {breakdown.days}
            </Text>
            <Text
              style={{
                fontFamily: 'Inter',
                fontSize: 9,
                fontWeight: '600',
                textTransform: 'uppercase',
                color: colors.secondary,
                marginTop: 4,
                letterSpacing: 0.08,
              }}
            >
              {breakdownLabels.days}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-start' }}>
            <Text
              style={{
                fontFamily: 'Inter',
                fontSize: 22,
                fontWeight: '700',
                color: colors.onSurface,
                lineHeight: 26,
                letterSpacing: -0.01,
              }}
            >
              {breakdown.hours}
            </Text>
            <Text
              style={{
                fontFamily: 'Inter',
                fontSize: 9,
                fontWeight: '600',
                textTransform: 'uppercase',
                color: colors.secondary,
                marginTop: 4,
                letterSpacing: 0.08,
              }}
            >
              {breakdownLabels.hours}
            </Text>
          </View>
        </View>
      )}
    </View>
  )
})

const StatsPreviewCards = memo(function StatsPreviewCards({
  showHours,
  showEpisodes,
  movieHours,
  movieCount,
}: {
  showHours: number
  showEpisodes: number
  movieHours: number
  movieCount: number
}) {
  const { colors } = useTheme()
  const [pageIndex, setPageIndex] = useState(0)

  const showBreakdown = getTimeBreakdown(showHours)
  const movieBreakdown = getTimeBreakdown(movieHours)

  // Pages: [shows page, movies page]
  const pageWidth = SCREEN_WIDTH
  const totalPages = 2

  const handleScroll = useCallback(
    (e: any) => {
      const x = e.nativeEvent.contentOffset.x
      const idx = Math.round(x / pageWidth)
      setPageIndex(Math.max(0, Math.min(totalPages - 1, idx)))
    },
    [pageWidth]
  )

  return (
    <View style={{ marginBottom: 16 }}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {/* Page 1: Shows stats */}
        <View style={{ width: pageWidth }}>
          <View
            style={{
              paddingHorizontal: SIDE_OFFSET,
              flexDirection: 'row',
            }}
          >
            <View style={{ width: STATS_CARD_W }}>
              <StatMiniCard
                icon="tv-outline"
                title="TV time"
                breakdown={showBreakdown}
                breakdownLabels={{ months: 'months', days: 'days', hours: 'hours' }}
              />
            </View>
            <View style={{ width: STATS_CARD_W, marginLeft: STATS_CARD_GAP }}>
              <StatMiniCard
                icon="play-circle-outline"
                title="Episodes watched"
                primary={showEpisodes}
                primaryLabel="episodes"
              />
            </View>
          </View>
        </View>

        {/* Page 2: Movies stats */}
        <View style={{ width: pageWidth }}>
          <View
            style={{
              paddingHorizontal: SIDE_OFFSET,
              flexDirection: 'row',
            }}
          >
            <View style={{ width: STATS_CARD_W }}>
              <StatMiniCard
                icon="film-outline"
                title="Movie time"
                breakdown={movieBreakdown}
                breakdownLabels={{ months: 'months', days: 'days', hours: 'hours' }}
              />
            </View>
            <View style={{ width: STATS_CARD_W, marginLeft: STATS_CARD_GAP }}>
              <StatMiniCard
                icon="checkmark-circle-outline"
                title="Movies watched"
                primary={movieCount}
                primaryLabel="movies"
              />
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Pagination dots */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 6,
          marginTop: 12,
        }}
      >
        {Array.from({ length: totalPages }).map((_, i) => (
          <View
            key={i}
            style={{
              width: i === pageIndex ? 18 : 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: i === pageIndex ? colors.primary : colors.outlineVariant,
            }}
          />
        ))}
      </View>
    </View>
  )
})

// ── Main Screen ──

export default function ProfileScreen() {
  const insets = useSafeAreaInsets()
  const displayName = useAppStore((s) => s.displayName)

  const { colors } = useTheme()

  const { user, loading: authLoading } = useAuth()

  const { data: stats, isLoading: statsLoading } = useProfileStats()
  const { data: watchTime, isLoading: watchTimeLoading } = useWatchTimeBreakdown()
  const { data: shows, isLoading: showsLoading } = useShows()
  const { data: movies, isLoading: moviesLoading } = useMovies()
  const { data: continueWatching } = useContinueWatching()
  const { data: favoriteShows } = useFavorites()

  // Source title for the avatar: compare recency of top watched show vs top watched movie
  const topShow = continueWatching?.[0]
  const showTimeStr = topShow?.last_watched_episode_data?.updated_at || topShow?.last_watched_episode_data?.watched_at
  const showTime = showTimeStr ? new Date(showTimeStr).getTime() : 0

  const topMovie = movies?.find((m) => m.watched && m.watched_at) || movies?.[0]
  const movieTimeStr = topMovie?.watched_at
  const movieTime = movieTimeStr ? new Date(movieTimeStr).getTime() : 0

  const isMovieMoreRecent = movieTime > 0 && movieTime > showTime
  const activeItem = isMovieMoreRecent ? topMovie : (topShow || topMovie)
  const sourceMediaType: 'tv' | 'movie' = (isMovieMoreRecent || (!topShow && topMovie)) ? 'movie' : 'tv'
  const sourceTmdbId = activeItem?.tmdb_id ?? null

  const { data: credits } = useTitleCredits(sourceTmdbId, sourceMediaType)
  const { data: favoriteMovies } = useFavoriteMovies()

  // Derived sections — all shows in library and watched movies
  const libraryShows = useMemo(() => {
    if (!shows) return []
    return shows // All shows in library
  }, [shows])

  const activeShows = useMemo(() => {
    if (!shows) return []
    return shows.filter((s) => s.episodes_seen > 0)
  }, [shows])

  const watchedMoviesList = useMemo(() => {
    if (!movies) return []
    return movies.filter((m) => m.watched)
  }, [movies])

  // Avatar = a RANDOM cast member's headshot (not the lead, not the poster)
// Avatar = the lead actor's headshot (not the poster, not the lead)
  const pfpCast = useMemo(() => {
    const cast = credits?.cast ?? []
    // Find the first cast member with a profile photo (lead actor)
    const lead = cast.find((c) => c.profile_path)
    return lead ? [lead.profile_path as string] : []
  }, [credits])

  const isLoading_ = statsLoading || showsLoading || moviesLoading || authLoading

  // Dynamic styles that depend on theme
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
        scrollContent: {
          paddingBottom: 32,
        },
        // User Header
        userHeader: {
          alignItems: 'center',
          paddingVertical: 32,
          paddingHorizontal: 20,
        },
        settingsGear: {
          position: 'absolute',
          top: 32,
          right: 20,
          width: 40,
          height: 40,
          borderRadius: 20,
          justifyContent: 'center',
          alignItems: 'center',
        },
        avatarRing: {
          width: 112,
          height: 112,
          borderRadius: 100,
          borderWidth: 2,
          borderColor: 'rgba(208,188,255,0.25)',
          padding: 4,
          marginBottom: 16,
        },
        avatarContainer: {
          width: '100%',
          height: '100%',
          borderRadius: 100,
          overflow: 'hidden',
          backgroundColor: colors.surfaceContainerHigh,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.1)',
          justifyContent: 'center',
          alignItems: 'center',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 8,
        },
        avatarInitials: {
          fontFamily: 'Inter',
          fontSize: 34,
          fontWeight: '700',
          color: colors.onSurface,
          opacity: 0.85,
        },
        userName: {
          fontFamily: 'Inter',
          fontSize: 24,
          fontWeight: '600',
          color: colors.onSurface,
          marginBottom: 4,
        },
        userBadge: {
          fontFamily: 'Inter',
          fontSize: 14,
          fontWeight: '600',
          letterSpacing: 0.01,
          color: colors.onSurfaceVariant,
        },
        // Bento Stats Grid
        statsGrid: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          paddingHorizontal: 20,
          gap: 16,
          marginBottom: 32,
        },
        // Carousel Section
        carouselSection: {
          marginBottom: 16,
        },
        carouselContent: {
          paddingLeft: SIDE_OFFSET,
          paddingRight: 8,
          gap: 12,
        },
        // Empty State
        emptyState: {
          marginHorizontal: 20,
          marginTop: 16,
          marginBottom: 24,
          padding: 24,
          backgroundColor: colors.surfaceContainer,
          borderRadius: 16,
          alignItems: 'center',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.05)',
        },
        emptyTitle: {
          fontFamily: 'Inter',
          fontSize: 20,
          fontWeight: '600',
          color: colors.onSurface,
          marginTop: 12,
          marginBottom: 8,
        },
        emptySubtitle: {
          fontFamily: 'Inter',
          fontSize: 14,
          color: colors.onSurfaceVariant,
          textAlign: 'center',
          lineHeight: 20,
          marginBottom: 16,
        },
        emptyActionPrimary: {
          flex: 1,
        },
        emptyActionSecondary: {
          flex: 1,
        },
      }),
    [colors]
  )

  // ── Loading skeleton ──
  if (isLoading_) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Avatar skeleton */}
          <View style={styles.userHeader}>
            <View style={styles.avatarRing}>
              <View style={styles.avatarContainer}>
                <SkeletonBlock width={80} height={80} borderRadius={40} />
              </View>
            </View>
            <SkeletonBlock width={150} height={24} borderRadius={4} style={{ marginTop: 16 }} />
            <SkeletonBlock width={120} height={14} borderRadius={4} style={{ marginTop: 8 }} />
          </View>

          {/* Statistics Link / Stats skeleton */}
          <View style={{ paddingHorizontal: SIDE_OFFSET, marginBottom: 12 }}>
            <SkeletonBlock width={80} height={20} borderRadius={4} />
          </View>

          {/* Stats preview cards skeleton */}
          <View style={{ flexDirection: 'row', paddingHorizontal: SIDE_OFFSET, gap: 16, marginBottom: 24 }}>
            <SkeletonBlock
              width={STATS_CARD_W}
              height={88}
              borderRadius={16}
            />
            <SkeletonBlock
              width={STATS_CARD_W}
              height={88}
              borderRadius={16}
            />
          </View>

          {/* Shows carousel skeleton */}
          <View style={{ paddingHorizontal: SIDE_OFFSET, marginBottom: 12 }}>
            <SkeletonBlock width={100} height={20} borderRadius={4} />
          </View>
          <View
            style={{
              flexDirection: 'row',
              paddingLeft: SIDE_OFFSET,
              paddingRight: 8,
              gap: 12,
              marginBottom: 16,
            }}
          >
            {[1, 2, 3, 4].map((i) => (
              <View key={i} style={{ width: POSTER_W }}>
                <SkeletonBlock width={POSTER_W} height={POSTER_H} borderRadius={12} />
                <SkeletonBlock
                  width="80%"
                  height={12}
                  borderRadius={4}
                  style={{ marginTop: 8 }}
                />
              </View>
            ))}
          </View>

        </ScrollView>
      </View>
    )
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── User Header ── */}
        <View style={styles.userHeader}>
          <Pressable
            style={styles.settingsGear}
            onPress={() => {
              hapticLight()
              router.push('/profile/settings')
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Settings"
          >
            <Ionicons name="settings-outline" size={24} color={colors.onSurface} />
          </Pressable>
          <View style={styles.avatarRing}>
            <View style={styles.avatarContainer}>
              {pfpCast.length > 0 ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', width: '100%', height: '100%' }}>
                  {pfpCast.map((p, i) => (
                    <Image
                      key={i}
                      source={{ uri: getImageUrl(p, 'w185')! }}
                      style={
                        pfpCast.length === 1
                          ? { width: '100%', height: '100%' }
                          : pfpCast.length === 2
                            ? { width: '50%', height: '100%' }
                            : { width: '50%', height: '50%' }
                      }
                      contentFit="cover"
                      cachePolicy="disk"
                    />
                  ))}
                </View>
              ) : (
                <Text style={styles.avatarInitials}>
                  {user ? getInitials(displayName || user.email || '') : 'AT'}
                </Text>
              )}
            </View>
          </View>
          <Text style={styles.userName}>
            {displayName || user?.email?.split('@')[0] || 'Alex Thorne'}
          </Text>
          <Text style={styles.userBadge}>{user?.email || 'Premium Member'}</Text>
        </View>

        {/* ── Empty State CTA ── */}
        {activeShows.length === 0 && watchedMoviesList.length === 0 && (favoriteShows?.length ?? 0) === 0 && (favoriteMovies?.length ?? 0) === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="film-outline" size={64} color={colors.primary} />
            <Text style={styles.emptyTitle}>No content yet</Text>
            <Text style={styles.emptySubtitle}>
              Start by discovering shows and movies, or import your library from TV Time.
            </Text>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
              <Pressable
                style={[
                  styles.emptyActionPrimary,
                  { backgroundColor: colors.primary, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 10, flex: 1, alignItems: 'center' }
                ]}
                onPress={() => router.replace('/(tabs)/discover')}
              >
                <Text style={{ color: '#FFF', fontFamily: 'Inter', fontSize: 14, fontWeight: '600' }}>Discover Content</Text>
              </Pressable>

            </View>
            <Pressable
              style={[
                { backgroundColor: colors.surfaceContainer, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: colors.outlineVariant, marginTop: 8 }
              ]}
              onPress={() => router.push('/add-content')}
            >
              <Text style={{ color: colors.onSurface, fontFamily: 'Inter', fontSize: 14, fontWeight: '600' }}>Add Manually</Text>
            </Pressable>
          </View>
        )}

        {/* ── Statistics Link ── */}
        <SectionHeader
          title="Stats"
          icon="stats-chart-outline"
          onPress={() => router.push('/profile/stats')}
        />

        {/* ── Stats Preview Cards ── */}
        <StatsPreviewCards
          showHours={watchTime?.showHours ?? 0}
          showEpisodes={watchTime?.showEpisodes ?? 0}
          movieHours={watchTime?.movieHours ?? 0}
          movieCount={watchTime?.movieCount ?? 0}
        />

        {/* ── Shows Carousel ── */}
        {libraryShows.length > 0 && (
          <View style={styles.carouselSection}>
            <SectionHeader
              title="Shows"
              count={libraryShows.length}
              onPress={() => router.push('/all-shows')}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.carouselContent}
            >
              {libraryShows.slice(0, 10).map((show) => (
                <PosterItem
                  key={show.id}
                  posterPath={show.poster_path}
                  title={show.name}
                  onPress={() => router.push(`/show/${show.id}`)}
                />
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── Favorite Shows ── */}
        {favoriteShows && favoriteShows.length > 0 && (
          <View style={styles.carouselSection}>
            <SectionHeader
              title="Favorite Shows"
              icon="heart"
              iconColor="#ff3b30"
              count={favoriteShows.length}
              onPress={() => router.push('/favorite-shows')}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.carouselContent}
            >
              {favoriteShows.slice(0, 10).map((show) => (
                <PosterItem
                  key={show.id}
                  posterPath={show.poster_path}
                  title={show.name}
                  onPress={() => router.push(`/show/${show.id}`)}
                />
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── Movies Carousel ── */}
        {watchedMoviesList.length > 0 && (
          <View style={styles.carouselSection}>
            <SectionHeader
              title="Movies"
              count={watchedMoviesList.length}
              onPress={() => router.push('/all-movies')}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.carouselContent}
            >
              {watchedMoviesList.slice(0, 10).map((movie) => (
                <PosterItem
                  key={movie.id}
                  posterPath={movie.poster_path}
                  title={movie.title}
                  onPress={() => router.push(`/movie/${movie.id}`)}
                />
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── Favorite Movies ── */}
        {favoriteMovies && favoriteMovies.length > 0 && (
          <View style={styles.carouselSection}>
            <SectionHeader
              title="Favorite Movies"
              icon="heart"
              iconColor="#ff3b30"
              count={favoriteMovies.length}
              onPress={() => router.push('/favorite-movies')}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.carouselContent}
            >
              {favoriteMovies.slice(0, 10).map((movie) => (
                <PosterItem
                  key={movie.id}
                  posterPath={movie.poster_path}
                  title={movie.title}
                  onPress={() => router.push(`/movie/${movie.id}`)}
                />
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>
    </View>
  )
}

