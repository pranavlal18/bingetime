// ─── Favorite Shows — full list from Profile with sort chips ───

import { memo, useCallback, useMemo, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Dimensions,
} from 'react-native'
import { FlashList } from '@shopify/flash-list'
import { Image } from 'expo-image'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router, Stack } from 'expo-router'
import { useFavorites } from '@/lib/queries/profile'
import { getImageUrl } from '@/lib/tmdb'
import { typography, spacing, borderRadius } from '@/theme'
import { useTheme } from '@/contexts/ThemeContext'
import type { FavoriteShow } from '@/lib/queries/profile'

const SCREEN_WIDTH = Dimensions.get('window').width
const GRID_GAP = 12
const GRID_PADDING = spacing.marginMobile
const GRID_COLS = 3
const GRID_POSTER_W = (SCREEN_WIDTH - GRID_PADDING * 2 - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS
const GRID_POSTER_H = GRID_POSTER_W * 1.5

// ── Sort type ──

type SortMode = 'recent' | 'alpha'

// ── Format date ──

function formatFavDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── Sort Chip ──

interface SortChipProps {
  label: string
  icon: keyof typeof Ionicons.glyphMap
  isActive: boolean
  onPress: () => void
}

const SortChip = memo(function SortChip({ label, icon, isActive, onPress }: SortChipProps) {
  const { colors } = useTheme()

  const chipStyles = useMemo(
    () =>
      StyleSheet.create({
        chip: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 14,
          height: 34,
          borderRadius: borderRadius.full,
          borderWidth: 1,
          borderColor: colors.outlineVariant,
          backgroundColor: colors.surfaceContainerLow,
          gap: 6,
        },
        chipActive: {
          backgroundColor: colors.primary,
          borderColor: colors.primary,
        },
        chipLabel: {
          fontSize: 13,
          fontWeight: '600',
          color: colors.onSurfaceVariant,
        },
        chipLabelActive: {
          color: colors.onPrimary,
        },
      }),
    [colors],
  )

  return (
    <Pressable
      style={[chipStyles.chip, isActive && chipStyles.chipActive]}
      onPress={onPress}
    >
      <Ionicons
        name={icon}
        size={14}
        color={isActive ? colors.onPrimary : colors.onSurfaceVariant}
      />
      <Text style={[chipStyles.chipLabel, isActive && chipStyles.chipLabelActive]}>
        {label}
      </Text>
    </Pressable>
  )
})

// ── Grid Item ──

interface GridItemProps {
  name: string
  posterPath: string | null
  favoritedAt: string | null
  onPress: () => void
}

const GridItem = memo(function GridItem({ name, posterPath, favoritedAt, onPress }: GridItemProps) {
  const { colors } = useTheme()
  const posterUrl = getImageUrl(posterPath, 'w185')

  const gridStyles = useMemo(
    () =>
      StyleSheet.create({
        gridItem: {
          width: GRID_POSTER_W,
          marginBottom: GRID_GAP,
          marginRight: GRID_GAP,
        },
        gridPosterContainer: {
          width: GRID_POSTER_W,
          height: GRID_POSTER_H,
          borderRadius: borderRadius.md,
          overflow: 'hidden',
          backgroundColor: colors.surfaceContainer,
          borderWidth: 1,
          borderColor: colors.outlineVariant,
        },
        gridPoster: {
          width: '100%',
          height: '100%',
        },
        gridPosterPlaceholder: {
          justifyContent: 'center',
          alignItems: 'center',
        },
        gridTitle: {
          fontFamily: 'Inter',
          fontSize: 12,
          fontWeight: '600',
          color: colors.onSurface,
          marginTop: 6,
          lineHeight: 16,
        },
        gridDate: {
          fontFamily: 'Inter',
          fontSize: 11,
          fontWeight: '500',
          color: colors.onSurfaceVariant,
          marginTop: 2,
        },
      }),
    [colors],
  )

  return (
    <Pressable style={gridStyles.gridItem} onPress={onPress}>
      <View style={gridStyles.gridPosterContainer}>
        {posterUrl ? (
          <Image
            source={{ uri: posterUrl }}
            style={gridStyles.gridPoster}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={[gridStyles.gridPoster, gridStyles.gridPosterPlaceholder]}>
            <Ionicons name="tv-outline" size={24} color={colors.outlineVariant} />
          </View>
        )}
      </View>
      <Text style={gridStyles.gridTitle} numberOfLines={2}>{name}</Text>
      {favoritedAt && (
        <Text style={gridStyles.gridDate}>{formatFavDate(favoritedAt)}</Text>
      )}
    </Pressable>
  )
})

