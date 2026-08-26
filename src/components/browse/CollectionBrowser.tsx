// ─── CollectionBrowser — shared screen for genre / network / company pages ───
// Header (back + brand logo or title), sort bottom sheet, sticky count bar,
// and a 2-column poster grid with infinite scroll over TMDb discover.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { FlashList } from '@shopify/flash-list'
import { router, Stack } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  interpolate,
} from 'react-native-reanimated'
import { hapticLight } from '@/utils/haptics'
import { useQueryClient } from '@tanstack/react-query'
import {
  useDiscoverTitles,
  useAddToLibrary,
  useRemoveFromLibrary,
  useGenres,
  useMovieWatchProviders,
  BROWSE_SORT_OPTIONS,
  type DiscoverTitle,
} from '@/lib/queries/discover'
import { fetchLibraryStatus } from '@/lib/queries/libraryStatus'
import LibraryBadge from '@/components/ui/LibraryBadge'
import { prefetchTitleDetails } from '@/lib/queries/prefetch'
import { getImageUrl, type DiscoverFilterKind, type GenreSortBy } from '@/lib/tmdb'
import { getLogoIsDark } from '@/utils/logoLuminance'
import { borderRadius, spacing } from '@/theme'
import { useTheme } from '@/contexts/ThemeContext'
import { useAuth } from '@/contexts/AuthContext'
import ErrorState from '@/components/ui/ErrorState'
import BrowseSortSheet from '@/components/discover/BrowseSortSheet'

// Grid geometry: 20dp side padding, 8dp column gap → 171dp cards @ 390dp screen
const SIDE_OFFSET = 20
const COL_GAP = 8
const TITLE_LINE = 18
// FlashList v2 has no columnWrapperStyle — gutter comes from per-item
// horizontal padding, so container padding shrinks by half a gutter to keep
// outer edges at exactly SIDE_OFFSET and center gutter at COL_GAP.
const CONTENT_PAD = SIDE_OFFSET - COL_GAP / 2

// Soft off-white backdrop used behind dark brand logos (see utils/logoLuminance)
const LIGHT_LOGO_TILE = '#ECE9F1'

// ── Media-type counterpart resolution ──
// TMDb genre IDs differ between tv and movie (movie "Action" = 28, tv
// "Action & Adventure" = 10759), so flipping a genre page's media type means
// re-resolving the id by name. A small alias table covers renamed pairs;
// entries with no counterpart disable the other side.
const GENRE_ALIASES: Record<string, string> = {
  'action & adventure': 'action',
  action: 'action & adventure',
  'sci-fi & fantasy': 'science fiction',
  'science fiction': 'sci-fi & fantasy',
  'war & politics': 'war',
  war: 'war & politics',
  'hbo max': 'max',
}

function normalizeGenreName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

function resolveCounterpartId(
  sourceName: string,
  targetGenres: { id: number; name: string }[] | undefined
): number | null {
  if (!targetGenres || targetGenres.length === 0) return null
  const norm = normalizeGenreName(sourceName)
  const exact = targetGenres.find((g) => normalizeGenreName(g.name) === norm)
  if (exact) return exact.id
  const alias = GENRE_ALIASES[norm]
  if (alias) {
    const hit = targetGenres.find((g) => normalizeGenreName(g.name) === alias)
    if (hit) return hit.id
  }
  return null
}

