// ─── Onboarding Wizard — 3 steps inside one screen ───

import { useCallback, useMemo, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Dimensions,
} from 'react-native'
import { FlashList } from '@shopify/flash-list'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { Image } from 'expo-image'
import Toast from 'react-native-toast-message'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { useAppStore } from '@/stores/appStore'
import { useTheme } from '@/contexts/ThemeContext'
import { hapticLight, hapticSuccess } from '@/utils/haptics'
import { getImageUrl } from '@/lib/tmdb'
import { useGenres } from '@/lib/queries/discover'
import { useOnboardingSuggestions } from '@/lib/queries/onboarding'
import { addShowToLibrary, addMovieToLibrary } from '@/lib/queries/discover'
import { upcomingKeys } from '@/lib/queries/upcoming'
import type { DiscoverResult } from '@/lib/queries/discover'

const SCREEN_WIDTH = Dimensions.get('window').width
const POSTER_WIDTH = (SCREEN_WIDTH - 40 - 16 * 2) / 3 // 3 cols, outer 20*2 + gap 16*2
const POSTER_HEIGHT = POSTER_WIDTH * 1.5

// ── Helpers ──

function Dots({ total, active }: { total: number; active: number }) {
  const { colors } = useTheme()
  return (
    <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={{
            width: i === active ? 20 : 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: i === active ? colors.primary : colors.surfaceContainerHighest,
          }}
        />
      ))}
    </View>
  )
}

