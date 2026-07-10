// ─── Season Episode Browser ───

import { useCallback } from 'react'
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native'
import { useLocalSearchParams, router, Stack } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { FlashList } from '@shopify/flash-list'
import { useShow } from '@/lib/queries/shows'
import { useSeasonEpisodes, useToggleEpisodeWatched } from '@/lib/queries/episodes'
import type { EpisodeWithStatus } from '@/lib/queries/episodes'

export default function SeasonScreen() {
  const { id, seasonNumber: sn } = useLocalSearchParams<{ id: string; seasonNumber: string }>()
  const seasonNumber = parseInt(sn || '1', 10)
  const insets = useSafeAreaInsets()

  const { data: show } = useShow(id)
  const { data: season, isLoading, isRefetching, refetch } = useSeasonEpisodes(
    id,
    show?.tmdb_id ?? null,
    seasonNumber
  )
  const toggleMutation = useToggleEpisodeWatched()

  const handleToggle = useCallback(
    (episode: EpisodeWithStatus) => {
      toggleMutation.mutate({
        showId: id,
        seasonNumber,
        episodeNumber: episode.episodeNumber,
        watched: !episode.watched,
      })
    },
    [id, seasonNumber, toggleMutation]
  )

  const handleBack = useCallback(() => {
    router.back()
  }, [])

  // Count watched
  const watchedCount = season?.episodes.filter((e) => e.watched).length ?? 0
  const totalCount = season?.episodes.length ?? 0

  // Loading state
  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#6C63FF" />
        <Text style={styles.loadingText}>Loading episodes...</Text>
      </View>
    )
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={handleBack} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color="#FFF" />
        </Pressable>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {show?.name ?? 'Show'}
          </Text>
          <Text style={styles.headerSubtitle}>
            {season?.seasonName} — {watchedCount}/{totalCount} watched
          </Text>
        </View>
      </View>

      {/* Season overview */}
      {season?.seasonOverview ? (
        <View style={styles.overviewBox}>
          <Text style={styles.overviewText} numberOfLines={3}>
            {season.seasonOverview}
          </Text>
        </View>
      ) : null}

      {/* Episode list */}
      <FlashList
        data={season?.episodes ?? []}
        keyExtractor={(item) => `${item.episodeNumber}`}
        renderItem={({ item }) => (
          <EpisodeRow episode={item} onToggle={handleToggle} isPending={toggleMutation.isPending} />
        )}
        estimatedItemSize={60}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor="#6C63FF"
            colors={['#6C63FF']}
          />
        }
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="film-outline" size={36} color="#444" />
            <Text style={styles.emptyText}>No episodes found</Text>
          </View>
        }
      />
    </View>
  )
}

// ── Episode Row ──

function EpisodeRow({
  episode,
  onToggle,
  isPending,
}: {
  episode: EpisodeWithStatus
  onToggle: (ep: EpisodeWithStatus) => void
  isPending: boolean
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.episodeRow,
        pressed && styles.episodeRowPressed,
      ]}
      onPress={() => onToggle(episode)}
      disabled={isPending}
    >
      {/* Episode number badge */}
      <View
        style={[
          styles.episodeBadge,
          episode.watched && styles.episodeBadgeWatched,
        ]}
      >
        <Text
          style={[
            styles.episodeBadgeText,
            episode.watched && styles.episodeBadgeTextWatched,
          ]}
        >
          {episode.episodeNumber}
        </Text>
      </View>

      {/* Info */}
      <View style={styles.episodeInfo}>
        <Text
          style={[
            styles.episodeTitle,
            episode.watched && styles.episodeTitleWatched,
          ]}
          numberOfLines={1}
        >
          {episode.title}
        </Text>
        {episode.airDate && (
          <Text style={styles.episodeDate}>{episode.airDate}</Text>
        )}
      </View>

      {/* Toggle icon */}
      <Ionicons
        name={episode.watched ? 'checkmark-circle' : 'ellipse-outline'}
        size={22}
        color={episode.watched ? '#4CAF50' : '#555'}
      />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F0F',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: '#888',
    marginTop: 12,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 12,
    gap: 8,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },

  // Overview
  overviewBox: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    padding: 12,
  },
  overviewText: {
    fontSize: 13,
    color: '#AAA',
    lineHeight: 19,
  },

  // List
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },

  // Episode row
  episodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    padding: 12,
    marginBottom: 6,
    gap: 12,
  },
  episodeRowPressed: {
    backgroundColor: '#222',
  },
  episodeBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#2A2A2A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  episodeBadgeWatched: {
    backgroundColor: 'rgba(76,175,80,0.2)',
  },
  episodeBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#888',
  },
  episodeBadgeTextWatched: {
    color: '#4CAF50',
  },
  episodeInfo: {
    flex: 1,
  },
  episodeTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  episodeTitleWatched: {
    color: '#666',
    textDecorationLine: 'line-through',
  },
  episodeDate: {
    fontSize: 11,
    color: '#888',
    marginTop: 2,
  },

  // Empty
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    color: '#888',
    marginTop: 8,
  },
})
