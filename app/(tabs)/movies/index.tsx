// ─── Movies Tab — poster grid / thumbnail list ───

import { useCallback, useMemo } from 'react'
import { View, Text, Pressable, StyleSheet, ActivityIndicator, RefreshControl, Alert } from 'react-native'
import { FlashList } from '@shopify/flash-list'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useMovies, useMarkMovieWatched, useRefreshMoviePosters } from '@/lib/queries/movies'
import { useAppStore } from '@/stores/appStore'
import MovieCard from '@/components/movies/MovieCard'
import MovieListItem from '@/components/movies/MovieListItem'
import type { MovieWithUserData } from '@/lib/queries/movies'

export default function MoviesScreen() {
  const insets = useSafeAreaInsets()
  const viewMode = useAppStore((s) => s.viewMode)
  const setViewMode = useAppStore((s) => s.setViewMode)

  const { data: movies, isLoading, isRefetching, refetch } = useMovies()
  const markWatchedMutation = useMarkMovieWatched()
  const refreshPostersMutation = useRefreshMoviePosters()

  const isGrid = viewMode === 'poster-grid'

  const handleMarkWatched = useCallback(
    (movieId: string) => {
      markWatchedMutation.mutate(movieId)
    },
    [markWatchedMutation]
  )

  const toggleViewMode = useCallback(() => {
    setViewMode(isGrid ? 'thumbnail-list' : 'poster-grid')
  }, [isGrid, setViewMode])

  const handleRefreshPosters = useCallback(() => {
    Alert.alert(
      'Refresh Posters',
      'This will fetch missing poster images from TMDb. This may take a moment.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Refresh',
          onPress: () => {
            refreshPostersMutation.mutate(undefined, {
              onSuccess: (result) => {
                Alert.alert('Done', `Updated ${result.updated} movie poster(s).`)
              },
              onError: (error) => {
                Alert.alert('Error', error.message)
              },
            })
          },
        },
      ]
    )
  }, [refreshPostersMutation])

  const renderItem = useCallback(
    ({ item }: { item: MovieWithUserData }) => {
      if (isGrid) {
        return <MovieCard movie={item} onMarkWatched={handleMarkWatched} />
      }
      return <MovieListItem movie={item} onMarkWatched={handleMarkWatched} />
    },
    [isGrid, handleMarkWatched]
  )

  const keyExtractor = useCallback((item: MovieWithUserData) => item.id, [])

  const emptyState = useMemo(() => {
    if (isLoading) return null
    return (
      <View style={styles.emptyState}>
        <Ionicons name="film-outline" size={48} color="#444" />
        <Text style={styles.emptyTitle}>No movies yet</Text>
        <Text style={styles.emptySubtitle}>
          Import your TV Time data or start adding movies from Discover
        </Text>
      </View>
    )
  }, [isLoading])

  // Loading state
  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#6C63FF" />
        <Text style={styles.loadingText}>Loading your movies...</Text>
      </View>
    )
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Movies</Text>
        <View style={styles.headerActions}>
          {refreshPostersMutation.isPending ? (
            <View style={styles.headerButton}>
              <ActivityIndicator size="small" color="#6C63FF" />
            </View>
          ) : (
            <Pressable onPress={handleRefreshPosters} style={styles.headerButton}>
              <Ionicons name="image-outline" size={20} color="#888" />
            </Pressable>
          )}
          <Pressable onPress={toggleViewMode} style={styles.headerButton}>
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
        data={movies || []}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        numColumns={isGrid ? 2 : 1}
        key={isGrid ? 'grid' : 'list'}
        estimatedItemSize={isGrid ? 280 : 100}
        contentContainerStyle={[
          styles.listContent,
          movies?.length === 0 && styles.listContentEmpty,
        ]}
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