// ── Screen ──

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets()
  const { colors } = useTheme()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const setOnboardingPending = useAppStore((s) => s.setOnboardingPending)

  const [step, setStep] = useState<0 | 1 | 2>(0)
  const [tvGenreIds, setTvGenreIds] = useState<Set<number>>(new Set())
  const [movieGenreIds, setMovieGenreIds] = useState<Set<number>>(new Set())
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState<'all' | 'tv' | 'movie'>('all')
  const [isAdding, setIsAdding] = useState(false)
  const [addProgress, setAddProgress] = useState({ current: 0, total: 0 })

  // Disarm the wizard (armed at signup in register.tsx) — consumed on Skip OR Finish
  const handleSkip = useCallback(() => {
    hapticLight()
    setOnboardingPending(false)
    router.replace('/(tabs)/shows')
  }, [setOnboardingPending])

  const handleNextFromWelcome = useCallback(() => {
    hapticLight()
    setStep(1)
  }, [])

  const handleContinueFromGenres = useCallback(() => {
    hapticLight()
    setStep(2)
  }, [])

  // Genre queries
  const { data: tvGenresData, isLoading: tvGenresLoading } = useGenres('tv', { enabled: step >= 1 })
  const { data: movieGenresData, isLoading: movieGenresLoading } = useGenres('movie', { enabled: step >= 1 })

  const tvGenres = tvGenresData?.genres ?? []
  const movieGenres = movieGenresData?.genres ?? []

  const toggleTvGenre = useCallback((id: number) => {
    hapticLight()
    setTvGenreIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleMovieGenre = useCallback((id: number) => {
    hapticLight()
    setMovieGenreIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const selectedCount = tvGenreIds.size + movieGenreIds.size

  // Suggestions query (only when on step 2)
  const tvIdsArr = useMemo(() => [...tvGenreIds], [tvGenreIds])
  const movieIdsArr = useMemo(() => [...movieGenreIds], [movieGenreIds])
  const { data: suggestions, isLoading: suggestionsLoading, isRefetching: suggestionsRefetching } =
    useOnboardingSuggestions(tvIdsArr, movieIdsArr)

  const filteredSuggestions = useMemo(() => {
    if (!suggestions) return []
    if (filter === 'tv') return suggestions.filter((r) => r.mediaType === 'tv')
    if (filter === 'movie') return suggestions.filter((r) => r.mediaType === 'movie')
    return suggestions
  }, [suggestions, filter])

  const toggleSelection = useCallback((item: DiscoverResult) => {
    const key = `${item.mediaType}-${item.tmdbId}`
    hapticLight()
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const handleAddSelected = useCallback(async () => {
    if (!user || selectedKeys.size === 0 || isAdding) return
    setIsAdding(true)
    setAddProgress({ current: 0, total: selectedKeys.size })

    const itemsMap = new Map<string, DiscoverResult>()
    for (const s of suggestions ?? []) {
      itemsMap.set(`${s.mediaType}-${s.tmdbId}`, s)
    }

    let success = 0
    let idx = 0
    const total = selectedKeys.size

    for (const key of selectedKeys) {
      idx++
      setAddProgress({ current: idx, total })
      const item = itemsMap.get(key)
      if (!item) continue
      try {
        if (item.mediaType === 'tv') {
          await addShowToLibrary(item, user.id)
        } else {
          await addMovieToLibrary(item, user.id)
        }
        success++
      } catch (e) {
        if (__DEV__) console.warn('[onboarding] add failed:', item.title, e)
      }
    }

    // Invalidate caches
    queryClient.invalidateQueries({ queryKey: ['shows'] })
    queryClient.invalidateQueries({ queryKey: ['movies'] })
    queryClient.invalidateQueries({ queryKey: ['profile'] })
    queryClient.invalidateQueries({ queryKey: ['stats'] })
    queryClient.invalidateQueries({ queryKey: upcomingKeys.list(user.id) })
    queryClient.invalidateQueries({ queryKey: ['onboarding'] })

    setIsAdding(false)
    hapticSuccess()

    if (success < total) {
      Toast.show({ type: 'info', text1: `Added ${success} of ${total}`, text2: 'The rest are still in Discover' })
    } else if (success > 0) {
      Toast.show({ type: 'success', text1: `Added ${success} title${success > 1 ? 's' : ''} to your library` })
    }

    setOnboardingPending(false)
    router.replace('/(tabs)/shows')
  }, [user, selectedKeys, isAdding, suggestions, queryClient, setOnboardingPending])

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        topBar: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: 20,
          paddingVertical: 12,
          minHeight: 44,
        },
        skipText: { fontSize: 14, fontWeight: '600', color: colors.outline, letterSpacing: 0.2 },
        backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-start' },
        headline: { fontFamily: 'Inter', fontSize: 28, fontWeight: '800', color: colors.onSurface, lineHeight: 34, letterSpacing: -0.02 },
        headlineSm: { fontFamily: 'Inter', fontSize: 24, fontWeight: '700', color: colors.onSurface, lineHeight: 30, letterSpacing: -0.01 },
        subtitle: { fontSize: 15, color: colors.onSurfaceVariant, lineHeight: 22, marginTop: 8 },
        primaryBtn: {
          backgroundColor: colors.accent,
          borderRadius: 16,
          height: 56,
          justifyContent: 'center',
          alignItems: 'center',
          flexDirection: 'row',
          gap: 8,
        },
        primaryBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
        primaryBtnDisabled: { opacity: 0.45 },
        secondaryTextBtn: { alignSelf: 'center', paddingVertical: 12, paddingHorizontal: 16 },
        secondaryText: { fontSize: 14, fontWeight: '600', color: colors.outline },
        sectionLabel: { fontSize: 12, fontWeight: '700', color: colors.outline, letterSpacing: 1.2, marginBottom: 12, marginTop: 8 },
        chip: {
          paddingHorizontal: 16,
          height: 36,
          borderRadius: 100,
          justifyContent: 'center',
          alignItems: 'center',
          flexDirection: 'row',
          gap: 6,
          borderWidth: 1,
        },
        chipText: { fontSize: 14, fontWeight: '600' },
        filterPill: {
          paddingHorizontal: 14,
          height: 32,
          borderRadius: 100,
          justifyContent: 'center',
          alignItems: 'center',
          borderWidth: 1,
        },
        filterPillText: { fontSize: 13, fontWeight: '600' },
        posterCard: {
          width: POSTER_WIDTH,
          marginBottom: 12,
        },
        posterWrap: {
          width: POSTER_WIDTH,
          height: POSTER_HEIGHT,
          borderRadius: 12,
          overflow: 'hidden',
          backgroundColor: colors.surfaceContainer,
          borderWidth: 1,
          borderColor: colors.outlineVariant,
        },
        posterSelected: {
          borderColor: colors.accent,
          borderWidth: 2.5,
        },
        posterDim: { opacity: 0.55 },
        checkCircle: {
          position: 'absolute',
          top: 6,
          right: 6,
          width: 26,
          height: 26,
          borderRadius: 13,
          backgroundColor: colors.accent,
          justifyContent: 'center',
          alignItems: 'center',
        },
        titleLine: { fontSize: 12, fontWeight: '600', color: colors.onSurface, marginTop: 6, lineHeight: 14 },
        yearLine: { fontSize: 11, color: colors.outline, marginTop: 2 },
        counterBadge: {
          backgroundColor: colors.primary,
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 100,
        },
        counterBadgeText: { fontSize: 12, fontWeight: '700', color: colors.onPrimary },
      }),
    [colors]
  )

  if (!user) {
    // Signed-out — InnerLayout guard will bounce to login; show neutral splash
    return (
      <View style={[styles.container, { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    )
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom + 12 }]}>
      {/* Top bar */}
      <View style={styles.topBar}>
        {step > 0 ? (
          <Pressable onPress={() => setStep((s) => (s - 1) as 0 | 1 | 2)} style={styles.backBtn} hitSlop={8}>
            <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
          </Pressable>
        ) : (
          <View style={styles.backBtn} />
        )}
        <Dots total={3} active={step} />
        <Pressable onPress={handleSkip} hitSlop={12} style={{ paddingHorizontal: 4, paddingVertical: 6 }}>
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
      </View>

      {/* ── Step 0: Welcome ── */}
      {step === 0 && (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24, flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero */}
          <View style={{ alignItems: 'center', marginTop: 8, marginBottom: 24 }}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 18,
                backgroundColor: colors.primaryContainer,
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: 20,
              }}
            >
              <Ionicons name="tv-outline" size={30} color={colors.onPrimaryContainer} />
            </View>
            <Text style={[styles.headline, { textAlign: 'center' }]}>Track what you watch.</Text>
            <Text style={[styles.subtitle, { textAlign: 'center' }]}>Your shows. Your movies.{'\n'}All in one place.</Text>
          </View>

          {/* Feature cards */}
          <View style={{ gap: 12, marginBottom: 24 }}>
            {[
              { icon: 'trending-up-outline' as const, title: 'Track Progress', desc: 'Never lose your place' },
              { icon: 'compass-outline' as const, title: 'Discover', desc: 'Trending & curated picks' },
              { icon: 'notifications-outline' as const, title: 'Never miss an episode', desc: 'Stay up to date' },
            ].map((f) => (
              <View
                key={f.title}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: colors.surfaceContainer,
                  borderRadius: 16,
                  padding: 16,
                  gap: 14,
                  borderWidth: 1,
                  borderColor: colors.outlineVariant,
                }}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    backgroundColor: colors.surfaceContainerHigh,
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <Ionicons name={f.icon} size={20} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: colors.onSurface }}>{f.title}</Text>
                  <Text style={{ fontSize: 13, color: colors.onSurfaceVariant, marginTop: 2 }}>{f.desc}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={{ flex: 1 }} />

          <Pressable
            onPress={handleNextFromWelcome}
            style={styles.primaryBtn}
            accessibilityRole="button"
            accessibilityLabel="Get started"
          >
            <Text style={styles.primaryBtnText}>Get Started</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </Pressable>
          <Text style={{ fontSize: 12, color: colors.outline, textAlign: 'center', marginTop: 12, lineHeight: 16 }}>
            Already have favorites? We&apos;ll help you add them in seconds.
          </Text>
        </ScrollView>
      )}

      {/* ── Step 1: Genres ── */}
      {step === 1 && (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.headlineSm}>What do you love to watch?</Text>
          <Text style={styles.subtitle}>Pick a few genres — we&apos;ll suggest titles you&apos;ll love.</Text>

          {/* TV */}
          <Text style={styles.sectionLabel}>TV SHOWS</Text>
          {tvGenresLoading ? (
            <ActivityIndicator color={colors.primary} style={{ paddingVertical: 12 }} />
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {tvGenres.map((g) => {
                const selected = tvGenreIds.has(g.id)
                return (
                  <Pressable
                    key={`tv-${g.id}`}
                    onPress={() => toggleTvGenre(g.id)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: selected ? colors.primary : colors.surfaceContainer,
                        borderColor: selected ? colors.primary : colors.outlineVariant,
                      },
                    ]}
                  >
                    {selected && <Ionicons name="checkmark" size={14} color={colors.onPrimary} />}
                    <Text style={[styles.chipText, { color: selected ? colors.onPrimary : colors.onSurfaceVariant }]}>
                      {g.name}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          )}

          {/* Movies */}
          <Text style={styles.sectionLabel}>MOVIES</Text>
          {movieGenresLoading ? (
            <ActivityIndicator color={colors.primary} style={{ paddingVertical: 12 }} />
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {movieGenres.map((g) => {
                const selected = movieGenreIds.has(g.id)
                return (
                  <Pressable
                    key={`movie-${g.id}`}
                    onPress={() => toggleMovieGenre(g.id)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: selected ? colors.primary : colors.surfaceContainer,
                        borderColor: selected ? colors.primary : colors.outlineVariant,
                      },
                    ]}
                  >
                    {selected && <Ionicons name="checkmark" size={14} color={colors.onPrimary} />}
                    <Text style={[styles.chipText, { color: selected ? colors.onPrimary : colors.onSurfaceVariant }]}>
                      {g.name}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          )}

          <View style={{ height: 24 }} />

          <Pressable onPress={handleContinueFromGenres} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>
              Continue{selectedCount > 0 ? ` — ${selectedCount} selected` : ''}
            </Text>
          </Pressable>
          <Pressable onPress={handleContinueFromGenres} style={styles.secondaryTextBtn}>
            <Text style={styles.secondaryText}>Continue without picking</Text>
          </Pressable>
        </ScrollView>
      )}

      {/* ── Step 2: Picks ── */}
      {step === 2 && (
        <View style={{ flex: 1 }}>
          <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={styles.headlineSm}>Add your first titles</Text>
              {selectedKeys.size > 0 && (
                <View style={styles.counterBadge}>
                  <Text style={styles.counterBadgeText}>{selectedKeys.size} selected</Text>
                </View>
              )}
            </View>
            <Text style={styles.subtitle}>Tap to select — you can change these anytime.</Text>

            {/* Filter pills */}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
              {(['all', 'tv', 'movie'] as const).map((k) => {
                const active = filter === k
                const label = k === 'all' ? `All` : k === 'tv' ? 'TV' : 'Movies'
                return (
                  <Pressable
                    key={k}
                    onPress={() => {
                      hapticLight()
                      setFilter(k)
                    }}
                    style={[
                      styles.filterPill,
                      {
                        backgroundColor: active ? colors.surfaceContainerHigh : 'transparent',
                        borderColor: active ? colors.primary : colors.outlineVariant,
                      },
                    ]}
                  >
                    <Text style={[styles.filterPillText, { color: active ? colors.primary : colors.onSurfaceVariant }]}>
                      {label}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          </View>

          {/* Grid */}
          {suggestionsLoading ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 40 }}>
              <ActivityIndicator color={colors.primary} />
              <Text style={{ color: colors.outline, marginTop: 12 }}>Finding titles you&apos;ll love…</Text>
            </View>
          ) : !filteredSuggestions.length ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 }}>
              <Text style={{ color: colors.onSurface, fontWeight: '700', textAlign: 'center' }}>No titles found</Text>
              <Text style={{ color: colors.outline, marginTop: 8, textAlign: 'center' }}>
                Try picking different genres or check your connection.
              </Text>
              {(suggestionsRefetching || suggestionsLoading) && <ActivityIndicator color={colors.primary} style={{ marginTop: 12 }} />}
            </View>
          ) : (
            <FlashList
              data={filteredSuggestions}
              numColumns={3}
              keyExtractor={(item) => `${item.mediaType}-${item.tmdbId}`}
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24, paddingTop: 4 }}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const key = `${item.mediaType}-${item.tmdbId}`
                const selected = selectedKeys.has(key)
                const uri = getImageUrl(item.poster_path, 'w342')
                return (
                  <Pressable
                    onPress={() => toggleSelection(item)}
                    style={styles.posterCard}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.title}${selected ? ', selected' : ''}`}
                    accessibilityState={{ selected }}
                  >
                    <View style={[styles.posterWrap, selected && styles.posterSelected]}>
                      {uri ? (
                        <Image
                          source={{ uri }}
                          style={{ width: '100%', height: '100%', opacity: selected ? 0.9 : 1 }}
                          contentFit="cover"
                          cachePolicy="memory-disk"
                          recyclingKey={uri}
                        />
                      ) : (
                        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                          <Ionicons name={item.mediaType === 'tv' ? 'tv-outline' : 'film-outline'} size={24} color={colors.outline} />
                        </View>
                      )}
                      {selected && (
                        <View style={styles.checkCircle}>
                          <Ionicons name="checkmark" size={16} color="#fff" />
                        </View>
                      )}
                    </View>
                    <Text style={styles.titleLine} numberOfLines={2}>
                      {item.title}
                    </Text>
                    <Text style={styles.yearLine}>{item.year ?? ''}</Text>
                  </Pressable>
                )
              }}
            />
          )}

          {/* Footer */}
          <View
            style={{
              paddingHorizontal: 20,
              paddingTop: 12,
              paddingBottom: 4,
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: colors.outlineVariant,
              backgroundColor: colors.background,
            }}
          >
            <Pressable
              onPress={handleAddSelected}
              disabled={selectedKeys.size === 0 || isAdding}
              style={[styles.primaryBtn, (selectedKeys.size === 0 || isAdding) && styles.primaryBtnDisabled]}
            >
              {isAdding ? (
                <>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={styles.primaryBtnText}>
                    Adding {addProgress.current} of {addProgress.total}…
                  </Text>
                </>
              ) : (
                <Text style={styles.primaryBtnText}>
                  {selectedKeys.size === 0 ? 'Pick at least one' : `Add ${selectedKeys.size} to my library`}
                </Text>
              )}
            </Pressable>
            <Text style={{ fontSize: 12, color: colors.outline, textAlign: 'center', marginTop: 8 }}>
              You can always add more from Discover.
            </Text>
          </View>
        </View>
      )}
    </View>
  )
}