// ── List Item ──

interface ListItemProps {
  name: string
  posterPath: string | null
  episodesSeen: number
  totalEpisodes: number | null
  favoritedAt: string | null
  onPress: () => void
}

const ListItem = memo(function ListItem({
  name, posterPath, episodesSeen, totalEpisodes, favoritedAt, onPress,
}: ListItemProps) {
  const { colors } = useTheme()
  const posterUrl = getImageUrl(posterPath, 'w92')
  const progress = totalEpisodes && totalEpisodes > 0
    ? Math.min(episodesSeen / totalEpisodes, 1)
    : 0
  const progressPercent = Math.round(progress * 100)

  const listStyles = useMemo(
    () =>
      StyleSheet.create({
        listItem: {
          flexDirection: 'row',
          gap: 14,
          paddingVertical: 10,
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(255,255,255,0.04)',
        },
        listPosterContainer: {
          width: 56,
          height: 84,
          borderRadius: borderRadius.sm,
          overflow: 'hidden',
          backgroundColor: colors.surfaceContainer,
        },
        listPoster: {
          width: '100%',
          height: '100%',
        },
        listPosterPlaceholder: {
          justifyContent: 'center',
          alignItems: 'center',
        },
        listInfo: {
          flex: 1,
          justifyContent: 'center',
          gap: 4,
        },
        listTitle: {
          fontFamily: 'Inter',
          fontSize: 15,
          fontWeight: '600',
          color: colors.onSurface,
        },
        listMeta: {
          fontFamily: 'Inter',
          fontSize: 12,
          fontWeight: '500',
          color: colors.onSurfaceVariant,
        },
        listProgressTrack: {
          height: 4,
          backgroundColor: colors.surfaceContainerHighest,
          borderRadius: borderRadius.full,
          overflow: 'hidden',
          width: '70%',
        },
        listProgressFill: {
          height: '100%',
          backgroundColor: colors.primary,
          borderRadius: borderRadius.full,
        },
        listDate: {
          fontFamily: 'Inter',
          fontSize: 11,
          fontWeight: '500',
          color: colors.onSurfaceVariant,
          marginTop: 2,
        },
      }),
    [colors],
  )

  return (
    <Pressable style={listStyles.listItem} onPress={onPress}>
      <View style={listStyles.listPosterContainer}>
        {posterUrl ? (
          <Image
            source={{ uri: posterUrl }}
            style={listStyles.listPoster}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={[listStyles.listPoster, listStyles.listPosterPlaceholder]}>
            <Ionicons name="tv-outline" size={20} color={colors.outlineVariant} />
          </View>
        )}
      </View>
      <View style={listStyles.listInfo}>
        <Text style={listStyles.listTitle} numberOfLines={1}>{name}</Text>
        <Text style={listStyles.listMeta}>
          {episodesSeen}{totalEpisodes ? ` / ${totalEpisodes}` : ''} episodes
        </Text>
        <View style={listStyles.listProgressTrack}>
          <View style={[listStyles.listProgressFill, { width: `${progressPercent}%` }]} />
        </View>
        {favoritedAt && (
          <Text style={listStyles.listDate}>Favorited {formatFavDate(favoritedAt)}</Text>
        )}
      </View>
    </Pressable>
  )
})

// ── Main Screen ──

