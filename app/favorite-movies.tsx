// ─── Favorite Movies — full list from Profile with sort chips ───

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
import { useFavoriteMovies } from '@/lib/queries/movies'
import { getImageUrl } from '@/lib/tmdb'
import { typography, spacing, borderRadius } from '@/theme'
import { useTheme } from '@/contexts/ThemeContext'
import type { FavoriteMovie } from '@/lib/queries/movies'

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
  const chipStyles = useMemo(() => StyleSheet.create({
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
  }), [colors])
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
  title: string
  posterPath: string | null
  favoritedAt: string | null
  onPress: () => void
}

const GridItem = memo(function GridItem({ title, posterPath, favoritedAt, onPress }: GridItemProps) {
  const { colors } = useTheme()
  const posterUrl = getImageUrl(posterPath, 'w185')
  const gridStyles = useMemo(() => StyleSheet.create({
    item: {
      width: GRID_POSTER_W,
      marginBottom: GRID_GAP,
      marginRight: GRID_GAP,
    },
    posterContainer: {
      width: GRID_POSTER_W,
      height: GRID_POSTER_H,
      borderRadius: borderRadius.md,
      overflow: 'hidden',
      backgroundColor: colors.surfaceContainer,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
    },
    poster: {
      width: '100%',
      height: '100%',
    },
    posterPlaceholder: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    title: {
      fontFamily: 'Inter',
      fontSize: 12,
      fontWeight: '600',
      color: colors.onSurface,
      marginTop: 6,
      lineHeight: 16,
    },
    date: {
      fontFamily: 'Inter',
      fontSize: 11,
      fontWeight: '500',
      color: colors.onSurfaceVariant,
      marginTop: 2,
    },
  }), [colors])
  return (
    <Pressable style={gridStyles.item} onPress={onPress}>
      <View style={gridStyles.posterContainer}>
        {posterUrl ? (
          <Image
            source={{ uri: posterUrl }}
            style={gridStyles.poster}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={[gridStyles.poster, gridStyles.posterPlaceholder]}>
            <Ionicons name="film-outline" size={24} color={colors.outlineVariant} />
          </View>
        )}
      </View>
      <Text style={gridStyles.title} numberOfLines={2}>{title}</Text>
      {favoritedAt && (
        <Text style={gridStyles.date}>{formatFavDate(favoritedAt)}</Text>
      )}
    </Pressable>
  )
})

// ── List Item ──

interface ListItemProps {
  title: string
  posterPath: string | null
  year: string | null
  watched: boolean
  favoritedAt: string | null
  onPress: () => void
}

const ListItem = memo(function ListItem({
  title, posterPath, year, watched, favoritedAt, onPress,
}: ListItemProps) {
  const { colors } = useTheme()
  const posterUrl = getImageUrl(posterPath, 'w92')
  const listItemStyles = useMemo(() => StyleSheet.create({
    item: {
      flexDirection: 'row',
      gap: 14,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255,255,255,0.04)',
    },
    posterContainer: {
      width: 56,
      height: 84,
      borderRadius: borderRadius.sm,
      overflow: 'hidden',
      backgroundColor: colors.surfaceContainer,
    },
    poster: {
      width: '100%',
      height: '100%',
    },
    posterPlaceholder: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    info: {
      flex: 1,
      justifyContent: 'center',
      gap: 4,
    },
    title: {
      fontFamily: 'Inter',
      fontSize: 15,
      fontWeight: '600',
      color: colors.onSurface,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    meta: {
      fontFamily: 'Inter',
      fontSize: 12,
      fontWeight: '500',
      color: colors.onSurfaceVariant,
    },
    metaDot: {
      width: 3,
      height: 3,
      borderRadius: borderRadius.full,
      backgroundColor: colors.onSurfaceVariant,
      opacity: 0.4,
    },
    date: {
      fontFamily: 'Inter',
      fontSize: 11,
      fontWeight: '500',
      color: colors.onSurfaceVariant,
      marginTop: 2,
    },
  }), [colors])

  return (
    <Pressable style={listItemStyles.item} onPress={onPress}>
      <View style={listItemStyles.posterContainer}>
        {posterUrl ? (
          <Image
            source={{ uri: posterUrl }}
            style={listItemStyles.poster}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={[listItemStyles.poster, listItemStyles.posterPlaceholder]}>
            <Ionicons name="film-outline" size={20} color={colors.outlineVariant} />
          </View>
        )}
      </View>
      <View style={listItemStyles.info}>
        <Text style={listItemStyles.title} numberOfLines={1}>{title}</Text>
        <View style={listItemStyles.metaRow}>
          {year && <Text style={listItemStyles.meta}>{year}</Text>}
          {watched && (
            <>
              <View style={listItemStyles.metaDot} />
              <Ionicons name="checkmark-circle" size={12} color={colors.success} />
              <Text style={[listItemStyles.meta, { color: colors.success }]}>Watched</Text>
            </>
          )}
        </View>
        {favoritedAt && (
          <Text style={listItemStyles.date}>Favorited {formatFavDate(favoritedAt)}</Text>
        )}
      </View>
    </Pressable>
  )
})

