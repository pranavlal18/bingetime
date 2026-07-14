// ─── Profile Tab — TV Time style: user + horizontal carousels ───

import { memo, useState, useMemo, useCallback, useEffect } from 'react'
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Switch,
  Dimensions,
  Alert,
  Linking,
} from 'react-native'
import { requestNotificationPermissions, cancelAllReminders, getPermissionStatus } from '@/utils/notifications'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAppStore } from '@/stores/appStore'
import { useAuth } from '@/contexts/AuthContext'
import { getImageUrl } from '@/lib/tmdb'
import { useShows } from '@/lib/queries/shows'
import { useMovies, useFavoriteMovies } from '@/lib/queries/movies'
import {
  useProfileStats,
  useFavorites,
} from '@/lib/queries/profile'
import { useTheme } from '@/contexts/ThemeContext'
import type { ShowWithUserData } from '@/lib/queries/shows'
import type { MovieWithUserData } from '@/lib/queries/movies'
import type { ThemeKey } from '@/types'

const SCREEN_WIDTH = Dimensions.get('window').width
const POSTER_W = 100
const POSTER_H = POSTER_W * 1.5
const SIDE_OFFSET = 20

// ── Helpers ──

function formatNumber(n: number): string {
  return n.toLocaleString('en-US')
}

function getInitials(email: string): string {
  return email
    .split('@')[0]
    .split('.')
    .map((part) => part[0]?.toUpperCase())
    .slice(0, 2)
    .join('')
}

// ── Sub-components (theme-aware via useTheme) ──

// 2-column bento grid: (screen width - 2 × margin - 1 × gap) / 2
const STAT_CARD_WIDTH = (SCREEN_WIDTH - 20 * 2 - 16) / 2

const StatCard = memo(function StatCard({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme()
  return (
    <View
      style={{
        width: STAT_CARD_WIDTH,
        backgroundColor: colors.surfaceContainer,
        borderRadius: 16,
        paddingVertical: 20,
        paddingHorizontal: 12,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
      }}
    >
      <Text
        style={{
          fontFamily: 'Inter',
          fontSize: 24,
          fontWeight: '600',
          color: colors.primary,
        }}
      >
        {value}
      </Text>
      <Text
        style={{
          fontFamily: 'Inter',
          fontSize: 12,
          fontWeight: '500',
          letterSpacing: 0.08,
          textTransform: 'uppercase' as const,
          color: colors.secondary,
          marginTop: 4,
        }}
      >
        {label}
      </Text>
    </View>
  )
})

const SectionHeader = memo(function SectionHeader({
  title,
  icon,
  iconColor,
  count,
  onPress,
}: {
  title: string
  icon?: keyof typeof Ionicons.glyphMap
  iconColor?: string
  count?: number
  onPress?: () => void
}) {
  const { colors } = useTheme()
  return (
    <Pressable
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: SIDE_OFFSET,
        marginBottom: 12,
      }}
      onPress={onPress}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {icon && <Ionicons name={icon} size={18} color={iconColor ?? colors.primary} />}
        <Text
          style={{
            fontFamily: 'Inter',
            fontSize: 20,
            fontWeight: '700',
            color: colors.onSurface,
            letterSpacing: -0.01,
          }}
        >
          {title}
        </Text>
        {count !== undefined && (
          <Text
            style={{
              fontFamily: 'Inter',
              fontSize: 14,
              fontWeight: '500',
              color: colors.outlineVariant,
            }}
          >
            {count}
          </Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.outlineVariant} />
    </Pressable>
  )
})

