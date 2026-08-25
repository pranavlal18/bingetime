// ─── CollectionBrowser — shared screen for genre / network / company pages ───
// Header (back + brand logo or title), sort bottom sheet, sticky count bar,
// and a 2-column poster grid with infinite scroll over TMDb discover.

import { useCallback, useMemo, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native'
import { FlashList } from '@shopify/flash-list'
import { router, Stack } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useQueryClient } from '@tanstack/react-query'
import {
  useDiscoverTitles,
  BROWSE_SORT_OPTIONS,
  type DiscoverTitle,
} from '@/lib/queries/discover'
import { prefetchTitleDetails } from '@/lib/queries/prefetch'
import { getImageUrl, type DiscoverFilterKind, type GenreSortBy } from '@/lib/tmdb'
import { borderRadius, spacing } from '@/theme'
import { useTheme } from '@/contexts/ThemeContext'
import ErrorState from '@/components/ui/ErrorState'
import BrowseSortSheet from '@/components/discover/BrowseSortSheet'

// Grid geometry: 20dp side padding, 8dp column gap → 171dp cards @ 390dp screen
const SIDE_OFFSET = 20
const COL_GAP = 8
const TITLE_LINE = 18
const TITLE_LINES = 2
// Reserved title block: fixed height so long titles never push the next row down
const TITLE_BLOCK_HEIGHT = TITLE_LINES * TITLE_LINE
// FlashList v2 has no columnWrapperStyle — gutter comes from per-item
// horizontal padding, so container padding shrinks by half a gutter to keep
// outer edges at exactly SIDE_OFFSET and center gutter at COL_GAP.
const CONTENT_PAD = SIDE_OFFSET - COL_GAP / 2

