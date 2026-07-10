// ─── Profile Tab — stats, favorites, watchlist, custom lists, settings ───

import { useCallback, memo, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native'
import { Image } from 'expo-image'
import { FlashList } from '@shopify/flash-list'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAppStore } from '@/stores/appStore'
import { getImageUrl } from '@/lib/tmdb'
import {
  useProfileStats,
  useFavorites,
  useWatchlist,
  useCustomLists,
  useMarkWatched,
} from '@/lib/queries/profile'
import type {
  ProfileStats,
  FavoriteShow,
  WatchlistShow,
  WatchlistMovie,
} from '@/lib/queries/profile'
import type { List } from '@/types'

// ── Stat Card ──

interface StatCardProps {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  value: number
  color: string
}

const StatCard = memo(function StatCard({ icon, label, value, color }: StatCardProps) {
  return (
    <View style={[styles.statCard, { borderLeftColor: color, borderLeftWidth: 3 }]}>
      <Ionicons name={icon} size={22} color={color} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
})

// ── Favorite Show Card (horizontal item) ──

interface FavoriteCardProps {
  show: FavoriteShow
}

const FavoriteCard = memo(function FavoriteCard({ show }: FavoriteCardProps) {
  const posterUrl = getImageUrl(show.poster_path, 'w185')
  return (
    <Pressable
      style={styles.horizontalCard}
      onPress={() => router.push(`/show/${show.id}`)}
    >
      <View style={styles.horizontalPosterContainer}>
        {posterUrl ? (
          <Image
            source={{ uri: posterUrl }}
            style={styles.horizontalPoster}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={styles.posterPlaceholder}>
            <Ionicons name="tv-outline" size={20} color="#555" />
          </View>
        )}
      </View>
      <Text style={styles.horizontalTitle} numberOfLines={2}>
        {show.name}
      </Text>
      <Text style={styles.horizontalSubtitle}>
        {show.episodes_seen} eps
      </Text>
    </Pressable>
  )
})

// ── Watchlist Show Card (horizontal item) ──

interface WatchlistShowCardProps {
  show: WatchlistShow
}

const WatchlistShowCard = memo(function WatchlistShowCard({
  show,
}: WatchlistShowCardProps) {
  const posterUrl = getImageUrl(show.poster_path, 'w185')
  return (
    <Pressable
      style={styles.horizontalCard}
      onPress={() => router.push(`/show/${show.id}`)}
    >
      <View style={styles.horizontalPosterContainer}>
        {posterUrl ? (
          <Image
            source={{ uri: posterUrl }}
            style={styles.horizontalPoster}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={styles.posterPlaceholder}>
            <Ionicons name="tv-outline" size={20} color="#555" />
          </View>
        )}
        <View style={styles.watchlistBadge}>
          <Ionicons name="time-outline" size={12} color="#FFA726" />
        </View>
      </View>
      <Text style={styles.horizontalTitle} numberOfLines={2}>
        {show.name}
      </Text>
      <Text style={styles.horizontalSubtitle}>
        {show.episodes_seen > 0 ? `${show.episodes_seen} eps seen` : 'Not started'}
      </Text>
    </Pressable>
  )
})

// ── Watchlist Movie Card (horizontal item) ──

interface WatchlistMovieCardProps {
  movie: WatchlistMovie
}

const WatchlistMovieCard = memo(function WatchlistMovieCard({
  movie,
}: WatchlistMovieCardProps) {
  const posterUrl = getImageUrl(movie.poster_path, 'w185')
  const year = movie.release_date ? movie.release_date.slice(0, 4) : null
  return (
    <Pressable
      style={styles.horizontalCard}
      onPress={() => router.push(`/movie/${movie.id}`)}
    >
      <View style={styles.horizontalPosterContainer}>
        {posterUrl ? (
          <Image
            source={{ uri: posterUrl }}
            style={styles.horizontalPoster}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={styles.posterPlaceholder}>
            <Ionicons name="film-outline" size={20} color="#555" />
          </View>
        )}
        <View style={styles.watchlistBadge}>
          <Ionicons name="time-outline" size={12} color="#FFA726" />
        </View>
      </View>
      <Text style={styles.horizontalTitle} numberOfLines={2}>
        {movie.title}
      </Text>
      {year ? (
        <Text style={styles.horizontalSubtitle}>{year}</Text>
      ) : null}
    </Pressable>
  )
})

// ── Custom List Row ──

interface ListRowProps {
  list: List
}

const ListRow = memo(function ListRow({ list }: ListRowProps) {
  const itemCount = list.item_ids?.length ?? 0
  return (
    <View style={styles.listRow}>
      <View style={styles.listIcon}>
        <Ionicons name="list-outline" size={20} color="#6C63FF" />
      </View>
      <View style={styles.listInfo}>
        <Text style={styles.listName} numberOfLines={1}>
          {list.name}
        </Text>
        {list.description ? (
          <Text style={styles.listDescription} numberOfLines={1}>
            {list.description}
          </Text>
        ) : null}
      </View>
      <Text style={styles.listCount}>{itemCount} items</Text>
      <Ionicons name="chevron-forward" size={16} color="#555" />
    </View>
  )
})

// ── Settings Row ──

interface SettingsRowProps {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  subtitle?: string
  right?: React.ReactNode
  onPress?: () => void
}

const SettingsRow = memo(function SettingsRow({
  icon,
  label,
  subtitle,
  right,
  onPress,
}: SettingsRowProps) {
  return (
    <Pressable style={styles.settingsRow} onPress={onPress}>
      <Ionicons name={icon} size={20} color="#888" />
      <View style={styles.settingsInfo}>
        <Text style={styles.settingsLabel}>{label}</Text>
        {subtitle ? (
          <Text style={styles.settingsSubtitle}>{subtitle}</Text>
        ) : null}
      </View>
      {right ?? (
        <Ionicons name="chevron-forward" size={16} color="#555" />
      )}
    </Pressable>
  )
})

// ── Main Screen ──

export default function ProfileScreen() {
  const insets = useSafeAreaInsets()
  const theme = useAppStore((s) => s.theme)
  const setTheme = useAppStore((s) => s.setTheme)
  const showArchived = useAppStore((s) => s.showArchived)
  const toggleShowArchived = useAppStore((s) => s.toggleShowArchived)
  const setImportComplete = useAppStore((s) => s.setImportComplete)

  const { data: stats, isLoading: statsLoading } = useProfileStats()
  const { data: favorites, isLoading: favLoading } = useFavorites()
  const { data: watchlist, isLoading: wlLoading } = useWatchlist()
  const { data: lists, isLoading: listsLoading } = useCustomLists()

  const [showWatchlist, setShowWatchlist] = useState<'shows' | 'movies' | 'all'>('all')

  // ── Renderers ──

  const renderFavorite = useCallback(
    ({ item }: { item: FavoriteShow }) => <FavoriteCard show={item} />,
    []
  )

  const renderWatchlistShow = useCallback(
    ({ item }: { item: WatchlistShow }) => <WatchlistShowCard show={item} />,
    []
  )

  const renderWatchlistMovie = useCallback(
    ({ item }: { item: WatchlistMovie }) => <WatchlistMovieCard movie={item} />,
    []
  )

  const renderList = useCallback(
    ({ item }: { item: List }) => <ListRow list={item} />,
    []
  )

  const keyExtractor = useCallback((item: { id: string }) => item.id, [])

  const cycleTheme = useCallback(() => {
    const themes: Array<'system' | 'light' | 'dark'> = ['system', 'dark', 'light']
    const idx = themes.indexOf(theme)
    setTheme(themes[(idx + 1) % themes.length])
  }, [theme, setTheme])

  const handleReImport = useCallback(() => {
    setImportComplete(false)
  }, [setImportComplete])

  // ── Filtered watchlist ──

  const watchlistShows = watchlist?.shows ?? []
  const watchlistMovies = watchlist?.movies ?? []
  const displayWatchlistShows =
    showWatchlist === 'all' || showWatchlist === 'shows'
      ? watchlistShows
      : []
  const displayWatchlistMovies =
    showWatchlist === 'all' || showWatchlist === 'movies'
      ? watchlistMovies
      : []

  // ── Theme label ──

  const themeLabel =
    theme === 'system' ? 'System' : theme === 'dark' ? 'Dark' : 'Light'

  const themeIcon =
    theme === 'system'
      ? 'settings-outline'
      : theme === 'dark'
        ? 'moon-outline'
        : 'sunny-outline'

  // ── Loading ──

  if (statsLoading) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#6C63FF" />
      </View>
    )
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Ionicons name="person-circle-outline" size={48} color="#6C63FF" />
          </View>
          <Text style={styles.headerTitle}>Your Library</Text>
        </View>

        {/* Stats Grid */}
        {stats ? (
          <View style={styles.statsGrid}>
            <StatCard
              icon="tv-outline"
              label="Shows"
              value={stats.totalShows}
              color="#6C63FF"
            />
            <StatCard
              icon="film-outline"
              label="Movies"
              value={stats.totalMovies}
              color="#4CAF50"
            />
            <StatCard
              icon="play-circle-outline"
              label="Episodes"
              value={stats.totalEpisodes}
              color="#FFA726"
            />
            <StatCard
              icon="list-outline"
              label="Lists"
              value={stats.customLists}
              color="#E040FB"
            />
          </View>
        ) : null}

        {/* Favorites Section */}
        {favorites && favorites.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="heart" size={18} color="#E040FB" />
              <Text style={styles.sectionTitle}>Favorites</Text>
              <Text style={styles.sectionCount}>{favorites.length}</Text>
            </View>
            <FlashList
              data={favorites}
              renderItem={renderFavorite}
              keyExtractor={keyExtractor}
              horizontal
              showsHorizontalScrollIndicator={false}
              estimatedItemSize={100}
              contentContainerStyle={styles.horizontalListContent}
            />
          </View>
        ) : !favLoading ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="heart-outline" size={18} color="#888" />
              <Text style={styles.sectionTitle}>Favorites</Text>
            </View>
            <Text style={styles.emptyText}>No favorites yet</Text>
          </View>
        ) : null}

        {/* Watchlist Section */}
        {watchlistShows.length + watchlistMovies.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="time-outline" size={18} color="#FFA726" />
              <Text style={styles.sectionTitle}>Watchlist</Text>
              <Text style={styles.sectionCount}>
                {watchlistShows.length + watchlistMovies.length}
              </Text>
            </View>

            {/* Filter tabs */}
            <View style={styles.filterRow}>
              <Pressable
                style={[
                  styles.filterChip,
                  showWatchlist === 'all' && styles.filterChipActive,
                ]}
                onPress={() => setShowWatchlist('all')}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    showWatchlist === 'all' && styles.filterChipTextActive,
                  ]}
                >
                  All
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.filterChip,
                  showWatchlist === 'shows' && styles.filterChipActive,
                ]}
                onPress={() => setShowWatchlist('shows')}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    showWatchlist === 'shows' && styles.filterChipTextActive,
                  ]}
                >
                  Shows
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.filterChip,
                  showWatchlist === 'movies' && styles.filterChipActive,
                ]}
                onPress={() => setShowWatchlist('movies')}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    showWatchlist === 'movies' && styles.filterChipTextActive,
                  ]}
                >
                  Movies
                </Text>
              </Pressable>
            </View>

            {displayWatchlistShows.length > 0 ? (
              <FlashList
                data={displayWatchlistShows}
                renderItem={renderWatchlistShow}
                keyExtractor={keyExtractor}
                horizontal
                showsHorizontalScrollIndicator={false}
                estimatedItemSize={100}
                contentContainerStyle={styles.horizontalListContent}
              />
            ) : null}

            {displayWatchlistMovies.length > 0 ? (
              <FlashList
                data={displayWatchlistMovies}
                renderItem={renderWatchlistMovie}
                keyExtractor={keyExtractor}
                horizontal
                showsHorizontalScrollIndicator={false}
                estimatedItemSize={100}
                contentContainerStyle={styles.horizontalListContent}
              />
            ) : null}
          </View>
        ) : !wlLoading ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="time-outline" size={18} color="#888" />
              <Text style={styles.sectionTitle}>Watchlist</Text>
            </View>
            <Text style={styles.emptyText}>Watchlist is empty</Text>
          </View>
        ) : null}

        {/* Custom Lists Section */}
        {lists && lists.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="list-outline" size={18} color="#6C63FF" />
              <Text style={styles.sectionTitle}>Custom Lists</Text>
              <Text style={styles.sectionCount}>{lists.length}</Text>
            </View>
            <View style={styles.listsContainer}>
              <FlashList
                data={lists}
                renderItem={renderList}
                keyExtractor={keyExtractor}
                scrollEnabled={false}
                estimatedItemSize={56}
              />
            </View>
          </View>
        ) : !listsLoading ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="list-outline" size={18} color="#888" />
              <Text style={styles.sectionTitle}>Custom Lists</Text>
            </View>
            <Text style={styles.emptyText}>No custom lists</Text>
          </View>
        ) : null}

        {/* Settings Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="settings-outline" size={18} color="#888" />
            <Text style={styles.sectionTitle}>Settings</Text>
          </View>
          <View style={styles.settingsContainer}>
            <SettingsRow
              icon={themeIcon}
              label="Theme"
              subtitle={themeLabel}
              onPress={cycleTheme}
            />
            <SettingsRow
              icon={showArchived ? 'archive' : 'archive-outline'}
              label="Show Archived"
              subtitle={showArchived ? 'Visible' : 'Hidden'}
              onPress={toggleShowArchived}
            />
            <SettingsRow
              icon="refresh-outline"
              label="Re-import Data"
              subtitle="Import TV Time data again"
              onPress={handleReImport}
            />
          </View>
        </View>

        {/* Bottom spacer for tab bar */}
        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  )
}

