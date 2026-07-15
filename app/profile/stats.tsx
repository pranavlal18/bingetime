// ─── Statistics — TV Time-style redesign ───

import { useState, useMemo, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '@/contexts/ThemeContext'
import { useAppStore } from '@/stores/appStore'
import {
  useTabCounts,
  useWeeklyWatch,
  useMarathons,
  useUpcomingEpisodes,
  useCatchUpRate,
  useTimeToWatchHours,
  useFutureWatchTimeBars,
  useProjectedFinishDate,
  useWatchTimeBreakdown,
  useShowGenreStats,
  useMovieGenreStats,
  useRemainingCounts,
  useRepairShowGenres,
} from '@/lib/queries/stats'
import { useRefreshMovieGenres } from '@/lib/queries/movies'
import {
  StatBlock,
  SegmentedToggle,
  PeriodTabs,
  PeriodBarChart,
  BigValue,
  RankedListItem,
  MarathonRow,
  UpcomingList,
  StatsPageSkeleton,
} from '@/components/stats'
import type { TabKind } from '@/components/stats'
import type { MarathonData } from '@/components/stats'
import type { UpcomingItem } from '@/components/stats'

const SIDE_OFFSET = 20
const CONTENT_GAP = 16

function formatNumber(n: number): string {
  return n.toLocaleString('en-US')
}

// ── Main Screen ──

export default function StatsScreen() {
  const insets = useSafeAreaInsets()
  const { colors } = useTheme()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<TabKind>('shows')

  // ── All data queries ──
  const { data: watchTime, isLoading: watchTimeLoading } = useWatchTimeBreakdown()
  const { data: tabCounts, isLoading: tabCountsLoading } = useTabCounts()
  const period = useAppStore((s) => s.statsPeriod)

  // Weekly data (for hero + total + charts)
  const { data: weeklyHours, isLoading: weeklyHoursLoading } = useWeeklyWatch(tab, 'hours', period)
  const { data: weeklyCounts, isLoading: weeklyCountsLoading } = useWeeklyWatch(tab, 'count', period)

  // Tab-specific queries
  const { data: marathons } = useMarathons()
  const { data: upcoming } = useUpcomingEpisodes()
  const { data: catchUp } = useCatchUpRate(tab)
  const { data: timeToWatch } = useTimeToWatchHours(tab)
  const { data: futureBars } = useFutureWatchTimeBars()
  const { data: finishDate } = useProjectedFinishDate(tab)
  const { data: remaining } = useRemainingCounts(tab)

  // Genre data
  const { data: showGenres } = useShowGenreStats()
  const { data: movieGenres } = useMovieGenreStats()

  // Show genre repair state
  const [showRepairStatus, setShowRepairStatus] = useState<'idle' | 'repairing' | 'success' | 'error'>('idle')
  const [showRepairMsg, setShowRepairMsg] = useState('')
  const showRepairMutation = useRepairShowGenres()

  // Movie genre repair state
  const [movieRepairStatus, setMovieRepairStatus] = useState<'idle' | 'repairing' | 'success' | 'error'>('idle')
  const [movieRepairMsg, setMovieRepairMsg] = useState('')
  const movieRepairMutation = useRefreshMovieGenres()

  const handleRepairShows = useCallback(() => {
    setShowRepairStatus('repairing')
    setShowRepairMsg('')
    showRepairMutation.mutate(undefined, {
      onSuccess: (data) => {
        if (data.fixed > 0) {
          setShowRepairStatus('success')
          setShowRepairMsg(`Fixed ${data.fixed} show genre${data.fixed > 1 ? 's' : ''}`)
        } else if (data.total > 0) {
          setShowRepairStatus('error')
          setShowRepairMsg(`Could not update any genres (${data.skipped} skipped). Check console for details.`)
        } else {
          setShowRepairStatus('success')
          setShowRepairMsg('All shows already have genres')
        }
      },
      onError: (err) => {
        const message = (err as Error)?.message || 'Unknown error'
        setShowRepairStatus('error')
        setShowRepairMsg(message)
      },
    })
  }, [showRepairMutation])

  const handleRepairMovies = useCallback(() => {
    setMovieRepairStatus('repairing')
    setMovieRepairMsg('')
    movieRepairMutation.mutate(undefined, {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: ['stats'] })
        setMovieRepairStatus('success')
        setMovieRepairMsg(`Updated ${data.updated} movie genre${data.updated > 1 ? 's' : ''}`)
      },
      onError: (err) => {
        const message = (err as Error)?.message || 'Unknown error'
        setMovieRepairStatus('error')
        setMovieRepairMsg(message)
      },
    })
  }, [movieRepairMutation, queryClient])

  // Upcoming chart data (bucketed by week)
  const upcomingChartData = useMemo(() => {
    if (!upcoming || upcoming.length === 0) return []
    const weekMap = new Map<string, number>()
    const now = new Date()
    for (let w = 0; w < 12; w++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + w * 7)
      const weekId = `${d.getFullYear()}-W${String(Math.ceil((d.getTime() - new Date(d.getFullYear(), 0, 1).getTime()) / 604800000)).padStart(2, '0')}`
      weekMap.set(weekId, 0)
    }
    for (const ep of upcoming) {
      const epItem = ep as UpcomingItem
      const parsed = new Date(epItem.dateLabel)
      if (!isNaN(parsed.getTime())) {
        const weekId = `${parsed.getFullYear()}-W${String(Math.ceil((parsed.getTime() - new Date(parsed.getFullYear(), 0, 1).getTime()) / 604800000)).padStart(2, '0')}`
        weekMap.set(weekId, (weekMap.get(weekId) ?? 0) + 1)
      }
    }
    return Array.from(weekMap.entries())
      .filter(([_, v]) => v > 0)
      .slice(0, 12)
      .map(([label, value]) => ({ label: `W${label.slice(-2)}`, value }))
  }, [upcoming])

  // ── Derived values ──

  const isLoading = watchTimeLoading || tabCountsLoading

  const tabLabel = tab === 'shows' ? 'shows' : 'movies'
  const tabUnit = tab === 'shows' ? 'episodes' : 'movies'

  // Hero values
  const heroBigValue = useMemo(() => {
    if (!watchTime) return null
    if (tab === 'shows') {
      const totalHours = watchTime.showHours
      return {
        primaryCount: watchTime.showEpisodes,
        primaryUnit: 'episodes',
        days: Math.floor(totalHours / 24),
        hours: totalHours % 24,
      }
    } else {
      const totalHours = watchTime.movieHours
      return {
        primaryCount: watchTime.movieCount,
        primaryUnit: 'movies',
        days: Math.floor(totalHours / 24),
        hours: totalHours % 24,
      }
    }
  }, [watchTime, tab])

  // Recent subline: from the first weekly bucket (most recent period)
  const recentSubline = useMemo(() => {
    if (!weeklyHours || weeklyHours.length === 0) return undefined
    const first = weeklyHours[0]
    if (first.value <= 0) return `0 hours in the last 7 days`
    return `${formatNumber(Math.round(first.value))} hours in the last ${period === 'week' ? '7 days' : 'month'}`
  }, [weeklyHours, period])

  // Total count all-time for the "Total X watched" block
  const allTimeTotal = useMemo(() => {
    if (!watchTime) return 0
    return tab === 'shows' ? watchTime.showEpisodes : watchTime.movieCount
  }, [watchTime, tab])

  // Recent count: from first bucket
  const recentCount = useMemo(() => {
    if (!weeklyCounts || weeklyCounts.length === 0) return 0
    return weeklyCounts[0].value
  }, [weeklyCounts])

  // Genres for current tab
  const genres = tab === 'shows' ? showGenres : movieGenres
  const maxGenreValue = useMemo(() => {
    if (!genres || genres.length === 0) return 1
    return Math.max(...genres.map((g) => g.hours))
  }, [genres])

  // If every watched item has NULL/empty genres, we get a single "Other" entry.
  // That means genres need repair, not that "Other" is a real genre.
  const hasOnlyOtherGenre = useMemo(
    () => genres && genres.length === 1 && genres[0].genre === 'Other',
    [genres]
  )
  const needsGenreRepair = !genres || genres.length === 0 || hasOnlyOtherGenre

  const isRemainingEmpty = remaining?.count === 0 || remaining === undefined
  const isCatchUpEmpty = catchUp?.ratePerWeek === undefined || catchUp.ratePerWeek <= 0
  const formattedFinishDate = useMemo(() => {
    if (!finishDate) return null
    const d = new Date(finishDate)
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }, [finishDate])

  // ── Loading state ──
  if (isLoading) return <StatsPageSkeleton />

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* ── Header ── */}
      <View
        style={{
          paddingTop: insets.top + 12,
          paddingBottom: 12,
          paddingHorizontal: SIDE_OFFSET,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text
          style={{
            fontFamily: 'Inter',
            fontSize: 18,
            fontWeight: '600',
            color: colors.onSurface,
            flex: 1,
          }}
        >
          Statistics
        </Text>
      </View>

      {/* ── Tab Switch ── */}
      <View style={{ paddingHorizontal: SIDE_OFFSET, marginBottom: CONTENT_GAP }}>
        <SegmentedToggle value={tab} onChange={setTab} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: SIDE_OFFSET,
          paddingBottom: insets.bottom + 40,
          gap: CONTENT_GAP,
        }}
      >
        {/* ══════════════════════════════════════════
            1. Hero — Time spent watching
            ══════════════════════════════════════════ */}
        <StatBlock
          title={`Time spent watching ${tabLabel}`}
          headerRight={<PeriodTabs />}
        >
          {heroBigValue && (
            <BigValue
              primaryCount={heroBigValue.primaryCount}
              primaryUnit={heroBigValue.primaryUnit}
              days={heroBigValue.days}
              hours={heroBigValue.hours}
              recentSubline={recentSubline}
            />
          )}
          {weeklyHoursLoading ? (
            <View style={{ height: 120, justifyContent: 'center', alignItems: 'center' }}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : (
            <PeriodBarChart
              data={weeklyHours ?? []}
              height={100}
              maxLabelInterval={period === 'week' ? 1 : 3}
            />
          )}
        </StatBlock>

        {/* ══════════════════════════════════════════
            2. Total watched
            ══════════════════════════════════════════ */}
        <StatBlock title={`Total ${tabLabel} watched`}>
          <Text
            style={{
              fontFamily: 'Inter',
              fontSize: 28,
              fontWeight: '700',
              color: colors.onSurface,
              lineHeight: 34,
            }}
          >
            {formatNumber(allTimeTotal)}
          </Text>
          {recentCount > 0 && (
            <Text
              style={{
                fontFamily: 'Inter',
                fontSize: 11,
                fontWeight: '500',
                color: colors.secondary,
                marginTop: 2,
                marginBottom: 12,
                letterSpacing: 0.4,
                textTransform: 'uppercase',
              }}
            >
              {formatNumber(Math.round(recentCount))} in the last {period === 'week' ? '7 days' : 'month'}
            </Text>
          )}
          {weeklyCountsLoading ? (
            <View style={{ height: 80, justifyContent: 'center', alignItems: 'center' }}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : (
            <PeriodBarChart
              data={weeklyCounts ?? []}
              height={80}
              maxLabelInterval={period === 'week' ? 1 : 3}
            />
          )}
        </StatBlock>

        {/* ══════════════════════════════════════════
            3. Added counts
            ══════════════════════════════════════════ */}
        <StatBlock title={`Added ${tabLabel}`}>
          <Text
            style={{
              fontFamily: 'Inter',
              fontSize: 28,
              fontWeight: '700',
              color: colors.onSurface,
              lineHeight: 34,
            }}
          >
            {tab === 'shows'
              ? formatNumber(tabCounts?.showsAdded ?? 0)
              : formatNumber(tabCounts?.moviesAdded ?? 0)}
          </Text>
          <Text
            style={{
              fontFamily: 'Inter',
              fontSize: 11,
              fontWeight: '500',
              color: colors.secondary,
              marginTop: 2,
              letterSpacing: 0.4,
              textTransform: 'uppercase',
            }}
          >
            Total {tabLabel} in your library
          </Text>
        </StatBlock>

        {/* ══════════════════════════════════════════
            4. Top genres
            ══════════════════════════════════════════ */}
        <StatBlock
          title={`Top ${tab === 'movies' ? 'movie' : 'show'} genres`}
          empty={false}
        >
          {!needsGenreRepair ? (
            <View style={{ marginTop: 4 }}>
              {genres!.slice(0, 10).map((g, i) => (
                <RankedListItem
                  key={g.genre}
                  label={g.genre}
                  value={g.hours}
                  maxValue={maxGenreValue}
                  suffix="h"
                  rank={i + 1}
                  barColor={tab === 'shows' ? colors.tertiary : colors.primary}
                />
              ))}
            </View>
          ) : tab === 'shows' ? (
            showRepairStatus === 'repairing' ? (
              <Text style={{ fontFamily: 'Inter', fontSize: 13, color: colors.secondary, textAlign: 'center', paddingVertical: 16 }}>
                Repairing show genres…
              </Text>
            ) : showRepairStatus === 'success' ? (
              <Text style={{ fontFamily: 'Inter', fontSize: 13, color: colors.tertiary, textAlign: 'center', paddingVertical: 16 }}>
                {showRepairMsg}
              </Text>
            ) : showRepairStatus === 'error' ? (
              <View style={{ alignItems: 'center', paddingVertical: 8 }}>
                <Text style={{ fontFamily: 'Inter', fontSize: 12, color: '#f87171', textAlign: 'center', marginBottom: 10, paddingHorizontal: 8 }}>
                  {showRepairMsg}
                </Text>
                <Pressable
                  onPress={handleRepairShows}
                  style={{ backgroundColor: colors.primaryContainer, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16, alignItems: 'center' }}
                >
                  <Text style={{ fontFamily: 'Inter', fontSize: 13, fontWeight: '600', color: colors.onPrimaryContainer }}>Retry</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                onPress={handleRepairShows}
                style={{ backgroundColor: colors.primaryContainer, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16, alignItems: 'center', marginTop: 4 }}
              >
                <Text style={{ fontFamily: 'Inter', fontSize: 13, fontWeight: '600', color: colors.onPrimaryContainer }}>
                  Repair show genres
                </Text>
              </Pressable>
            )
          ) : movieRepairStatus === 'repairing' ? (
            <Text style={{ fontFamily: 'Inter', fontSize: 13, color: colors.secondary, textAlign: 'center', paddingVertical: 16 }}>
              Repairing movie genres…
            </Text>
          ) : movieRepairStatus === 'success' ? (
            <Text style={{ fontFamily: 'Inter', fontSize: 13, color: colors.tertiary, textAlign: 'center', paddingVertical: 16 }}>
              {movieRepairMsg}
            </Text>
          ) : movieRepairStatus === 'error' ? (
            <View style={{ alignItems: 'center', paddingVertical: 8 }}>
              <Text style={{ fontFamily: 'Inter', fontSize: 12, color: '#f87171', textAlign: 'center', marginBottom: 10, paddingHorizontal: 8 }}>
                {movieRepairMsg}
              </Text>
              <Pressable
                onPress={handleRepairMovies}
                style={{ backgroundColor: colors.primaryContainer, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16, alignItems: 'center' }}
              >
                <Text style={{ fontFamily: 'Inter', fontSize: 13, fontWeight: '600', color: colors.onPrimaryContainer }}>Retry</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={handleRepairMovies}
              style={{ backgroundColor: colors.primaryContainer, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16, alignItems: 'center', marginTop: 4 }}
            >
              <Text style={{ fontFamily: 'Inter', fontSize: 13, fontWeight: '600', color: colors.onPrimaryContainer }}>
                Repair movie genres
              </Text>
            </Pressable>
          )}
        </StatBlock>

        {/* ══════════════════════════════════════════
             5. Biggest marathons — Shows only
             ══════════════════════════════════════════ */}
        {tab === 'shows' && (
          <StatBlock
            title="Biggest marathons"
            empty={!marathons || marathons.length === 0}
            emptyMessage="Not enough data for marathons"
          >
            {marathons && marathons.length > 0 && (
              <View style={{ marginTop: 4 }}>
                {marathons.map((m, idx) => (
                  <MarathonRow key={idx} marathon={m as MarathonData} />
                ))}
              </View>
            )}
          </StatBlock>
        )}

        {/* ══════════════════════════════════════════
            6. Remaining
            ══════════════════════════════════════════ */}
        <StatBlock
          title={`Remaining ${tabUnit}`}
          empty={isRemainingEmpty}
          emptyMessage={`No ${tabUnit} left to watch`}
        >
          <Text
            style={{
              fontFamily: 'Inter',
              fontSize: 28,
              fontWeight: '700',
              color: colors.onSurface,
              lineHeight: 34,
            }}
          >
            {formatNumber(remaining?.count ?? 0)}
          </Text>
          <Text
            style={{
              fontFamily: 'Inter',
              fontSize: 11,
              fontWeight: '500',
              color: colors.secondary,
              marginTop: 2,
              letterSpacing: 0.4,
              textTransform: 'uppercase',
            }}
          >
            {tabUnit} still in your queue
          </Text>
        </StatBlock>

        {/* ══════════════════════════════════════════
            7. Upcoming episodes — Shows only
            ══════════════════════════════════════════ */}
        {tab === 'shows' && (
          <StatBlock
            title="Upcoming episodes"
            empty={!upcoming || upcoming.length === 0}
            emptyMessage="No upcoming episodes found"
          >
            {upcoming && upcoming.length > 0 && (
              <>
                <UpcomingList items={upcoming as UpcomingItem[]} limit={5} />
                {/* Also show a weekly bar chart of upcoming */}
                {upcomingChartData.length > 0 && (
                  <View style={{ marginTop: 4 }}>
                    <PeriodBarChart data={upcomingChartData} height={80} maxLabelInterval={2} />
                  </View>
                )}
              </>
            )}
          </StatBlock>
        )}

        {/* ══════════════════════════════════════════
            8. Catch-up rate
            ══════════════════════════════════════════ */}
        <StatBlock
          title="How fast are you catching up?"
          empty={isCatchUpEmpty}
          emptyMessage="Not enough watch data yet"
        >
          {catchUp && catchUp.ratePerWeek > 0 && (
            <>
              <Text
                style={{
                  fontFamily: 'Inter',
                  fontSize: 28,
                  fontWeight: '700',
                  color: colors.onSurface,
                  lineHeight: 34,
                }}
              >
                {catchUp.ratePerWeek.toFixed(2)} {catchUp.unit}/week
              </Text>
              <Text
                style={{
                  fontFamily: 'Inter',
                  fontSize: 11,
                  fontWeight: '500',
                  color: colors.secondary,
                  marginTop: 2,
                  letterSpacing: 0.4,
                  textTransform: 'uppercase',
                }}
              >
                Based on your activity in the last 60 days
              </Text>
            </>
          )}
        </StatBlock>

        {/* ══════════════════════════════════════════
            9. Time to watch
            ══════════════════════════════════════════ */}
        <StatBlock title="Time to watch">
          <Text
            style={{
              fontFamily: 'Inter',
              fontSize: 28,
              fontWeight: '700',
              color: colors.onSurface,
              lineHeight: 34,
            }}
          >
            {formatNumber(timeToWatch ?? 0)} hours
          </Text>
          <Text
            style={{
              fontFamily: 'Inter',
              fontSize: 11,
              fontWeight: '500',
              color: colors.secondary,
              marginTop: 2,
              letterSpacing: 0.4,
              textTransform: 'uppercase',
            }}
          >
            Estimated time to finish your queue
          </Text>
        </StatBlock>

        {/* ══════════════════════════════════════════
            10. Future watch time — Movies only
            ══════════════════════════════════════════ */}
        {tab === 'movies' && (
          <StatBlock
            title="Future watch time"
            empty={!futureBars || futureBars.length === 0 || futureBars.every((b) => b.value === 0)}
            emptyMessage="No projected data yet"
          >
            {futureBars && futureBars.length > 0 && (
              <PeriodBarChart
                data={futureBars.map((b) => ({ label: b.label, value: b.value }))}
                height={100}
                maxLabelInterval={2}
                showTotal
                totalLabel="Projected monthly watch hours"
              />
            )}
          </StatBlock>
        )}

        {/* ══════════════════════════════════════════
            11. Projected finish date
            ══════════════════════════════════════════ */}
        <StatBlock
          title={`When will you catch up on your ${tabLabel}?`}
          empty={!finishDate}
          emptyMessage="Not enough data to calculate"
        >
          {finishDate && formattedFinishDate && (
            <>
              <Text
                style={{
                  fontFamily: 'Inter',
                  fontSize: 28,
                  fontWeight: '700',
                  color: colors.onSurface,
                  lineHeight: 34,
                }}
              >
                {formattedFinishDate}
              </Text>
              <Text
                style={{
                  fontFamily: 'Inter',
                  fontSize: 11,
                  fontWeight: '500',
                  color: colors.secondary,
                  marginTop: 2,
                  letterSpacing: 0.4,
                  textTransform: 'uppercase',
                }}
              >
                Based on your current watch rate
              </Text>
            </>
          )}
        </StatBlock>
      </ScrollView>
    </View>
  )
}
