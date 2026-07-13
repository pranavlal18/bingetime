// ─── ShowCard — poster image + progress bar ───

import { useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Pressable,
} from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { getImageUrl } from '@/lib/queries/shows'
import ProgressBar from './ProgressBar'
import { colors, typography, borderRadius, spacing } from '@/theme'
import type { ShowWithUserData } from '@/lib/queries/shows'

const SCREEN_WIDTH = Dimensions.get('window').width
const CARD_WIDTH = (SCREEN_WIDTH - 40 - 16) / 2 // 40 outer margins, 16 gap = 2 cols

interface ShowCardProps {
  show: ShowWithUserData
}

export default function ShowCard({ show }: ShowCardProps) {
  const handlePress = useCallback(() => {
    router.push(`/show/${show.id}`)
  }, [show.id])

  const posterUrl = getImageUrl(show.poster_path, 'w342')
  const totalEps = show.total_episodes
  const seenEps = show.episodes_seen

  const allCaughtUp = totalEps !== null && totalEps > 0 && seenEps >= totalEps

  const isComplete =
    allCaughtUp &&
    (show.status === 'Ended' || show.status === 'Canceled')

  const isUpToDate = allCaughtUp && !isComplete

  const hasProgress = seenEps > 0 || (totalEps !== null && totalEps > 0)

  return (
    <Pressable style={styles.card} onPress={handlePress}>
      {/* Poster */}
      <View style={styles.posterContainer}>
        {posterUrl ? (
          <Image
            source={{ uri: posterUrl }}
            style={styles.poster}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={styles.posterPlaceholder}>
            <Ionicons name="tv-outline" size={32} color={colors.outlineVariant} />
          </View>
        )}

        {/* Complete badge */}
        {isComplete && (
          <View style={styles.completeBadge}>
            <Ionicons name="checkmark-circle" size={18} color={colors.statusFinished} />
          </View>
        )}

        {/* Up to date badge */}
        {isUpToDate && (
          <View style={styles.upToDateBadge}>
            <Ionicons name="checkmark-circle" size={18} color={colors.statusUpToDate} />
          </View>
        )}
      </View>

      {/* Progress bar */}
      {hasProgress && (
        <ProgressBar
          episodesSeen={seenEps}
          totalEpisodes={totalEps}
          height={3}
        />
      )}

      {/* Title */}
      <Text style={styles.title} numberOfLines={2}>
        {show.name}
      </Text>

      {/* Episode count */}
      {seenEps > 0 && (
        <Text style={styles.episodeCount}>
          {totalEps ? `${Math.min(seenEps, totalEps)}/${totalEps}` : `${seenEps} eps`}
        </Text>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    marginBottom: 16,
  },
  posterContainer: {
    width: CARD_WIDTH,
    height: CARD_WIDTH * 1.5,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.surfaceDim,
    position: 'relative',
    borderWidth: 1,
    borderColor: colors.outlineVariant,
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
  completeBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 12,
    padding: spacing.unit,
  },
  upToDateBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 12,
    padding: spacing.unit,
  },
  title: {
    fontSize: typography.bodyXs.fontSize,
    color: colors.onSurface,
    fontWeight: '600',
    marginTop: 8,
    lineHeight: 18,
  },
  episodeCount: {
    fontSize: typography.bodyXs.fontSize,
    color: colors.onSurfaceVariant,
    marginTop: spacing.unit,
  },
})