const PosterItem = memo(function PosterItem({
  posterPath,
  title,
  onPress,
}: {
  posterPath: string | null
  title: string
  onPress: () => void
}) {
  const { colors } = useTheme()
  const posterUrl = getImageUrl(posterPath, 'w185')

  return (
    <Pressable style={{ width: POSTER_W }} onPress={onPress}>
      <View
        style={{
          width: POSTER_W,
          height: POSTER_H,
          borderRadius: 12,
          overflow: 'hidden',
          backgroundColor: colors.surfaceDim,
          borderWidth: 1,
          borderColor: colors.outlineVariant,
        }}
      >
        {posterUrl ? (
          <Image
            source={{ uri: posterUrl }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Ionicons name="film-outline" size={24} color={colors.outlineVariant} />
          </View>
        )}
      </View>
      <Text
        style={{
          fontFamily: 'Inter',
          fontSize: 11,
          fontWeight: '600',
          color: colors.onSurface,
          marginTop: 6,
          lineHeight: 14,
        }}
        numberOfLines={2}
      >
        {title}
      </Text>
    </Pressable>
  )
})

const SettingsRow = memo(function SettingsRow({
  icon,
  label,
  rightLabel,
  showChevron = true,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  rightLabel?: string
  showChevron?: boolean
  onPress?: () => void
}) {
  const { colors } = useTheme()
  const [pressed, setPressed] = useState(false)

  return (
    <Pressable
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 20,
          paddingVertical: 16,
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(255,255,255,0.05)',
        },
        pressed && { backgroundColor: 'rgba(255,255,255,0.05)' },
      ]}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <Ionicons name={icon} size={20} color={colors.secondary} />
        <Text
          style={{
            fontFamily: 'Inter',
            fontSize: 16,
            fontWeight: '400',
            color: colors.onSurface,
          }}
        >
          {label}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {rightLabel ? (
          <Text
            style={{
              fontFamily: 'Inter',
              fontSize: 14,
              fontWeight: '600',
              letterSpacing: 0.01,
              color: colors.onSurfaceVariant,
            }}
          >
            {rightLabel}
          </Text>
        ) : null}
        {showChevron && (
          <Ionicons name="chevron-forward" size={16} color={colors.outlineVariant} />
        )}
      </View>
    </Pressable>
  )
})

const SettingsToggle = memo(function SettingsToggle({
  icon,
  label,
  value,
  onValueChange,
}: {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  value: boolean
  onValueChange: (value: boolean) => void
}) {
  const { colors } = useTheme()
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <Ionicons name={icon} size={20} color={colors.secondary} />
        <Text
          style={{
            fontFamily: 'Inter',
            fontSize: 16,
            fontWeight: '400',
            color: colors.onSurface,
          }}
        >
          {label}
        </Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.surfaceContainerHighest, true: colors.primary }}
        thumbColor="#FFF"
      />
    </View>
  )
})

const ThemeSwatchPreview = memo(function ThemeSwatchPreview({
  swatches,
  size = 'default',
}: {
  swatches: readonly [string, string, string] | string[]
  size?: 'default' | 'small'
}) {
  const circleSize = size === 'small' ? 16 : 24
  const borderW = size === 'small' ? 1 : 2
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      {swatches.slice(0, 3).map((color, i) => (
        <View
          key={i}
          style={{
            width: circleSize,
            height: circleSize,
            borderRadius: circleSize / 2,
            backgroundColor: color,
            borderWidth: borderW,
            borderColor: 'rgba(255,255,255,0.15)',
          }}
        />
      ))}
    </View>
  )
})

// ── Main Screen ──