// ── Styles ──

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F0F',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingBottom: 24,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFF',
  },

  // Stats
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    gap: 8,
    marginBottom: 8,
  },
  statCard: {
    width: (16 - 12) / 2, // Will be overridden by flex
    flex: 1,
    minWidth: (16 - 12) / 2,
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 14,
    gap: 4,
    borderCurve: 'continuous',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFF',
  },
  statLabel: {
    fontSize: 12,
    color: '#888',
  },

  // Sections
  section: {
    marginTop: 16,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFF',
    flex: 1,
  },
  sectionCount: {
    fontSize: 13,
    color: '#888',
    fontWeight: '600',
  },

  // Horizontal lists
  horizontalListContent: {
    paddingRight: 24,
  },
  horizontalCard: {
    width: 100,
    marginRight: 10,
  },
  horizontalPosterContainer: {
    width: 100,
    height: 150,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#1A1A1A',
    position: 'relative',
  },
  horizontalPoster: {
    width: '100%',
    height: '100%',
  },
  posterPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  horizontalTitle: {
    fontSize: 12,
    color: '#FFF',
    fontWeight: '600',
    marginTop: 4,
    lineHeight: 16,
  },
  horizontalSubtitle: {
    fontSize: 11,
    color: '#888',
    marginTop: 1,
  },
  watchlistBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 10,
    padding: 2,
  },

  // Filter chips
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#1A1A1A',
    borderCurve: 'continuous',
  },
  filterChipActive: {
    backgroundColor: 'rgba(108,99,255,0.2)',
  },
  filterChipText: {
    fontSize: 13,
    color: '#888',
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#6C63FF',
  },

  // Custom lists
  listsContainer: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    overflow: 'hidden',
    borderCurve: 'continuous',
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#2A2A2A',
  },
  listIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(108,99,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  listInfo: {
    flex: 1,
  },
  listName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  listDescription: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  listCount: {
    fontSize: 12,
    color: '#888',
  },

  // Settings
  settingsContainer: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    overflow: 'hidden',
    borderCurve: 'continuous',
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#2A2A2A',
  },
  settingsInfo: {
    flex: 1,
  },
  settingsLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  settingsSubtitle: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },

  // Empty
  emptyText: {
    fontSize: 13,
    color: '#555',
    fontStyle: 'italic',
    marginBottom: 4,
  },
})