// ── Main Screen ──

export default function FavoriteMoviesScreen() {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const { data: movies, isLoading, isRefetching, refetch } = useFavoriteMovies()
  const [sortMode, setSortMode] = useState<SortMode>('recent')
  const [isGrid, setIsGrid] = useState(true)

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.surface,
    },
    centered: {
      justifyContent: 'center',
      alignItems: 'center',
    },
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
    chipsContainer: {
      paddingVertical: spacing.stackSm,
    },
    chipsContent: {
      paddingHorizontal: spacing.marginMobile,
      gap: 8,
      flexDirection: 'row',
    },
    listContent: {
      paddingHorizontal: spacing.marginMobile,
      paddingBottom: 32,
      paddingTop: spacing.stackSm,
    },
    listContentEmpty: {
      flex: 1,
      justifyContent: 'center',
    },
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
  }), [colors])

  // ── Sort ──

  const sortedMovies = useMemo(() => {
    if (!movies) return []
    const list = [...movies]
    if (sortMode === 'alpha') {
      list.sort((a, b) => a.title.localeCompare(b.title))
    }
    // 'recent' is default from the query (favorited_at DESC)
    return list
  }, [movies, sortMode])

  // ── Callbacks ──

  const toggleViewMode = useCallback(() => {
    setIsGrid((g) => !g)
  }, [])

  const renderGridItem = useCallback(
    ({ item }: { item: FavoriteMovie }) => (
      <GridItem
        title={item.title}
        posterPath={item.poster_path}
        favoritedAt={item.favorited_at}
        onPress={() => router.push(`/movie/${item.id}`)}
      />
    ),
    []
  )

  const renderListItem = useCallback(
    ({ item }: { item: FavoriteMovie }) => (
      <ListItem
        title={item.title}
        posterPath={item.poster_path}
        year={item.release_date?.slice(0, 4) ?? null}
        watched={item.watched}
        favoritedAt={item.favorited_at}
        onPress={() => router.push(`/movie/${item.id}`)}
      />
    ),
    []
  )

  const keyExtractor = useCallback((item: FavoriteMovie) => item.id, [])

  const renderEmptyState = useCallback(() => (
    <View style={styles.emptyState}>
      <Ionicons name="heart-outline" size={48} color={colors.outline} />
      <Text style={styles.emptyTitle}>No favorite movies</Text>
      <Text style={styles.emptySubtitle}>
        Tap the heart icon on a movie to add it here.
      </Text>
    </View>
  ), [styles, colors])

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
        <Text style={styles.appBarTitle}>Favorite Movies</Text>
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
        data={sortedMovies}
        keyExtractor={keyExtractor}
        renderItem={isGrid ? renderGridItem : renderListItem}
        numColumns={isGrid ? GRID_COLS : 1}
        key={isGrid ? 'grid' : 'list'}
        contentContainerStyle={[
          styles.listContent,
          sortedMovies.length === 0 && styles.listContentEmpty,
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