export default function ProfileScreen() {
  const insets = useSafeAreaInsets()
  const notificationsEnabled = useAppStore((s) => s.notificationsEnabled)
  const setNotificationsEnabled = useAppStore((s) => s.setNotificationsEnabled)
  const setImportComplete = useAppStore((s) => s.setImportComplete)

  const { colors, themeKey, setTheme, availableThemes } = useTheme()
  const [showThemePicker, setShowThemePicker] = useState(false)

  useEffect(() => {
    async function checkPermission() {
      const { status } = await getPermissionStatus()
      setNotificationsEnabled(status === 'granted')
    }
    checkPermission()
  }, [setNotificationsEnabled])

  const { user, signOut, loading: authLoading } = useAuth()

  const { data: stats, isLoading: statsLoading } = useProfileStats()
  const { data: shows, isLoading: showsLoading } = useShows()
  const { data: movies, isLoading: moviesLoading } = useMovies()
  const { data: favoriteShows } = useFavorites()
  const { data: favoriteMovies } = useFavoriteMovies()

  // Theme label
  const currentThemeMeta = availableThemes.find((t) => t.key === themeKey)

  // Derived sections — only active shows (started) and watched movies
  const activeShows = useMemo(() => {
    if (!shows) return []
    return shows.filter((s) => s.episodes_seen > 0)
  }, [shows])

  const watchedMoviesList = useMemo(() => {
    if (!movies) return []
    return movies.filter((m) => m.watched)
  }, [movies])

  const isLoading_ = statsLoading || showsLoading || moviesLoading || authLoading

  const handleSignOut = useCallback(async () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => signOut() },
    ])
  }, [signOut])

  const handleImport = useCallback(() => {
    setImportComplete(false)
    router.push('/import')
  }, [setImportComplete])

  // Dynamic styles that depend on theme
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.background,
        },
        centered: {
          justifyContent: 'center',
          alignItems: 'center',
        },
        scrollContent: {
          paddingBottom: 32,
        },
        // User Header
        userHeader: {
          alignItems: 'center',
          paddingVertical: 32,
          paddingHorizontal: 20,
        },
        avatarRing: {
          width: 96,
          height: 96,
          borderRadius: 100,
          borderWidth: 2,
          borderColor: 'rgba(208,188,255,0.2)',
          padding: 4,
          marginBottom: 16,
        },
        avatarContainer: {
          width: '100%',
          height: '100%',
          borderRadius: 100,
          overflow: 'hidden',
          backgroundColor: colors.surfaceContainerHigh,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.1)',
          justifyContent: 'center',
          alignItems: 'center',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 8,
        },
        avatarInitials: {
          fontFamily: 'Inter',
          fontSize: 28,
          fontWeight: '700',
          color: colors.onSurface,
          opacity: 0.8,
        },
        userName: {
          fontFamily: 'Inter',
          fontSize: 24,
          fontWeight: '600',
          color: colors.onSurface,
          marginBottom: 4,
        },
        userBadge: {
          fontFamily: 'Inter',
          fontSize: 14,
          fontWeight: '600',
          letterSpacing: 0.01,
          color: colors.onSurfaceVariant,
        },
        // Bento Stats Grid
        statsGrid: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          paddingHorizontal: 20,
          gap: 16,
          marginBottom: 32,
        },
        // Carousel Section
        carouselSection: {
          marginBottom: 16,
        },
        carouselContent: {
          paddingLeft: SIDE_OFFSET,
          paddingRight: 8,
          gap: 12,
        },
        // Settings List
        settingsContainer: {
          marginHorizontal: 20,
          marginTop: 8,
          backgroundColor: colors.surfaceContainer,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.05)',
          overflow: 'hidden',
        },
        // Theme Picker
        themePickerContainer: {
          paddingHorizontal: 20,
          paddingBottom: 8,
          gap: 4,
        },
        themeOption: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingVertical: 12,
          paddingHorizontal: 12,
          borderRadius: 12,
        },
        themeOptionActive: {
          backgroundColor: 'rgba(255,255,255,0.06)',
        },
        themeOptionInfo: {
          flex: 1,
        },
        themeOptionName: {
          fontFamily: 'Inter',
          fontSize: 16,
          fontWeight: '500',
          color: colors.onSurface,
        },
        themeOptionNameActive: {
          color: colors.primary,
          fontWeight: '600',
        },
        themeOptionDesc: {
          fontFamily: 'Inter',
          fontSize: 12,
          fontWeight: '400',
          color: colors.onSurfaceVariant,
          marginTop: 2,
        },
      }),
    [colors]
  )

  // ── Loading ──
  if (isLoading_) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── User Header ── */}
        <View style={styles.userHeader}>
          <View style={styles.avatarRing}>
            <View style={styles.avatarContainer}>
              <Text style={styles.avatarInitials}>
                {user ? getInitials(user.email || '') : 'AT'}
              </Text>
            </View>
          </View>
          <Text style={styles.userName}>
            {user?.email?.split('@')[0] || 'Alex Thorne'}
          </Text>
          <Text style={styles.userBadge}>{user?.email || 'Premium Member'}</Text>
        </View>

        {/* ── Bento Stats Grid ── */}
        {stats && (
          <View style={styles.statsGrid}>
            <StatCard label="SHOWS" value={formatNumber(stats.totalShows)} />
            <StatCard label="MOVIES" value={formatNumber(stats.totalMovies)} />
            <StatCard label="EPISODES" value={formatNumber(stats.totalEpisodes)} />
            <StatCard label="WATCHED" value={`${formatNumber(stats.totalHours)}h`} />
          </View>
        )}

        {/* ── Shows Carousel ── */}
        {activeShows.length > 0 && (
          <View style={styles.carouselSection}>
            <SectionHeader
              title="Shows"
              count={activeShows.length}
              onPress={() => router.push('/all-shows')}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.carouselContent}
            >
              {activeShows.slice(0, 10).map((show) => (
                <PosterItem
                  key={show.id}
                  posterPath={show.poster_path}
                  title={show.name}
                  onPress={() => router.push(`/show/${show.id}`)}
                />
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── Favorite Shows ── */}
        {favoriteShows && favoriteShows.length > 0 && (
          <View style={styles.carouselSection}>
            <SectionHeader
              title="Favorite Shows"
              icon="heart"
              iconColor="#ff3b30"
              count={favoriteShows.length}
              onPress={() => router.push('/favorite-shows')}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.carouselContent}
            >
              {favoriteShows.slice(0, 10).map((show) => (
                <PosterItem
                  key={show.id}
                  posterPath={show.poster_path}
                  title={show.name}
                  onPress={() => router.push(`/show/${show.id}`)}
                />
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── Movies Carousel ── */}
        {watchedMoviesList.length > 0 && (
          <View style={styles.carouselSection}>
            <SectionHeader
              title="Movies"
              count={watchedMoviesList.length}
              onPress={() => router.push('/all-movies')}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.carouselContent}
            >
              {watchedMoviesList.slice(0, 10).map((movie) => (
                <PosterItem
                  key={movie.id}
                  posterPath={movie.poster_path}
                  title={movie.title}
                  onPress={() => router.push(`/movie/${movie.id}`)}
                />
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── Favorite Movies ── */}
        {favoriteMovies && favoriteMovies.length > 0 && (
          <View style={styles.carouselSection}>
            <SectionHeader
              title="Favorite Movies"
              icon="heart"
              iconColor="#ff3b30"
              count={favoriteMovies.length}
              onPress={() => router.push('/favorite-movies')}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.carouselContent}
            >
              {favoriteMovies.slice(0, 10).map((movie) => (
                <PosterItem
                  key={movie.id}
                  posterPath={movie.poster_path}
                  title={movie.title}
                  onPress={() => router.push(`/movie/${movie.id}`)}
                />
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── Settings List ── */}
        <View style={styles.settingsContainer}>
          {/* ── Theme picker (expandable) ── */}
          <Pressable
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 20,
              paddingVertical: 16,
              borderBottomWidth: 1,
              borderBottomColor: 'rgba(255,255,255,0.05)',
            }}
            onPress={() => setShowThemePicker(!showThemePicker)}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <Ionicons name="color-palette-outline" size={20} color={colors.secondary} />
              <Text
                style={{
                  fontFamily: 'Inter',
                  fontSize: 16,
                  fontWeight: '400',
                  color: colors.onSurface,
                }}
              >
                Theme
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <ThemeSwatchPreview
                swatches={currentThemeMeta?.swatches ?? ['#d0bcff', '#8b5cf6', '#15121b']}
              />
              <Ionicons
                name={showThemePicker ? 'chevron-up' : 'chevron-forward'}
                size={16}
                color={colors.outlineVariant}
              />
            </View>
          </Pressable>

          {/* ── Theme options (collapsible) ── */}
          {showThemePicker && (
            <View style={styles.themePickerContainer}>
              {availableThemes.map((t) => {
                const isActive = t.key === themeKey
                return (
                  <Pressable
                    key={t.key}
                    style={[styles.themeOption, isActive && styles.themeOptionActive]}
                    onPress={() => {
                      setTheme(t.key as ThemeKey)
                      setShowThemePicker(false)
                    }}
                  >
                    <ThemeSwatchPreview swatches={t.swatches} size="small" />
                    <View style={styles.themeOptionInfo}>
                      <Text style={[styles.themeOptionName, isActive && styles.themeOptionNameActive]}>
                        {t.name}
                      </Text>
                      <Text style={styles.themeOptionDesc}>{t.description}</Text>
                    </View>
                    {isActive && (
                      <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                    )}
                  </Pressable>
                )
              })}
            </View>
          )}

          <SettingsToggle
            icon="notifications-outline"
            label="Notifications"
            value={notificationsEnabled}
            onValueChange={async (value) => {
              if (value) {
                const granted = await requestNotificationPermissions()
                setNotificationsEnabled(granted)
              } else {
                setNotificationsEnabled(false)
                await cancelAllReminders()
              }
            }}
          />
          <SettingsRow
            icon="sync-outline"
            label="Import TV Time Data"
            onPress={handleImport}
          />
          <SettingsRow
            icon="log-out-outline"
            label="Sign Out"
            rightLabel=""
            showChevron={false}
            onPress={handleSignOut}
          />
        </View>

        {/* Bottom spacing for tab bar */}
        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  )
}