export default function FavoriteShowsScreen() {
  const insets = useSafeAreaInsets()
  const { colors } = useTheme()
  const { data: shows, isLoading, isRefetching, refetch } = useFavorites()
  const [sortMode, setSortMode] = useState<SortMode>('recent')
  const [isGrid, setIsGrid] = useState(true)

  // ── Styles ──

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.surface,
        },
        centered: {
          justifyContent: 'center',
          alignItems: 'center',
        },

        // ── AppBar ──
        appBar: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.marginMobile,
          height: 56,
          gap: 12,
        },
        backBtn: {
          width: 40,
          height: 40,
          borderRadius: borderRadius.full,
          justifyContent: 'center',
          alignItems: 'center',
        },
        appBarTitle: {
          flex: 1,
          fontFamily: 'Inter',
          fontSize: 22,
          fontWeight: '700',
          color: colors.onSurface,
          letterSpacing: -0.01,
        },
        gridToggle: {
          width: 40,
          height: 40,
          borderRadius: borderRadius.full,
          justifyContent: 'center',
          alignItems: 'center',
        },

        // ── Sort Chips ──
        chipsContainer: {
          paddingVertical: spacing.stackSm,
        },
        chipsContent: {
          paddingHorizontal: spacing.marginMobile,
          gap: 8,
          flexDirection: 'row',
        },

        // ── List ──
        listContent: {
          paddingHorizontal: spacing.marginMobile,
          paddingBottom: 32,
          paddingTop: spacing.stackSm,
        },
        listContentEmpty: {
          flex: 1,
          justifyContent: 'center',
        },

        // ── Empty State ──
        emptyState: {
          alignItems: 'center',
          paddingHorizontal: 48,
        },
        emptyTitle: {
          fontFamily: 'Inter',
          fontSize: 18,
          fontWeight: '700',
          color: colors.onSurface,
          marginTop: 16,
          marginBottom: 8,
        },
        emptySubtitle: {
          fontSize: 14,
          color: colors.outline,
          textAlign: 'center',
          lineHeight: 20,
        },
      }),
    [colors],
  )

  // ── Sort ──

  const sortedShows = useMemo(() => {
    if (!shows) return []
    const list = [...shows]
    if (sortMode === 'alpha') {
      list.sort((a, b) => a.name.localeCompare(b.name))
    }
    return list
  }, [shows, sortMode])

  // ── Callbacks ──

  const toggleViewMode = useCallback(() => {
    setIsGrid((g) => !g)
  }, [])

  const renderGridItem = useCallback(
    ({ item }: { item: FavoriteShow }) => (
      <GridItem
        name={item.name}
        posterPath={item.poster_path}
        favoritedAt={item.favorited_at}
        onPress={() => router.push(`/show/${item.id}`)}
      />
    ),
    [],
  )

  const renderListItem = useCallback(
    ({ item }: { item: FavoriteShow }) => (
      <ListItem
        name={item.name}
        posterPath={item.poster_path}
        episodesSeen={item.episodes_seen}
        totalEpisodes={item.total_episodes}
        favoritedAt={item.favorited_at}
        onPress={() => router.push(`/show/${item.id}`)}
      />
    ),
    [],
  )

  const keyExtractor = useCallback((item: FavoriteShow) => item.id, [])

  const renderEmptyState = useCallback(
    () => (
      <View style={styles.emptyState}>
        <Ionicons name="heart-outline" size={48} color={colors.outline} />
        <Text style={styles.emptyTitle}>No favorite shows</Text>
        <Text style={styles.emptySubtitle}>
          Tap the heart icon on a show to add it here.
        </Text>
      </View>
    ),
    [colors, styles],
  )

  // ── Loading ──

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  // ── Render ──

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── AppBar ── */}
      <View style={styles.appBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.appBarTitle}>Favorite Shows</Text>
        <Pressable onPress={toggleViewMode} style={styles.gridToggle}>
          <Ionicons
            name={isGrid ? 'list-outline' : 'grid-outline'}
            size={20}
            color={colors.onSurfaceVariant}
          />
        </Pressable>
      </View>

      {/* ── Sort Chips ── */}
      <View style={styles.chipsContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsContent}
        >
          <SortChip
            label="Recent"
            icon="time-outline"
            isActive={sortMode === 'recent'}
            onPress={() => setSortMode('recent')}
          />
          <SortChip
            label="A–Z"
            icon="text-outline"
            isActive={sortMode === 'alpha'}
            onPress={() => setSortMode('alpha')}
          />
        </ScrollView>
      </View>

      {/* ── Content ── */}
      <FlashList
        data={sortedShows}
        keyExtractor={keyExtractor}
        renderItem={isGrid ? renderGridItem : renderListItem}
        numColumns={isGrid ? GRID_COLS : 1}
        key={isGrid ? 'grid' : 'list'}
        contentContainerStyle={[
          styles.listContent,
          sortedShows.length === 0 && styles.listContentEmpty,
        ]}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  )
}