function TitleCard({ item }: { item: DiscoverTitle }) {
  const queryClient = useQueryClient()
  const { colors } = useTheme()
  const { width: winW } = useWindowDimensions()

  // Exact same visual metrics as the original genre grid: (W - 40 side - 8 gutter) / 2
  const cardW = (winW - SIDE_OFFSET * 2 - COL_GAP) / 2
  const posterH = cardW * 1.5

  const posterUrl = getImageUrl(item.poster_path, 'w342')
  const placeholderUrl = getImageUrl(item.poster_path, 'w92')

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          width: '100%',
          marginBottom: 20,
        },
        posterContainer: {
          width: '100%',
          height: posterH,
          borderRadius: borderRadius.md,
          overflow: 'hidden',
          backgroundColor: colors.surfaceDim,
          borderWidth: 1,
          borderColor: colors.outlineVariant,
        },
        poster: {
          width: '100%',
          height: '100%',
        },
        posterFallback: {
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
        },
        title: {
          fontFamily: 'Inter',
          fontSize: 13,
          fontWeight: '600',
          color: colors.onSurface,
          marginTop: 10,
          lineHeight: TITLE_LINE,
          // Fixed reserve so every card occupies the same height regardless
          // of whether the title wraps to 2 lines
          height: TITLE_BLOCK_HEIGHT,
          overflow: 'hidden',
        },
        year: {
          fontFamily: 'Inter',
          fontSize: 11,
          fontWeight: '400',
          color: colors.onSurfaceVariant,
          marginTop: 3,
        },
      }),
    [colors]
  )

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    prefetchTitleDetails(item.mediaType, item.tmdbId, queryClient)
    router.push(
      item.mediaType === 'tv' ? `/show/${item.tmdbId}` : `/movie/${item.tmdbId}`
    )
  }, [item, queryClient])

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.6 }]}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}${item.year ? ` (${item.year})` : ''}`}
    >
      <View style={styles.posterContainer}>
        {posterUrl ? (
          <Image
            source={{ uri: posterUrl }}
            placeholder={placeholderUrl ? { uri: placeholderUrl } : undefined}
            recyclingKey={posterUrl ?? undefined}
            style={styles.poster}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={150}
          />
        ) : (
          <View style={styles.posterFallback}>
            <Ionicons
              name={item.mediaType === 'tv' ? 'tv-outline' : 'film-outline'}
              size={28}
              color={colors.outlineVariant}
            />
          </View>
        )}
      </View>
      <Text numberOfLines={2} ellipsizeMode="tail" style={styles.title}>
        {item.title}
      </Text>
      {/* Always rendered so years align across cards */}
      <Text numberOfLines={1} ellipsizeMode="tail" style={styles.year}>
        {item.year ?? ''}
      </Text>
    </Pressable>
  )
}

export interface CollectionBrowserProps {
  kind: DiscoverFilterKind
  /** TMDb id of the genre / network / company; null = invalid params */
  id: number | null
  name: string
  mediaType: 'tv' | 'movie'
  /** Optional TMDb logo path shown in the header instead of the text title */
  logoPath?: string | null
  /** Copy overrides so each page reads naturally */
  loadingLabel?: string
  invalidMessage?: string
  emptyMessage?: string
}

export default function CollectionBrowser({
  kind,
  id,
  name,
  mediaType,
  logoPath,
  loadingLabel,
  invalidMessage,
  emptyMessage,
}: CollectionBrowserProps) {
  const insets = useSafeAreaInsets()
  const { colors } = useTheme()

  const [sortBy, setSortBy] = useState<GenreSortBy>('popularity.desc')
  const [sheetVisible, setSheetVisible] = useState(false)
  const sortLabel = useMemo(
    () => BROWSE_SORT_OPTIONS[mediaType].find((o) => o.value === sortBy)?.label ?? 'Popular',
    [mediaType, sortBy]
  )

  const headerLogoUrl = getImageUrl(logoPath ?? null, 'w154')

  const {
    data,
    isLoading,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useDiscoverTitles(mediaType, kind, id, sortBy)

  const titles = useMemo(
    () => (data ? data.pages.flatMap((p) => p.items) : []),
    [data]
  )

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.background,
        },
        centered: {
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
        },
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.marginMobile,
          height: 56,
          marginBottom: 24,
          gap: 4,
        },
        backButton: {
          width: 36,
          height: 36,
          borderRadius: borderRadius.full,
          justifyContent: 'center',
          alignItems: 'center',
          marginLeft: -8,
        },
        headerLogo: {
          height: 26,
          maxWidth: '70%',
          marginLeft: 6,
        },
        headerTitle: {
          fontFamily: 'Inter',
          fontSize: 20,
          fontWeight: '700',
          color: colors.onSurface,
        },
        gridContent: {
          paddingHorizontal: SIDE_OFFSET,
        },
        loadingText: {
          fontFamily: 'Inter',
          fontSize: 14,
          color: colors.outline,
          marginTop: spacing.stackSm,
        },
        emptyState: {
          paddingTop: 80,
          alignItems: 'center',
          gap: 12,
        },
        emptyText: {
          fontFamily: 'Inter',
          fontSize: 14,
          color: colors.outlineVariant,
          textAlign: 'center',
        },
        footerLoader: {
          paddingVertical: 24,
        },
      }),
    [colors]
  )

  const renderItem = useCallback(
    ({ item }: { item: DiscoverTitle }) => (
      // Half-gutter padding on every cell = COL_GAP center gutter (v2 grid)
      <View style={{ flex: 1, paddingHorizontal: COL_GAP / 2 }}>
        <TitleCard item={item} />
      </View>
    ),
    []
  )

  const keyExtractor = useCallback(
    (item: DiscoverTitle) => `${item.mediaType}-${item.tmdbId}`,
    []
  )

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  // ── Invalid params ──
  if (!id) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <Ionicons name="alert-circle-outline" size={48} color={colors.onSurfaceVariant} />
        <Text style={styles.emptyText}>{invalidMessage ?? 'Could not load page'}</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={[styles.emptyText, { color: colors.primary }]}>Go back</Text>
        </Pressable>
      </View>
    )
  }

  // ── Loading ──
  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>{loadingLabel ?? `Loading ${name}...`}</Text>
      </View>
    )
  }

  // ── Error ──
  if (error) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ErrorState title={`Failed to load ${name}`} onRetry={refetch} onGoBack={() => router.back()} />
      </View>
    )
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={24} color={colors.primary} />
        </Pressable>
        {headerLogoUrl ? (
          <Image
            source={{ uri: headerLogoUrl }}
            recyclingKey={headerLogoUrl}
            style={styles.headerLogo}
            contentFit="contain"
            cachePolicy="memory-disk"
            transition={150}
            accessibilityLabel={name}
          />
        ) : (
          <Text style={styles.headerTitle} numberOfLines={1}>
            {name}
          </Text>
        )}
      </View>

      {/* Grid */}
      <FlashList
        data={titles}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        numColumns={2}
        // Horizontal padding lives ONLY in contentContainerStyle — per-item
        // half-gutter wrappers create the center gutter. Keeps cards flush at
        // 20dp from each screen edge with an 8dp center gutter.
        contentContainerStyle={[styles.gridContent, { paddingHorizontal: CONTENT_PAD, paddingBottom: 80 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          isFetchingNextPage ? (
            <ActivityIndicator style={styles.footerLoader} color={colors.primary} />
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="film-outline" size={48} color={colors.outlineVariant} />
            <Text style={styles.emptyText}>{emptyMessage ?? `No titles found in ${name}`}</Text>
          </View>
        }
      />

      {/* Sticky bottom bar — Spotify-style */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: spacing.marginMobile,
          paddingVertical: 12,
          paddingBottom: 12 + insets.bottom,
          backgroundColor: colors.surfaceContainer,
          borderTopWidth: 1,
          borderTopColor: colors.outlineVariant,
        }}
      >
        <Pressable
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            backgroundColor: colors.surfaceContainerHigh,
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: borderRadius.full,
            borderWidth: 1,
            borderColor: colors.outlineVariant,
          }}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            setSheetVisible(true)
          }}
          accessibilityRole="button"
          accessibilityLabel={`Sort by ${sortLabel}`}
        >
          <Ionicons name="swap-vertical" size={16} color={colors.onSurface} />
          <Text style={{ fontFamily: 'Inter', fontSize: 13, fontWeight: '600', color: colors.onSurface }}>
            {sortLabel}
          </Text>
          <Ionicons name="chevron-down" size={14} color={colors.onSurfaceVariant} />
        </Pressable>
        <Text style={{ fontFamily: 'Inter', fontSize: 12, color: colors.onSurfaceVariant }}>
          {titles.length} titles
        </Text>
      </View>

      <BrowseSortSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        value={sortBy}
        onChange={setSortBy}
        options={BROWSE_SORT_OPTIONS[mediaType]}
      />
    </View>
  )
}
