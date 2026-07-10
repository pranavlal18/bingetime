// ─── Shows Tab — poster grid / thumbnail list with Continue Watching ───

import { useCallback, useMemo } from 'react'
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
import { Ionicons } from '@expo/vector-icons'
import { useShows, useContinueWatching, useMarkWatched } from '@/lib/queries/shows'
import { useAppStore } from '@/stores/appStore'
import ShowCard from '@/components/shows/ShowCard'
import ShowListItem from '@/components/shows/ShowListItem'
import ContinueWatchingSection from '@/components/shows/ContinueWatchingSection'
import type { ShowWithUserData } from '@/lib/queries/shows'

export default function ShowsScreen() {
  const insets = useSafeAreaInsets()
  const viewMode = useAppStore((s) => s.viewMode)
  const setViewMode = useAppStore((s) => s.setViewMode)
  const showArchived = useAppStore((s) => s.showArchived)
  const toggleShowArchived = useAppStore((s) => s.toggleShowArchived)

  const { data: shows, isLoading, isRefetching, refetch } = useShows(showArchived)
  const { data: continueWatching, isLoading: cwLoading } = useContinueWatching()
  const markWatchedMutation = useMarkWatched()

  const isGrid = viewMode === 'poster-grid'

  const handleMarkWatched = useCallback(
    (showId: string) => {
      markWatchedMutation.mutate(showId)
    },
    [markWatchedMutation]
  )

  const toggleViewMode = useCallback(() => {
    setViewMode(isGrid ? 'thumbnail-list' : 'poster-grid')
  }, [isGrid, setViewMode])

  const renderItem = useCallback(
    ({ item }: { item: ShowWithUserData }) => {
      if (isGrid) {
        return <ShowCard show={item} onMarkWatched={handleMarkWatched} />
      }
      return <ShowListItem show={item} onMarkWatched={handleMarkWatched} />
    },
    [isGrid, handleMarkWatched]
  )

  const keyExtractor = useCallback((item: ShowWithUserData) => item.id, [])

  const hasContinueWatching = continueWatching && continueWatching.length > 0

  const ListHeader = useMemo(() => {
    if (!hasContinueWatching) return null
    return (
      <ContinueWatchingSection
        shows={continueWatching!}
        isLoading={cwLoading}
      />
    )
  }, [hasContinueWatching, continueWatching, cwLoading])

  const emptyState = useMemo(() => {
    if (isLoading) return null
    return (
      <View style={styles.emptyState}>
        <Ionicons name="tv-outline" size={48} color="#444" />
        <Text style={styles.emptyTitle}>No shows yet</Text>
        <Text style={styles.emptySubtitle}>
          Import your TV Time data or start adding shows from Discover
        </Text>
      </View>
    )
  }, [isLoading])

  // Loading state
  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#6C63FF" />
        <Text style={styles.loadingText}>Loading your shows...</Text>
      </View>
    )
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Shows</Text>
        <View style={styles.headerActions}>
          {/* Archived toggle */}
          <Pressable
            onPress={toggleShowArchived}
            style={[styles.headerButton, showArchived && styles.headerButtonActive]}
          >
            <Ionicons
              name={showArchived ? 'archive' : 'archive-outline'}
              size={20}
              color={showArchived ? '#6C63FF' : '#888'}
            />
          </Pressable>

          {/* View mode toggle */}
          <Pressable
            onPress={toggleViewMode}
            style={styles.headerButton}
          >
            <Ionicons
              name={isGrid ? 'list-outline' : 'grid-outline'}
              size={20}
              color="#888"
            />
          </Pressable>
        </View>
      </View>

      {/* Content */}
      <FlashList
        data={shows || []}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        numColumns={isGrid ? 2 : 1}
        key={isGrid ? 'grid' : 'list'} // Force re-mount on view change to reset numColumns
        estimatedItemSize={isGrid ? 280 : 100}
        contentContainerStyle={[
          styles.listContent,
          shows?.length === 0 && styles.listContentEmpty,
        ]}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={emptyState}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor="#6C63FF"
            colors={['#6C63FF']}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFF',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerButtonActive: {
    backgroundColor: 'rgba(108,99,255,0.15)',
  },

  // List
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
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
    color: '#FFF',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    lineHeight: 20,
  },
})
