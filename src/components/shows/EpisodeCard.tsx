// ─── EpisodeCard — TV Time-style episode row ───

import { useCallback, useRef, useMemo } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { Image } from 'expo-image'
import { Swipeable } from 'react-native-gesture-handler'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { getImageUrl } from '@/lib/tmdb'
import { colors, typography, spacing, borderRadius } from '@/theme'
import { isNew } from '@/utils'
import type { EpisodeCardData, EpisodeSectionKind } from '@/types'

function formatAirTime(isoString: string): string {
  try {
    const date = new Date(isoString)
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return ''
    }
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  } catch {
    return ''
  }
}

interface EpisodeCardProps {
  data: EpisodeCardData
  sectionKind: EpisodeSectionKind
  onMarkWatched?: (showId: string, seasonNumber: number, episodeNumber: number) => void
}

export default function EpisodeCard({ data, sectionKind, onMarkWatched }: EpisodeCardProps) {
  const swipeableRef = useRef<Swipeable>(null)

  const handlePress = useCallback(() => {
    router.push(`/show/${data.showId}`)
  }, [data.showId])

  const handleMark = useCallback(() => {
    onMarkWatched?.(data.showId, data.seasonNumber, data.episodeNumber)
    swipeableRef.current?.close()
  }, [data.showId, data.seasonNumber, data.episodeNumber, onMarkWatched])

  const posterUrl = getImageUrl(data.posterPath, 'w92')

  // Episode label: "S02 | E01" (without +N badge — that's added in render)
  const episodeLabel = useMemo(() => {
    const s = data.seasonNumber
    const e = data.episodeNumber
    if (s === 0) return `E${e}` // Unknown season
    return `S${s.toString().padStart(2, '0')} | E${e.toString().padStart(2, '0')}`
  }, [data.seasonNumber, data.episodeNumber])

  // Show name pill label: "Show Name >"
  const showNamePill = useMemo(() => {
    return `${data.showName}  ›`
  }, [data.showName])

  const isWatchedHistory = sectionKind === 'watched-history'
  const isUpcoming = sectionKind === 'upcoming'

  // Badge label
  const badgeLabel = useMemo(() => {
    if (data.isPremiere) return 'PREMIERE'
    if (data.isFinale) return 'FINALE'
    return null
  }, [data.isPremiere, data.isFinale])

  const isNewEp = useMemo(() => isNew(data.airDate ?? null, data.isWatched), [data.airDate, data.isWatched])

  const renderRightActions = () => {
    if (isWatchedHistory || isUpcoming || !onMarkWatched) return null
    return (
      <Pressable style={styles.swipeAction} onPress={handleMark}>
        <Ionicons name="checkmark" size={24} color={colors.onPrimary} />
        <Text style={styles.swipeLabel}>Watch</Text>
      </Pressable>
    )
  }

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      overshootRight={false}
      rightThreshold={40}
    >
      <Pressable style={[styles.container, isWatchedHistory && styles.watchedDimmed]} onPress={handlePress}>
        {/* Poster thumbnail */}
        <View style={styles.posterContainer}>
          {posterUrl ? (
            <Image
              source={{ uri: posterUrl }}
              style={styles.poster}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={200}
            />
          ) : (
            <View style={styles.posterPlaceholder}>
              <Ionicons name="tv-outline" size={20} color={colors.outlineVariant} />
            </View>
          )}
        </View>

        {/* Info block */}
        <View style={styles.infoBlock}>
          {/* Show name pill */}
          <View style={styles.showNamePill}>
            <Text style={styles.showNameText} numberOfLines={1}>
              {showNamePill}
            </Text>
          </View>

          {/* Season / Episode + remaining badge */}
          <Text style={styles.episodeLabel}>
            {episodeLabel}
            {!isWatchedHistory && !isUpcoming && data.episodesRemaining != null && data.episodesRemaining > 0 && (
              <Text style={styles.remainingBadge}>  +{data.episodesRemaining}</Text>
            )}
          </Text>

          {/* Episode title */}
          <View style={styles.episodeTitleContainer}>
            <Text style={styles.episodeTitle} numberOfLines={1}>
              {data.episodeName || `Episode ${data.episodeNumber}`}
            </Text>
            {isNewEp && (
              <View style={styles.newBadge}>
                <Text style={styles.newBadgeText}>NEW</Text>
              </View>
            )}
          </View>

          {/* Badge */}
          {badgeLabel && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badgeLabel}</Text>
            </View>
          )}
        </View>

        {/* Right side: air time (upcoming) or network or checkmark */}
        <View style={styles.rightSection}>
          {isUpcoming ? (
            <>
              {data.airTime && <Text style={styles.airTime}>{formatAirTime(data.airTime)}</Text>}
              {data.network && (
                <Text style={styles.network} numberOfLines={1}>
                  {data.network}
                </Text>
              )}
            </>
          ) : (
            <View style={styles.checkmarkContainer}>
              {isWatchedHistory ? (
                <Ionicons name="checkmark-circle" size={24} color={colors.success} />
              ) : (
                <Pressable
                  onPress={handleMark}
                  hitSlop={8}
                  style={styles.checkCircle}
                >
                  <Ionicons name="checkmark" size={14} color={colors.onSurfaceVariant} />
                </Pressable>
              )}
            </View>
          )}
        </View>
      </Pressable>
    </Swipeable>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.stackSm + 2,
    paddingHorizontal: spacing.marginMobile,
    backgroundColor: colors.surface,
  },
  posterContainer: {
    width: 56,
    height: 84,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    backgroundColor: colors.surfaceContainerHighest,
  },
  poster: {
    width: '100%',
    height: '100%',
  },
  posterPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoBlock: {
    flex: 1,
    marginLeft: spacing.gutter,
    justifyContent: 'center',
    gap: 2,
  },
  showNamePill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceContainerHigh,
    paddingHorizontal: 8,
    paddingVertical: spacing.unit - 1,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    maxWidth: '100%',
  },
  showNameText: {
    fontSize: typography.bodyXs.fontSize,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
    letterSpacing: 0.3,
  },
  episodeLabel: {
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '700',
    color: colors.onSurface,
    letterSpacing: 0.3,
    marginTop: spacing.unit,
  },
  episodeTitle: {
    fontSize: typography.bodySm.fontSize,
    color: colors.onSurfaceVariant,
    lineHeight: typography.bodySm.lineHeight,
  },
  episodeTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  newBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  newBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.onPrimary,
  },
  remainingBadge: {
    fontSize: typography.bodySm.fontSize,
    fontWeight: '600',
    color: colors.outline,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.errorContainer,
    paddingHorizontal: 6,
    paddingVertical: spacing.unit - 2,
    borderRadius: borderRadius.sm,
    marginTop: spacing.unit,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.onErrorContainer,
    letterSpacing: 1,
  },
  rightSection: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginLeft: spacing.stackSm,
    minWidth: 50,
  },
  airTime: {
    fontSize: typography.bodySm.fontSize,
    fontWeight: '700',
    color: colors.onSurface,
  },
  network: {
    fontSize: typography.bodyXs.fontSize,
    color: colors.onSurfaceVariant,
    marginTop: spacing.unit,
  },
  checkmarkContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 36,
    height: 36,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.outlineVariant,
    justifyContent: 'center',
    alignItems: 'center',
  },
  watchedDimmed: {
    opacity: 0.55,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  swipeAction: {
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    width: 64,
    borderRadius: borderRadius.md,
    marginVertical: 4,
  },
  swipeLabel: {
    color: colors.onPrimary,
    fontSize: typography.bodyXs.fontSize,
    fontWeight: '600',
    marginTop: spacing.unit,
  },
})