function TitleCard({
  item,
  isInLibrary,
  isPending,
  onToggleLibrary,
}: {
  item: DiscoverTitle
  isInLibrary: boolean
  isPending: boolean
  onToggleLibrary: () => void
}) {
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
          position: 'relative',
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
        },
        year: {
          fontFamily: 'Inter',
          fontSize: 11,
          fontWeight: '400',
          color: colors.onSurfaceVariant,
          marginTop: 3,
        },
      }),
    [colors, posterH]
  )

  const handlePress = useCallback(() => {
    hapticLight()
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
        <LibraryBadge
          size={26}
          isInLibrary={isInLibrary}
          isPending={isPending}
          onToggle={onToggleLibrary}
        />
      </View>
      <Text numberOfLines={2} ellipsizeMode="tail" style={styles.title}>
        {item.title}
      </Text>
      {/* Year follows the title's natural height — tight for 1-line names,
          unchanged for wrapped ones. Leftover space lands below the card. */}
      {item.year ? (
        <Text numberOfLines={1} ellipsizeMode="tail" style={styles.year}>
          {item.year}
        </Text>
      ) : null}
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
}: CollectionBrowserProps) {
  const insets = useSafeAreaInsets()
  const { colors } = useTheme()
  const { user } = useAuth()

  const [sortBy, setSortBy] = useState<GenreSortBy>('popularity.desc')
  const [sheetVisible, setSheetVisible] = useState(false)

  // ── Shows/Movies toggle ──
  // Genre pages map ids via TMDb's genre lists; network pages resolve their
  // movie side through watch providers (networks are TV-only in TMDb — same
  // brands, different id space); company ids work on both endpoints as-is.
  const [activeType, setActiveType] = useState<'tv' | 'movie'>(mediaType)

  // Animated toggle — sliding pill between Shows/Movies
  const segProgress = useSharedValue(activeType === 'tv' ? 0 : 1)
  const [segLayouts, setSegLayouts] = useState<Record<string, { x: number; width: number }>>({})

  useEffect(() => {
    segProgress.value = withTiming(activeType === 'tv' ? 0 : 1, {
      duration: 260,
      easing: Easing.out(Easing.cubic),
    })
  }, [activeType, segProgress])

  const segIndicatorStyle = useAnimatedStyle(() => {
    const tv = segLayouts['tv']
    const movie = segLayouts['movie']
    if (!tv || !movie) return { opacity: 0 }
    const x = interpolate(segProgress.value, [0, 1], [tv.x, movie.x])
    const w = interpolate(segProgress.value, [0, 1], [tv.width, movie.width])
    return {
      transform: [{ translateX: x }],
      width: w,
      opacity: 1,
    }
  })

  // Per-type discover ids. Company ids are valid on both /discover endpoints;
  // genre/network pages start with only the origin side and the other resolves
  // lazily from TMDb lists.
  const [idsByType, setIdsByType] = useState<{ tv: number | null; movie: number | null }>(() =>
    kind === 'company'
      ? { tv: id, movie: id }
      : { tv: mediaType === 'tv' ? id : null, movie: mediaType === 'movie' ? id : null }
  )
  const activeId = idsByType[activeType]

  const needsGenreLists = kind === 'genre'
  const tvGenresQuery = useGenres('tv', { enabled: needsGenreLists })
  const movieGenresQuery = useGenres('movie', { enabled: needsGenreLists })
  const needsProviders = kind === 'network'
  const providersQuery = useMovieWatchProviders({ enabled: needsProviders })

  /** Provider list reshaped into the shared {id,name} form used by the resolver */
  const providerOptions = useMemo(
    () => providersQuery.data?.results.map((p) => ({ id: p.provider_id, name: p.provider_name })),
    [providersQuery.data]
  )

  const sortLabel = useMemo(
    () => BROWSE_SORT_OPTIONS[activeType].find((o) => o.value === sortBy)?.label ?? 'Popular',
    [activeType, sortBy]
  )

  // Header logo: RN images need explicit dimensions — measure the real aspect
  // ratio on load and derive width from the fixed height. Until then assume a
  // typical wordmark ratio (~2). On failure fall back to the text title.
  const HEADER_LOGO_HEIGHT = 26
  const [headerLogoRatio, setHeaderLogoRatio] = useState(2)
  const [headerLogoFailed, setHeaderLogoFailed] = useState(false)

  // expo-image can't reliably render SVGs — treat them as unavailable up front
  const headerLogoUrl = useMemo(() => {
    const url = getImageUrl(logoPath ?? null, 'w154')
    return url && !url.endsWith('.svg') ? url : null
  }, [logoPath])
  const showHeaderLogo = !!headerLogoUrl && !headerLogoFailed

  // Dark logos (black wordmarks) vanish on the dark background — detect them
  // once per URL and give those a light tile behind the mark
  const [headerLogoIsDark, setHeaderLogoIsDark] = useState(false)
  useEffect(() => {
    let cancelled = false
    setHeaderLogoIsDark(false)
    if (!headerLogoUrl) return
    getLogoIsDark(headerLogoUrl).then((dark) => {
      if (!cancelled && dark === true) setHeaderLogoIsDark(true)
    })
    return () => {
      cancelled = true
    }
  }, [headerLogoUrl])

  const {
    data,
    isLoading,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useDiscoverTitles(activeType, kind, activeId, sortBy)

  const titles = useMemo(
    () => (data ? data.pages.flatMap((p) => p.items) : []),
    [data]
  )

  // ── Watchlist state (Discover pattern: batch enrich + optimistic session map) ──
  const addMutation = useAddToLibrary()
  const removeMutation = useRemoveFromLibrary()
  const addingIds = useRef(new Set<number>())
  const removingIds = useRef(new Set<number>())
  const [, forceRender] = useState(0)
  const localLibraryRef = useRef<Map<number, 'added' | 'removed'>>(new Map())
  const statusMapRef = useRef<Map<number, 'in' | 'out'>>(new Map())

  // tmdb ids collide across media types — reset local badge state on flip so
  // stale entries from the previous type can't bleed into the new grid
  useEffect(() => {
    statusMapRef.current.clear()
    localLibraryRef.current.clear()
    addingIds.current.clear()
    removingIds.current.clear()
  }, [activeType])

  // Eagerly resolve both sides as soon as the (cached) lists land — makes
  // flipping instant instead of waiting per side.
  useEffect(() => {
    if (!needsGenreLists && !needsProviders) return
    const tvList = tvGenresQuery.data?.genres
    const movieList = movieGenresQuery.data?.genres
    setIdsByType((prev) => {
      let changed = false
      const next = { ...prev }
      if (needsGenreLists) {
        if (next.tv == null && tvList) {
          const r = resolveCounterpartId(name, tvList)
          if (r != null) {
            next.tv = r
            changed = true
          }
        }
        if (next.movie == null && movieList) {
          const r = resolveCounterpartId(name, movieList)
          if (r != null) {
            next.movie = r
            changed = true
          }
        }
      } else if (next.movie == null && providerOptions) {
        // Network page — the movie side maps to a watch-provider id
        const r = resolveCounterpartId(name, providerOptions)
        if (r != null) {
          next.movie = r
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [
    needsGenreLists,
    needsProviders,
    name,
    tvGenresQuery.data,
    movieGenresQuery.data,
    providerOptions,
  ])

  // Can the non-active segment be used? 'unknown' while lists load — keep it
  // enabled and show a brief grid loading state if tapped early.
  const counterpartAvailable: boolean | 'unknown' = useMemo(() => {
    if (kind === 'genre') {
      const list =
        activeType === 'tv' ? movieGenresQuery.data?.genres : tvGenresQuery.data?.genres
      if (!list) return 'unknown'
      return resolveCounterpartId(name, list) != null
    }
    if (kind === 'network') {
      // Movie side exists only if this brand is also a watch provider in-region
      if (!providerOptions) return 'unknown'
      return resolveCounterpartId(name, providerOptions) != null
    }
    return true // company ids work on both endpoints
  }, [kind, activeType, name, tvGenresQuery.data, movieGenresQuery.data, providerOptions])

  const handleSwitchType = useCallback(
    (t: 'tv' | 'movie') => {
      if (t === activeType) return
      hapticLight()
      setActiveType(t)
      // Sort values differ per media type (first_air_date vs primary_release_date)
      // — reset to the shared default so the sheet never shows a mismatched label
      setSortBy('popularity.desc')
    },
    [activeType]
  )

  // Batched watchlist lookup for every loaded page of titles
  useEffect(() => {
    if (!user || titles.length === 0) return
    let cancelled = false
    fetchLibraryStatus(titles, user.id)
      .then((map) => {
        if (cancelled) return
        for (const t of titles) {
          statusMapRef.current.set(t.tmdbId, map.has(t.tmdbId) ? 'in' : 'out')
        }
        forceRender((n) => n + 1)
      })
      .catch(() => {
        // Silent — badges stay '+' and remain functional via local toggles
      })
    return () => {
      cancelled = true
    }
  }, [titles, user])

  const isInLibrary = useCallback((tmdbId: number) => {
    const localStatus = localLibraryRef.current.get(tmdbId)
    if (localStatus === 'added') return true
    if (localStatus === 'removed') return false
    return statusMapRef.current.get(tmdbId) === 'in'
  }, [])

  const handleToggleLibrary = useCallback(
    (item: DiscoverTitle) => {
      const wasIn = isInLibrary(item.tmdbId)
      // Optimistic flip
      localLibraryRef.current.set(item.tmdbId, wasIn ? 'removed' : 'added')
      const pending = wasIn ? removingIds.current : addingIds.current
      pending.add(item.tmdbId)
      forceRender((n) => n + 1)

      const discoverItem = {
        tmdbId: item.tmdbId,
        mediaType: item.mediaType,
        title: item.title,
        poster_path: item.poster_path,
        year: item.year,
        releaseDate: null,
        overview: null,
        inLibrary: wasIn,
      }
      const mutation = wasIn ? removeMutation : addMutation
      mutation.mutate(discoverItem as any, {
        onError: (err: Error) => {
          Alert.alert(wasIn ? 'Failed to remove' : 'Failed to add', err.message)
          localLibraryRef.current.delete(item.tmdbId)
        },
        onSettled: () => {
          pending.delete(item.tmdbId)
          forceRender((n) => n + 1)
        },
      })
    },
    [isInLibrary, addMutation, removeMutation]
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
          height: HEADER_LOGO_HEIGHT,
          marginLeft: 6,
        },
        // Light backdrop for dark logos (black wordmarks) so they read on the
        // dark background — see utils/logoLuminance
        headerLogoTile: {
          backgroundColor: LIGHT_LOGO_TILE,
          borderRadius: borderRadius.md,
          paddingHorizontal: 10,
          paddingVertical: 8,
          marginLeft: 2,
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
        // Shows/Movies segmented control (sticky bar, left zone)
        segTrack: {
          flexDirection: 'row',
          backgroundColor: colors.surfaceContainer,
          borderRadius: borderRadius.full,
          borderWidth: 1,
          borderColor: colors.outlineVariant,
          padding: 2,
          position: 'relative',
        },
        segIndicator: {
          position: 'absolute',
          top: 2,
          bottom: 2,
          borderRadius: borderRadius.full,
          backgroundColor: colors.primary,
          zIndex: 0,
        },
        segBtn: {
          paddingHorizontal: 14,
          paddingVertical: 6,
          borderRadius: borderRadius.full,
          zIndex: 1,
        },
        segBtnActive: {
          // background now handled by animated indicator; kept for fallback before layout
          backgroundColor: 'transparent',
        },
        segBtnDisabled: {
          opacity: 0.35,
        },
        segText: {
          fontFamily: 'Inter',
          fontSize: 12,
          fontWeight: '600',
          color: colors.onSurfaceVariant,
        },
        segTextActive: {
          color: colors.onPrimary,
        },
      }),
    [colors]
  )

  // Type-aware empty copy for the Shows/Movies toggle
  const emptyCopy = `No ${activeType === 'tv' ? 'shows' : 'movies'} found in ${name}`

  const renderItem = useCallback(
    ({ item }: { item: DiscoverTitle }) => (
      // Half-gutter padding on every cell = COL_GAP center gutter (v2 grid)
      <View style={{ flex: 1, paddingHorizontal: COL_GAP / 2 }}>
        <TitleCard
          item={item}
          isInLibrary={isInLibrary(item.tmdbId)}
          isPending={addingIds.current.has(item.tmdbId) || removingIds.current.has(item.tmdbId)}
          onToggleLibrary={() => handleToggleLibrary(item)}
        />
      </View>
    ),
    [isInLibrary, handleToggleLibrary]
  )

  const keyExtractor = useCallback(
    (item: DiscoverTitle) => `${item.mediaType}-${item.tmdbId}`,
    []
  )

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const handleBack = useCallback(() => {
    hapticLight()
    router.back()
  }, [])

  // ── Invalid params ──
  if (!id) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <Ionicons name="alert-circle-outline" size={48} color={colors.onSurfaceVariant} />
        <Text style={styles.emptyText}>{invalidMessage ?? 'Could not load page'}</Text>
        <Pressable onPress={handleBack}>
          <Text style={[styles.emptyText, { color: colors.primary }]}>Go back</Text>
        </Pressable>
      </View>
    )
  }

  // ── Loading ──
  // Also covers the beat after flipping media type on a genre page while the
  // counterpart id resolves (disabled queries report isLoading=false)
  const awaitingCounterpart =
    (needsGenreLists || needsProviders) && activeId == null && counterpartAvailable !== false
  if (isLoading || awaitingCounterpart) {
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
        <ErrorState title={`Failed to load ${name}`} onRetry={refetch} onGoBack={handleBack} />
      </View>
    )
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={handleBack}
          style={styles.backButton}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={24} color={colors.primary} />
        </Pressable>
        {showHeaderLogo ? (
          headerLogoIsDark ? (
            <View style={styles.headerLogoTile}>
              <Image
                source={{ uri: headerLogoUrl ?? undefined }}
                recyclingKey={headerLogoUrl ?? undefined}
                style={[styles.headerLogo, { marginLeft: 0, width: Math.min(Math.max(HEADER_LOGO_HEIGHT * headerLogoRatio, 40), 220) }]}
                contentFit="contain"
                cachePolicy="memory-disk"
                transition={150}
                onLoad={(e) => {
                  const src = e.source
                  if (src?.width && src?.height) setHeaderLogoRatio(src.width / src.height)
                }}
                onError={() => setHeaderLogoFailed(true)}
                accessibilityLabel={name}
              />
            </View>
          ) : (
            <Image
              source={{ uri: headerLogoUrl ?? undefined }}
              recyclingKey={headerLogoUrl ?? undefined}
              style={[styles.headerLogo, { width: Math.min(Math.max(HEADER_LOGO_HEIGHT * headerLogoRatio, 40), 220) }]}
              contentFit="contain"
              cachePolicy="memory-disk"
              transition={150}
              onLoad={(e) => {
                const src = e.source
                if (src?.width && src?.height) setHeaderLogoRatio(src.width / src.height)
              }}
              onError={() => setHeaderLogoFailed(true)}
              accessibilityLabel={name}
            />
          )
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
            <Text style={styles.emptyText}>{emptyCopy}</Text>
          </View>
        }
      />

      {/* Sticky bottom bar — toggle left, count centered, sort right */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingHorizontal: spacing.marginMobile,
          paddingVertical: 12,
          paddingBottom: 12 + insets.bottom,
          backgroundColor: colors.surfaceContainerHigh,
          borderTopWidth: 1,
          borderTopColor: colors.outlineVariant,
          zIndex: 10,
          elevation: 8,
        }}
      >
        {/* Left zone — Shows/Movies segmented control (wrap, not flex) */}
        <View style={{ flexShrink: 0 }}>
          <View style={styles.segTrack}>
            <Animated.View style={[styles.segIndicator, segIndicatorStyle]} />
            {(['tv', 'movie'] as const).map((t) => {
              const selected = activeType === t
              const disabled = !selected && counterpartAvailable === false
              return (
                <Pressable
                  key={t}
                  onPress={() => handleSwitchType(t)}
                  disabled={disabled}
                  onLayout={(e) => {
                    const { x, width } = e.nativeEvent.layout
                    setSegLayouts((prev) => {
                      const cur = prev[t]
                      if (cur && cur.x === x && cur.width === width) return prev
                      return { ...prev, [t]: { x, width } }
                    })
                  }}
                  style={[styles.segBtn, disabled && styles.segBtnDisabled]}
                  accessibilityRole="button"
                  accessibilityState={{ selected, disabled }}
                  accessibilityLabel={t === 'tv' ? `Shows in ${name}` : `Movies in ${name}`}
                >
                  <Text
                    style={[styles.segText, selected && styles.segTextActive]}
                    numberOfLines={1}
                  >
                    {t === 'tv' ? 'Shows' : 'Movies'}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </View>

        {/* Center zone — title count (flex:1 keeps it centered, gap handles spacing) */}
        <Text
          style={{
            flex: 1,
            fontFamily: 'Inter',
            fontSize: 12,
            color: colors.onSurfaceVariant,
            textAlign: 'center',
          }}
          numberOfLines={1}
        >
          {titles.length} titles
        </Text>

        {/* Right zone — sort pill (wrap, not flex) */}
        <View style={{ flexShrink: 0 }}>
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
              hapticLight()
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
        </View>
      </View>

      <BrowseSortSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        value={sortBy}
        onChange={setSortBy}
        options={BROWSE_SORT_OPTIONS[activeType]}
      />
    </View>
  )
}
