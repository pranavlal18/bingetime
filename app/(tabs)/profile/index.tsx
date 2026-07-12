// ─── Profile Tab — TV Time style: user + horizontal carousels ───

import { memo, useState, useMemo } from 'react'
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
} from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAppStore } from '@/stores/appStore'
import { useAuth } from '@/contexts/AuthContext'
import { getImageUrl } from '@/lib/tmdb'
import { useShows } from '@/lib/queries/shows'
import { useMovies } from '@/lib/queries/movies'
import {
  useProfileStats,
} from '@/lib/queries/profile'
import { colors, typography, spacing, borderRadius } from '@/theme'
import type { ShowWithUserData } from '@/lib/queries/shows'
import type { MovieWithUserData } from '@/lib/queries/movies'

const SCREEN_WIDTH = Dimensions.get('window').width
// 2-column bento grid: (screen width - 2 × margin - 1 × gap) / 2
const STAT_CARD_WIDTH = (SCREEN_WIDTH - spacing.marginMobile * 2 - spacing.gutter) / 2
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

// ── Stat Card (Bento style) ──

interface StatCardProps {
  label: string
  value: string
}

const StatCard = memo(function StatCard({ label, value }: StatCardProps) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
})

// ── Section Header ──

interface SectionHeaderProps {
  title: string
  icon?: keyof typeof Ionicons.glyphMap
  iconColor?: string
  count?: number
  onPress?: () => void
}

