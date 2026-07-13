// ─── Episode Detail Modal — full detail bottom-sheet ───

import { useCallback } from 'react'
import { View, Text, Pressable, Modal, StyleSheet, Dimensions, ScrollView } from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { getImageUrl } from '@/lib/tmdb'
import { colors, typography, spacing, borderRadius } from '@/theme'
import type { EpisodeWithStatus } from '@/lib/queries/episodes'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const MODAL_TOP_OFFSET = 80

interface EpisodeDetailModalProps {
  visible: boolean
  episode: EpisodeWithStatus | null
  seasonNumber: number
  onClose: () => void
  onToggleWatched: (episode: EpisodeWithStatus) => void
  isPending: boolean
  isAired: boolean
}

export default function EpisodeDetailModal({
  visible,
  episode,
  seasonNumber,
  onClose,
  onToggleWatched,
  isPending,
  isAired,
}: EpisodeDetailModalProps) {
  if (!episode) return null

  const stillUrl = episode.stillPath ? getImageUrl(episode.stillPath, 'w500') : null

  const handleToggle = useCallback(() => {
    onToggleWatched(episode)
  }, [episode, onToggleWatched])

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      {/* Backdrop — tap to dismiss */}
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View />
      </Pressable>

      {/* Sheet */}
      <View style={styles.sheet}>
        {/* Drag indicator */}
        <View style={styles.indicator} />

        <ScrollView
          style={styles.sheetScroll}
          contentContainerStyle={styles.sheetContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Still image or gradient placeholder */}
          <View style={styles.stillContainer}>
            {stillUrl ? (
              <Image
                source={{ uri: stillUrl }}
                style={styles.stillImage}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
            ) : (
              <LinearGradient
                colors={[colors.primary + '40', colors.surfaceContainer]}
                style={styles.stillPlaceholder}
              >
                <Ionicons name="tv-outline" size={40} color={colors.primary} />
              </LinearGradient>
            )}
          </View>

          {/* Episode info */}
          <View style={styles.infoSection}>
            <Text style={styles.episodeSubtitle}>
              Season {seasonNumber}, Episode {episode.episodeNumber}
              {episode.airDate ? ` — ${episode.airDate}` : ''}
            </Text>
            <Text style={styles.episodeTitle}>{episode.title}</Text>

            {/* Status badge */}
            <View
              style={[
                styles.statusBadge,
                episode.watched && styles.statusBadgeWatched,
              ]}
            >
              <Ionicons
                name={episode.watched ? 'checkmark-circle' : 'time-outline'}
                size={16}
                color={episode.watched ? colors.success : colors.onSurfaceVariant}
              />
              <Text
                style={[
                  styles.statusBadgeText,
                  episode.watched && styles.statusBadgeTextWatched,
                ]}
              >
                {episode.watched ? 'Watched' : 'Unwatched'}
              </Text>
            </View>

            {/* Overview */}
            {episode.overview ? (
              <View style={styles.overviewSection}>
                <Text style={styles.sectionTitle}>Synopsis</Text>
                <Text style={styles.overviewText}>{episode.overview}</Text>
              </View>
            ) : (
              <View style={styles.overviewSection}>
                <Text style={styles.sectionTitle}>Synopsis</Text>
                <Text style={styles.overviewText}>No overview available.</Text>
              </View>
            )}
          </View>
        </ScrollView>

        {/* Mark Watched / Unwatched button */}
        <View style={styles.actionBar}>
          <Pressable
            style={({ pressed }) => [
              styles.actionButton,
              episode.watched && styles.actionButtonUnwatch,
              !isAired && !episode.watched && styles.actionButtonForce,
              pressed && { opacity: 0.85 },
            ]}
            onPress={handleToggle}
            disabled={isPending}
          >
            <Ionicons
              name={episode.watched ? 'close-circle-outline' : isPending ? 'hourglass-outline' : 'checkmark-circle'}
              size={20}
              color={episode.watched ? colors.onSurface : colors.onPrimary}
            />
            <Text
              style={[
                styles.actionButtonText,
                episode.watched && styles.actionButtonTextUnwatch,
                !isAired && !episode.watched && styles.actionButtonTextForce,
              ]}
            >
              {isPending
                ? 'Updating...'
                : episode.watched
                  ? 'Mark Unwatched'
                  : !isAired
                    ? 'Force Mark Watched'
                    : 'Mark Watched'}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '80%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  indicator: {
    width: 36,
    height: 4,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceContainerHighest,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  sheetScroll: {
    maxHeight: '100%',
  },
  sheetContent: {
    paddingBottom: 16,
  },
  stillContainer: {
    width: '100%',
    height: SCREEN_WIDTH * 0.56,
    overflow: 'hidden',
  },
  stillImage: {
    width: '100%',
    height: '100%',
  },
  stillPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Info
  infoSection: {
    paddingHorizontal: spacing.marginMobile,
    paddingTop: spacing.stackMd,
  },
  episodeSubtitle: {
    fontFamily: 'Inter',
    fontSize: typography.labelSm.fontSize,
    fontWeight: '500',
    lineHeight: typography.labelSm.lineHeight,
    letterSpacing: typography.labelSm.letterSpacing,
    color: colors.onSurfaceVariant,
    marginBottom: 4,
  },
  episodeTitle: {
    fontFamily: 'Inter',
    fontSize: typography.headlineMd.fontSize,
    fontWeight: '700',
    lineHeight: typography.headlineMd.lineHeight,
    color: colors.onSurface,
    marginBottom: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceContainer,
    marginBottom: 20,
  },
  statusBadgeWatched: {
    backgroundColor: 'rgba(79,200,120,0.15)',
  },
  statusBadgeText: {
    fontFamily: 'Inter',
    fontSize: typography.labelSm.fontSize,
    fontWeight: '600',
    lineHeight: typography.labelSm.lineHeight,
    letterSpacing: typography.labelSm.letterSpacing,
    color: colors.onSurfaceVariant,
  },
  statusBadgeTextWatched: {
    color: colors.success,
  },

  // Overview
  overviewSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontFamily: 'Inter',
    fontSize: typography.bodyLg.fontSize,
    fontWeight: '700',
    lineHeight: typography.bodyLg.lineHeight,
    color: colors.onSurface,
    marginBottom: 8,
  },
  overviewText: {
    fontFamily: 'Inter',
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '400',
    lineHeight: typography.bodyMd.lineHeight,
    color: colors.onSurfaceVariant,
    opacity: 0.85,
  },

  // Action bar
  actionBar: {
    paddingHorizontal: spacing.marginMobile,
    paddingVertical: spacing.stackMd,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary,
  },
  actionButtonUnwatch: {
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  actionButtonForce: {
    backgroundColor: colors.tertiary,
  },
  actionButtonText: {
    fontFamily: 'Inter',
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '700',
    lineHeight: typography.bodyMd.lineHeight,
    color: colors.onPrimary,
  },
  actionButtonTextUnwatch: {
    color: colors.onSurface,
  },
  actionButtonTextForce: {
    color: colors.onTertiary,
  },
})
