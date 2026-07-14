// ─── ShowListItem — thumbnail + title + progress + episode info ───

import { useRef, useCallback, useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
} from 'react-native'
import { Image } from 'expo-image'
import { Swipeable } from 'react-native-gesture-handler'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { getImageUrl } from '@/lib/queries/shows'
import ProgressBar from './ProgressBar'
import { typography, borderRadius, spacing } from '@/theme'
import { useTheme } from '@/contexts/ThemeContext'
import type { ShowWithUserData } from '@/lib/queries/shows'

interface ShowListItemProps {
  show: ShowWithUserData
  onMarkWatched: (showId: string) => void
}

export default function ShowListItem({ show, onMarkWatched }: ShowListItemProps) {
  const { colors } = useTheme()
  const swipeableRef = useRef<Swipeable>(null)

  const handlePress = useCallback(() => {
    router.push(`/show/${show.id}`)
  }, [show.id])

  const posterUrl = getImageUrl(show.poster_path, 'w92')
  const totalEps = show.total_episodes
  const seenEps = show.episodes_seen

  const allCaughtUp = totalEps !== null && totalEps > 0 && seenEps >= totalEps

  const isComplete =
    allCaughtUp &&
    (show.status === 'Ended' || show.status === 'Canceled')

  const isUpToDate = allCaughtUp && !isComplete

  const hasProgress = seenEps > 0 || (totalEps !== null && totalEps > 0)

  const styles = useMemo(() => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainer,
    borderRadius: borderRadius.lg,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  thumbnailContainer: {
    width: 48,
    height: 72,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: colors.surfaceDim,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  thumbnailPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: {
    flex: 1,
    marginLeft: 12,
  },
  title: {
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '600',
    color: colors.onSurface,
    marginBottom: spacing.unit,
  },
  episodeInfo: {
    fontSize: typography.bodyXs.fontSize,
    color: colors.onSurfaceVariant,
    marginBottom: spacing.unit,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  count: {
    fontSize: typography.bodyXs.fontSize,
    color: colors.onSurfaceVariant,
    minWidth: 40,
    textAlign: 'right',
  },
  completeIcon: {
    marginLeft: 8,
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 8,
  },
  progressBarWrapper: {
    flex: 1,
  },
  swipeAction: {
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    width: 64,
    borderRadius: borderRadius.lg,
    marginLeft: 8,
    marginBottom: 8,
  },
  swipeLabel: {
    color: colors.onPrimary,
    fontSize: typography.bodyXs.fontSize,
    fontWeight: '600',
    marginTop: spacing.unit,
  },
}), [colors])

  const lastEpisodeLabel = show.last_watched_episode_data
    ? (() => {
        const data = show.last_watched_episode_data
        if (data.season_number != null && data.episode_number != null) {
          return `S${data.season_number}E${data.episode_number}`
        }
        // Fallback: show episode count if available
        return seenEps > 0 ? `${seenEps} episodes watched` : ''
      })()
    : ''

  const renderRightActions = () => {
    if (isComplete) return null
    return (
      <Pressable
        style={styles.swipeAction}
        onPress={() => {
          onMarkWatched(show.id)
          swipeableRef.current?.close()
        }}
      >
        <Ionicons name="checkmark" size={24} color={colors.onPrimary} />
        <Text style={styles.swipeLabel}>Watch</Text>
      </Pressable>
    )
  }

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={isComplete ? undefined : renderRightActions}
      overshootRight={false}
      rightThreshold={40}
    >
      <Pressable style={styles.container} onPress={handlePress}>
        {/* Thumbnail */}
        <View style={styles.thumbnailContainer}>
          {posterUrl ? (
            <Image
              source={{ uri: posterUrl }}
              style={styles.thumbnail}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          ) : (
            <View style={styles.thumbnailPlaceholder}>
              <Ionicons name="tv-outline" size={20} color={colors.outlineVariant} />
            </View>
          )}
        </View>

        {/* Info */}
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>
            {show.name}
          </Text>

          {lastEpisodeLabel ? (
            <Text style={styles.episodeInfo} numberOfLines={1}>
              {lastEpisodeLabel}
            </Text>
          ) : null}

          {hasProgress && (
            <View style={styles.progressRow}>
              <View style={styles.progressBarWrapper}>
                <ProgressBar
                  episodesSeen={seenEps}
                  totalEpisodes={totalEps || seenEps}
                  height={4}
                />
              </View>
              <Text style={styles.count}>
                {totalEps ? `${Math.min(seenEps, totalEps)}/${totalEps}` : `${seenEps} eps`}
              </Text>
            </View>
          )}

          {!hasProgress && (
            <Text style={styles.episodeInfo}>
              {seenEps > 0 ? `${seenEps} eps` : 'Not started'}
            </Text>
          )}
        </View>

        {/* Right actions */}
        <View style={styles.rightActions}>
          {isComplete && (
            <Ionicons name="checkmark-circle" size={20} color={colors.statusFinished} />
          )}
          {isUpToDate && (
            <Ionicons name="checkmark-circle" size={20} color={colors.statusUpToDate} />
          )}
        </View>
      </Pressable>
    </Swipeable>
  )
}