const SectionHeader = memo(function SectionHeader({
  title,
  icon,
  iconColor,
  count,
  onPress,
}: SectionHeaderProps) {
  return (
    <Pressable style={styles.sectionHeader} onPress={onPress}>
      <View style={styles.sectionHeaderLeft}>
        {icon && <Ionicons name={icon} size={18} color={iconColor ?? colors.primary} />}
        <Text style={styles.sectionTitle}>{title}</Text>
        {count !== undefined && (
          <Text style={styles.sectionCount}>{count}</Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.outlineVariant} />
    </Pressable>
  )
})

// ── Poster Carousel Item ──

interface PosterItemProps {
  posterPath: string | null
  title: string
  onPress: () => void
}

const PosterItem = memo(function PosterItem({ posterPath, title, onPress }: PosterItemProps) {
  const posterUrl = getImageUrl(posterPath, 'w185')

  return (
    <Pressable style={styles.posterItem} onPress={onPress}>
      <View style={styles.posterContainer}>
        {posterUrl ? (
          <Image
            source={{ uri: posterUrl }}
            style={styles.posterImage}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={styles.posterPlaceholder}>
            <Ionicons name="film-outline" size={24} color={colors.outlineVariant} />
          </View>
        )}
      </View>
      <Text style={styles.posterTitle} numberOfLines={2}>{title}</Text>
    </Pressable>
  )
})

// ── Settings Row ──

interface SettingsRowProps {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  rightLabel?: string
  showChevron?: boolean
  onPress?: () => void
}

const SettingsRow = memo(function SettingsRow({
  icon,
  label,
  rightLabel,
  showChevron = true,
  onPress,
}: SettingsRowProps) {
  const [pressed, setPressed] = useState(false)

  return (
    <Pressable
      style={[styles.settingsRow, pressed && styles.settingsRowPressed]}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
    >
      <View style={styles.settingsRowLeft}>
        <Ionicons name={icon} size={20} color={colors.secondary} />
        <Text style={styles.settingsLabel}>{label}</Text>
      </View>
      <View style={styles.settingsRowRight}>
        {rightLabel && (
          <Text style={styles.settingsRightLabel}>{rightLabel}</Text>
        )}
        {showChevron && (
          <Ionicons name="chevron-forward" size={16} color={colors.outlineVariant} />
        )}
      </View>
    </Pressable>
  )
})

// ── Settings Toggle Row ──

interface SettingsToggleProps {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  value: boolean
  onValueChange: (value: boolean) => void
}

const SettingsToggle = memo(function SettingsToggle({
  icon,
  label,
  value,
  onValueChange,
}: SettingsToggleProps) {
  return (
    <View style={styles.settingsRow}>
      <View style={styles.settingsRowLeft}>
        <Ionicons name={icon} size={20} color={colors.secondary} />
        <Text style={styles.settingsLabel}>{label}</Text>
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

// ── Main Screen ──

export default function ProfileScreen() {
  const insets = useSafeAreaInsets()
  const theme = useAppStore((s) => s.theme)
  const setTheme = useAppStore((s) => s.setTheme)
  const showArchived = useAppStore((s) => s.showArchived)
  const toggleShowArchived = useAppStore((s) => s.toggleShowArchived)
  const setImportComplete = useAppStore((s) => s.setImportComplete)

  const { user, signOut, loading: authLoading } = useAuth()

  const { data: stats, isLoading: statsLoading } = useProfileStats()
  const { data: shows, isLoading: showsLoading } = useShows(showArchived)
  const { data: movies, isLoading: moviesLoading } = useMovies()

  // Theme label
  const themeLabel =
    theme === 'dark' ? 'Deep Dark' : theme === 'light' ? 'Light' : 'System'

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

  // ── Loading ──
  if (isLoading_) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  const handleSignOut = async () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => signOut() },
    ])
  }

  const handleImport = () => {
    setImportComplete(false)
    router.push('/import')
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
              <Text style={styles.avatarInitials}>{user ? getInitials(user.email || '') : 'AT'}</Text>
            </View>
          </View>
          <Text style={styles.userName}>{user?.email?.split('@')[0] || 'Alex Thorne'}</Text>
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

        {/* ── Shows Carousel (started/active shows) ── */}
        {activeShows.length > 0 && (
          <View style={styles.carouselSection}>
            <SectionHeader
              title="Shows"
              count={activeShows.length}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.carouselContent}
            >
              {activeShows.map((show) => (
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

        {/* ── Movies Carousel (watched movies) ── */}
        {watchedMoviesList.length > 0 && (
          <View style={styles.carouselSection}>
            <SectionHeader
              title="Movies"
              count={watchedMoviesList.length}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.carouselContent}
            >
              {watchedMoviesList.map((movie) => (
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
          <SettingsRow
            icon="color-palette-outline"
            label="Theme"
            rightLabel={themeLabel}
            onPress={() => {
              const themes: Array<'system' | 'light' | 'dark'> = ['system', 'dark', 'light']
              const idx = themes.indexOf(theme)
              setTheme(themes[(idx + 1) % themes.length])
            }}
          />
          <SettingsRow
            icon="notifications-outline"
            label="Notifications"
          />
          <SettingsRow
            icon="sync-outline"
            label="Import TV Time Data"
            onPress={handleImport}
          />
          <SettingsToggle
            icon="archive-outline"
            label="Archived Shows"
            value={showArchived}
            onValueChange={toggleShowArchived}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingBottom: spacing.stackLg,
  },

  // User Header
  userHeader: {
    alignItems: 'center',
    paddingVertical: spacing.stackLg,
    paddingHorizontal: spacing.marginMobile,
  },
  avatarRing: {
    width: 96,
    height: 96,
    borderRadius: borderRadius.full,
    borderWidth: 2,
    borderColor: 'rgba(208,188,255,0.2)',
    padding: 4,
    marginBottom: 16,
  },
  avatarContainer: {
    width: '100%',
    height: '100%',
    borderRadius: borderRadius.full,
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
    fontSize: typography.headlineMd.fontSize,
    fontWeight: '600',
    lineHeight: typography.headlineMd.lineHeight,
    color: colors.onSurface,
    marginBottom: 4,
  },
  userBadge: {
    fontFamily: 'Inter',
    fontSize: typography.labelMd.fontSize,
    fontWeight: '600',
    lineHeight: typography.labelMd.lineHeight,
    letterSpacing: typography.labelMd.letterSpacing,
    color: colors.onSurfaceVariant,
  },

  // Bento Stats Grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.marginMobile,
    gap: spacing.gutter,
    marginBottom: spacing.stackLg,
  },
  statCard: {
    width: STAT_CARD_WIDTH,
    backgroundColor: colors.surfaceContainer,
    borderRadius: borderRadius.lg,
    paddingVertical: 20,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  statValue: {
    fontFamily: 'Inter',
    fontSize: typography.headlineMd.fontSize,
    fontWeight: '600',
    lineHeight: typography.headlineMd.lineHeight,
    color: colors.primary,
  },
  statLabel: {
    fontFamily: 'Inter',
    fontSize: typography.labelSm.fontSize,
    fontWeight: '500',
    lineHeight: typography.labelSm.lineHeight,
    letterSpacing: 0.08,
    textTransform: 'uppercase',
    color: colors.secondary,
    marginTop: 4,
  },

  // Carousel Section
  carouselSection: {
    marginBottom: spacing.stackMd,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SIDE_OFFSET,
    marginBottom: 12,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontFamily: 'Inter',
    fontSize: 20,
    fontWeight: '700',
    color: colors.onSurface,
    letterSpacing: -0.01,
  },
  sectionCount: {
    fontFamily: 'Inter',
    fontSize: 14,
    fontWeight: '500',
    color: colors.outlineVariant,
  },
  carouselContent: {
    paddingLeft: SIDE_OFFSET,
    paddingRight: 8,
    gap: 12,
  },
  posterItem: {
    width: POSTER_W,
  },
  posterContainer: {
    width: POSTER_W,
    height: POSTER_H,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.surfaceDim,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  posterImage: {
    width: '100%',
    height: '100%',
  },
  posterPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  posterTitle: {
    fontFamily: 'Inter',
    fontSize: 11,
    fontWeight: '600',
    color: colors.onSurface,
    marginTop: 6,
    lineHeight: 14,
  },

  // Settings List
  settingsContainer: {
    marginHorizontal: spacing.marginMobile,
    marginTop: spacing.stackSm,
    backgroundColor: colors.surfaceContainer,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden',
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.marginMobile,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  settingsRowPressed: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  settingsRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  settingsLabel: {
    fontFamily: 'Inter',
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '400',
    lineHeight: typography.bodyMd.lineHeight,
    color: colors.onSurface,
  },
  settingsRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  settingsRightLabel: {
    fontFamily: 'Inter',
    fontSize: typography.labelMd.fontSize,
    fontWeight: '600',
    lineHeight: typography.labelMd.lineHeight,
    letterSpacing: typography.labelMd.letterSpacing,
    color: colors.onSurfaceVariant,
  },
})