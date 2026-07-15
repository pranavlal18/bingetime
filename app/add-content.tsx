// ─── Add Content Screen — manual TMDb search & add ───

import { useState, useCallback, useMemo, useEffect } from 'react'
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Image,
  StyleSheet,
  Keyboard,
  Dimensions,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '@/contexts/ThemeContext'
import { searchMulti, searchMovieAgnostic, searchTv, getMovieDetails, getShowDetails, getImageUrl } from '@/lib/tmdb'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useMutation, useQueryClient } from '@tanstack/react-query'

const SCREEN_WIDTH = Dimensions.get('window').width

type Tab = 'shows' | 'movies'
type MediaType = 'tv' | 'movie'

interface SearchResult {
  id: number
  media_type: MediaType
  title?: string
  name?: string
  poster_path: string | null
  release_date?: string
  first_air_date?: string
  genre_ids: number[]
}

export default function AddContentScreen() {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const [tab, setTab] = useState<Tab>('shows')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState<string | null>(null)

  const debouncedQuery = useMemo(() => query.trim(), [query])

  // Debounced search
  useEffect(() => {
    if (!debouncedQuery) {
      setResults([])
      setError(null)
      return
    }
    const timer = setTimeout(() => {
      performSearch(debouncedQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [debouncedQuery])

  const performSearch = useCallback(async (searchQuery: string) => {
    setLoading(true)
    setError(null)
    try {
      const response = await searchMulti(searchQuery)
      const filtered = (response.results || []).filter(
        (r) => r.media_type === 'tv' || r.media_type === 'movie'
      ).map((r) => ({
        ...r,
        media_type: r.media_type as MediaType,
        genre_ids: r.genre_ids || [],
      })) as SearchResult[]
      setResults(filtered)
    } catch (err) {
      console.error('Search error:', err)
      setError('Search failed. Please try again.')
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  // Mutation to add show
  const addShowMutation = useMutation({
    mutationFn: async (tmdbId: number) => {
      if (!user) throw new Error('Not authenticated')
      const details = await getShowDetails(tmdbId)
      const avgRuntime = details.episode_run_time?.length
        ? Math.round((details.episode_run_time.reduce((a, b) => a + b, 0) / details.episode_run_time.length) * 60)
        : null

      const { data: show, error: showError } = await supabase
        .from('shows')
        .upsert(
          {
            tmdb_id: details.id,
            name: details.name,
            poster_path: details.poster_path,
            status: details.status,
            total_episodes: details.number_of_episodes,
            last_air_date: details.last_air_date,
            average_runtime: avgRuntime,
            genres: details.genres?.map((g) => g.name) || [],
          },
          { onConflict: 'tmdb_id' }
        )
        .select('id')
        .single()
      if (showError) throw showError

      const { error: usError } = await supabase.from('user_shows').upsert(
        {
          show_id: show.id,
          user_id: user.id,
          is_following: true,
          is_watchlist: true,
        },
        { onConflict: 'show_id,user_id' }
      )
      if (usError) throw usError
      return show.id
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shows'] })
      queryClient.invalidateQueries({ queryKey: ['profile'] })
    },
  })

  // Mutation to add movie
  const addMovieMutation = useMutation({
    mutationFn: async (tmdbId: number) => {
      if (!user) throw new Error('Not authenticated')
      const details = await getMovieDetails(tmdbId)
      const { data: movie, error: movieError } = await supabase
        .from('movies')
        .upsert(
          {
            tmdb_id: details.id,
            title: details.title,
            poster_path: details.poster_path,
            release_date: details.release_date,
            runtime: details.runtime ? details.runtime * 60 : null,
            genres: details.genres?.map((g) => g.name) || [],
          },
          { onConflict: 'tmdb_id' }
        )
        .select('id')
        .single()
      if (movieError) throw movieError

      const { error: umError } = await supabase.from('user_movies').upsert(
        {
          movie_id: movie.id,
          user_id: user.id,
          is_watchlist: true,
        },
        { onConflict: 'movie_id,user_id' }
      )
      if (umError) throw umError
      return movie.id
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['movies'] })
      queryClient.invalidateQueries({ queryKey: ['profile'] })
    },
  })

  const handleAddShow = (tmdbId: number) => {
    setAdding(`show-${tmdbId}`)
    addShowMutation.mutate(tmdbId, {
      onSettled: () => setAdding(null),
    })
  }

  const handleAddMovie = (tmdbId: number) => {
    setAdding(`movie-${tmdbId}`)
    addMovieMutation.mutate(tmdbId, {
      onSettled: () => setAdding(null),
    })
  }

  // Genre mapping (TMDb standard IDs)
  const genreMap = useMemo((): Record<number, string> => ({
    28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime',
    99: 'Documentary', 18: 'Drama', 10751: 'Family', 14: 'Fantasy', 36: 'History',
    27: 'Horror', 10402: 'Music', 9648: 'Mystery', 10749: 'Romance', 878: 'Sci-Fi',
    10770: 'TV Movie', 53: 'Thriller', 10752: 'War', 37: 'Western',
  }), [])

  const formatGenres = (ids: number[]) =>
    ids.slice(0, 3).map((id) => genreMap[id] || id).join(', ')

  const styles = useMemo(() => createStyles(colors), [colors])

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={16} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Add Content</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Search Bar */}
      <View style={styles.searchBarContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search for a show or movie..."
          value={query}
          onChangeText={setQuery}
          placeholderTextColor={colors.onSurfaceVariant}
          autoFocus
          autoCapitalize="none"
          returnKeyType="search"
          onSubmitEditing={() => Keyboard.dismiss()}
        />
        {loading && <ActivityIndicator size="small" color={colors.primary} style={styles.searchSpinner} />}
      </View>

      {/* Tab Switcher */}
      <View style={styles.tabContainer}>
        <Pressable
          style={[{ flex: 1, paddingVertical: 12, alignItems: 'center' }, tab === 'shows' && styles.tabActive]}
          onPress={() => setTab('shows')}
        >
          <Text style={[{ fontFamily: 'Inter', fontSize: 14, fontWeight: '600' }, tab === 'shows' ? styles.tabActiveText : styles.tabInactiveText]}>
            TV Shows
          </Text>
        </Pressable>
        <Pressable
          style={[{ flex: 1, paddingVertical: 12, alignItems: 'center' }, tab === 'movies' && styles.tabActive]}
          onPress={() => setTab('movies')}
        >
          <Text style={[{ fontFamily: 'Inter', fontSize: 14, fontWeight: '600' }, tab === 'movies' ? styles.tabActiveText : styles.tabInactiveText]}>
            Movies
          </Text>
        </Pressable>
      </View>

      {/* Results */}
      <ScrollView
        contentContainerStyle={styles.resultsContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {loading && !results.length && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Searching...</Text>
          </View>
        )}

        {!loading && !results.length && query && (
          <View style={styles.emptyContainer}>
            <Ionicons name={tab === 'shows' ? 'tv-outline' : 'film-outline'} size={48} color={colors.onSurfaceVariant} />
            <Text style={styles.emptyText}>No {tab} found for &ldquo;{query}&rdquo;</Text>
            <Text style={styles.emptySubtext}>Try a different search term</Text>
          </View>
        )}

        {results
          .filter((r) => r.media_type === (tab === 'shows' ? 'tv' : 'movie'))
          .map((item) => (
            <Pressable
              key={`${item.media_type}-${item.id}`}
              style={styles.resultCard}
              onPress={() => {
                if (tab === 'shows') handleAddShow(item.id)
                else handleAddMovie(item.id)
              }}
              disabled={adding === `${tab}-${item.id}`}
            >
              <Image
                source={item.poster_path ? { uri: getImageUrl(item.poster_path, 'w154')! } : undefined}
                style={styles.poster}
              />
              <View style={styles.resultInfo}>
                <Text style={styles.resultTitle} numberOfLines={2}>
                  {item.title || item.name}
                </Text>
                <View style={styles.resultMeta}>
                  <Text style={styles.resultYear}>
                    {item.release_date ? item.release_date.substring(0, 4) : item.first_air_date ? item.first_air_date.substring(0, 4) : '—'}
                  </Text>
                  {item.genre_ids.length > 0 && (
                    <Text style={styles.resultGenres}>
                      {item.genre_ids.slice(0, 3).map((id) => genreMap[id] || id).join(', ')}
                    </Text>
                  )}
                </View>
              </View>
              {adding === `${tab}-${item.id}` ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Ionicons
                  name="add-circle-outline"
                  size={28}
                  color={colors.primary}
                />
              )}
            </Pressable>
          ))}

        {!query && (
          <View style={styles.emptyHintContainer}>
            <Ionicons name="search-outline" size={48} color={colors.onSurfaceVariant} style={styles.emptyIcon} />
            <Text style={styles.emptyHintTitle}>Search to discover</Text>
            <Text style={styles.emptyHintText}>
              Type a show or movie name to find and add it to your library
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  )
}

// ── Styles ──

function createStyles(colors: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.outlineVariant,
    },
    backButton: { padding: 8 },
    headerTitle: {
      flex: 1,
      fontFamily: 'Inter',
      fontSize: 18,
      fontWeight: '700',
      color: colors.onSurface,
      textAlign: 'center',
    },
    searchBarContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 12,
    },
    searchInput: {
      flex: 1,
      backgroundColor: colors.surfaceContainer,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontFamily: 'Inter',
      fontSize: 16,
      color: colors.onSurface,
    },
    searchSpinner: { marginLeft: -28, marginRight: 8 },
    tabContainer: {
      flexDirection: 'row',
      backgroundColor: colors.surfaceContainer,
      marginHorizontal: 20,
      borderRadius: 12,
      marginBottom: 16,
    },
    tabActive: {
      backgroundColor: colors.primary,
      borderRadius: 10,
    },
    tabActiveText: { color: colors.onPrimary },
    tabInactiveText: { color: colors.onSurfaceVariant },
    resultsContainer: { paddingHorizontal: 20, paddingBottom: 32, gap: 12 },
    resultCard: {
      flexDirection: 'row',
      backgroundColor: colors.surfaceContainer,
      borderRadius: 12,
      padding: 10,
      alignItems: 'center',
      gap: 12,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.05)',
    },
    poster: { width: 60, height: 90, borderRadius: 6, backgroundColor: colors.surfaceContainerHighest },
    resultInfo: { flex: 1, justifyContent: 'center' },
    resultTitle: { fontFamily: 'Inter', fontSize: 14, fontWeight: '600', color: colors.onSurface, marginBottom: 4 },
    resultMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    resultYear: { fontFamily: 'Inter', fontSize: 12, color: colors.onSurfaceVariant },
    resultGenres: { fontFamily: 'Inter', fontSize: 11, color: colors.tertiary, maxWidth: 180 },
    loadingContainer: { paddingVertical: 40, alignItems: 'center', gap: 12 },
    loadingText: { fontFamily: 'Inter', fontSize: 14, color: colors.onSurfaceVariant },
    emptyContainer: { paddingVertical: 40, alignItems: 'center', gap: 12 },
    emptyText: { fontFamily: 'Inter', fontSize: 16, fontWeight: '500', color: colors.onSurface, textAlign: 'center' },
    emptySubtext: { fontFamily: 'Inter', fontSize: 13, color: colors.onSurfaceVariant, textAlign: 'center' },
    errorContainer: { backgroundColor: colors.errorContainer, borderRadius: 10, padding: 12, marginBottom: 16 },
    errorText: { fontFamily: 'Inter', fontSize: 13, color: colors.error, textAlign: 'center' },
    emptyHintContainer: { paddingVertical: 60, alignItems: 'center', gap: 16 },
    emptyIcon: { opacity: 0.5 },
    emptyHintTitle: { fontFamily: 'Inter', fontSize: 18, fontWeight: '600', color: colors.onSurface, textAlign: 'center' },
    emptyHintText: { fontFamily: 'Inter', fontSize: 14, color: colors.onSurfaceVariant, textAlign: 'center', lineHeight: 20, paddingHorizontal: 40 },
  })
}