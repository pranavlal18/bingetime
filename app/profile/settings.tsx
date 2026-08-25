// ─── Settings — central place for appearance, notifications, haptics, account ───
// Reached from the gear icon at the top-right of the Profile header. Owns the
// controls that used to live in Profile's bottom card plus new preferences.
// Future customization groups slot into this structure.

import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Switch,
  TextInput,
  ScrollView,
  Alert,
} from 'react-native'
import { useRouter, Stack } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import Constants from 'expo-constants'
import { useTheme } from '@/contexts/ThemeContext'
import { useAuth } from '@/contexts/AuthContext'
import { useAppStore } from '@/stores/appStore'
import type { ThemeKey, ViewMode } from '@/types'
import {
  requestNotificationPermissions,
  cancelAllReminders,
  getPermissionStatus,
} from '@/utils/notifications'
import { hapticLight } from '@/utils/haptics'

// ── Moved from profile/index.tsx (verbatim behavior) ──

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
  infoText,
}: {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  value: boolean
  onValueChange: (value: boolean) => void
  infoText?: string
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
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
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
        {infoText && (
          <Pressable
            hitSlop={8}
            onPress={() => Alert.alert(label, infoText)}
          >
            <Ionicons name="information-circle-outline" size={18} color={colors.onSurfaceVariant} />
          </Pressable>
        )}
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

/** Grid/List mini toggle bound straight to a persisted view-mode field */
function ViewModeSegmented({
  value,
  onChange,
}: {
  value: ViewMode
  onChange: (v: ViewMode) => void
}) {
  const { colors } = useTheme()
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: colors.surfaceContainerHighest,
        borderRadius: 999,
        padding: 2,
      }}
    >
      {(
        [
          ['poster-grid', 'grid-outline'],
          ['thumbnail-list', 'list-outline'],
        ] as const
      ).map(([mode, icon]) => {
        const active = value === mode
        return (
          <Pressable
            key={mode}
            hitSlop={4}
            onPress={() => {
              hapticLight()
              onChange(mode)
            }}
            style={{
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: active ? colors.primary : 'transparent',
            }}
            accessibilityRole="button"
            accessibilityLabel={`${mode === 'poster-grid' ? 'Grid' : 'List'} view`}
          >
            <Ionicons
              name={icon}
              size={14}
              color={active ? colors.onPrimary : colors.onSurfaceVariant}
            />
          </Pressable>
        )
      })}
    </View>
  )
}

// ── Page ──

export default function SettingsPage() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { colors } = useTheme()
  const { themeKey, setTheme, availableThemes } = useTheme()
  const { user, signOut } = useAuth()

  // Store bindings — view modes share fields with the pages' grid/list icons
  const notificationsEnabled = useAppStore((s) => s.notificationsEnabled)
  const setNotificationsEnabled = useAppStore((s) => s.setNotificationsEnabled)
  const hapticsEnabled = useAppStore((s) => s.hapticsEnabled)
  const setHapticsEnabled = useAppStore((s) => s.setHapticsEnabled)
  const displayName = useAppStore((s) => s.displayName)
  const setDisplayName = useAppStore((s) => s.setDisplayName)
  const showsViewMode = useAppStore((s) => s.showsViewMode)
  const setShowsViewMode = useAppStore((s) => s.setShowsViewMode)
  const moviesViewMode = useAppStore((s) => s.moviesViewMode)
  const setMoviesViewMode = useAppStore((s) => s.setMoviesViewMode)

  const [showThemePicker, setShowThemePicker] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState('')

  // Keep OS permission state honest (moved from profile)
  useEffect(() => {
    async function checkPermission() {
      const { status } = await getPermissionStatus()
      setNotificationsEnabled(status === 'granted')
    }
    checkPermission()
  }, [setNotificationsEnabled])

  const currentThemeMeta = availableThemes.find((t) => t.key === themeKey)
  const effectiveName = displayName || user?.email?.split('@')[0] || 'there'

  const handleSignOut = useCallback(async () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => signOut() },
    ])
  }, [signOut])

  const startEditName = useCallback(() => {
    setNameDraft(displayName ?? '')
    setEditingName(true)
  }, [displayName])

  const saveName = useCallback(() => {
    const trimmed = nameDraft.trim()
    setDisplayName(trimmed.length > 0 ? trimmed : null)
    setEditingName(false)
    hapticLight()
  }, [nameDraft, setDisplayName])

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.background,
        },
        header: {
          paddingTop: insets.top + 12,
          paddingBottom: 12,
          paddingHorizontal: 20,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        },
        headerTitle: {
          fontFamily: 'Inter',
          fontSize: 18,
          fontWeight: '600',
          flex: 1,
          color: colors.onSurface,
        },
        card: {
          marginHorizontal: 20,
          marginTop: 8,
          backgroundColor: colors.surfaceContainer,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.05)',
          overflow: 'hidden',
        },
        sectionLabel: {
          fontFamily: 'Inter',
          fontSize: 12,
          fontWeight: '600',
          letterSpacing: 0.5,
          textTransform: 'uppercase',
          color: colors.outline,
          marginHorizontal: 32,
          marginTop: 20,
          marginBottom: 6,
        },
        rowBase: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 20,
          paddingVertical: 16,
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(255,255,255,0.05)',
        },
        rowLabel: {
          fontFamily: 'Inter',
          fontSize: 16,
          fontWeight: '400',
          color: colors.onSurface,
        },
        rowRightLabel: {
          fontFamily: 'Inter',
          fontSize: 14,
          fontWeight: '600',
          letterSpacing: 0.01,
          color: colors.onSurfaceVariant,
        },
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
        nameInputWrap: {
          paddingHorizontal: 20,
          paddingVertical: 14,
          gap: 10,
        },
        nameInput: {
          fontFamily: 'Inter',
          fontSize: 15,
          color: colors.onSurface,
          backgroundColor: colors.surfaceContainerHighest,
          borderRadius: 12,
          paddingHorizontal: 14,
          paddingVertical: 10,
        },
        nameActions: {
          flexDirection: 'row',
          justifyContent: 'flex-end',
          gap: 18,
        },
        nameActionText: {
          fontFamily: 'Inter',
          fontSize: 14,
          fontWeight: '600',
          color: colors.primary,
        },
        nameActionCancel: {
          color: colors.onSurfaceVariant,
        },
        footer: {
          alignItems: 'center',
          paddingVertical: 24,
          paddingBottom: 32,
        },
        footerText: {
          fontFamily: 'Inter',
          fontSize: 13,
          fontWeight: '600',
          color: colors.onSurfaceVariant,
          letterSpacing: 0.3,
          opacity: 0.5,
        },
        footerVersion: {
          fontFamily: 'Inter',
          fontSize: 11,
          fontWeight: '500',
          color: colors.onSurfaceVariant,
          marginTop: 2,
          opacity: 0.4,
        },
      }),
    [colors, insets.top]
  )

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => {
            hapticLight()
            router.back()
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* ── Appearance ── */}
        <Text style={styles.sectionLabel}>Appearance</Text>
        <View style={styles.card}>
          {/* Theme picker (expandable) */}
          <Pressable
            style={[styles.rowBase, { borderBottomWidth: showThemePicker ? 1 : 0 }]}
            onPress={() => setShowThemePicker(!showThemePicker)}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <Ionicons name="color-palette-outline" size={20} color={colors.secondary} />
              <Text style={styles.rowLabel}>Theme</Text>
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

          {/* Theme options (collapsible) */}
          {showThemePicker && (
            <View style={styles.themePickerContainer}>
              {availableThemes.map((t) => {
                const isActive = t.key === themeKey
                return (
                  <Pressable
                    key={t.key}
                    style={[styles.themeOption, isActive && styles.themeOptionActive]}
                    onPress={() => {
                      hapticLight()
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

          {/* Default view modes — same store fields as the pages' grid/list icons */}
          <View style={styles.rowBase}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <Ionicons name="tv-outline" size={20} color={colors.secondary} />
              <Text style={styles.rowLabel}>Shows view</Text>
            </View>
            <ViewModeSegmented value={showsViewMode} onChange={setShowsViewMode} />
          </View>
          <View style={styles.rowBase}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <Ionicons name="film-outline" size={20} color={colors.secondary} />
              <Text style={styles.rowLabel}>Movies view</Text>
            </View>
            <ViewModeSegmented value={moviesViewMode} onChange={setMoviesViewMode} />
          </View>
        </View>

        {/* ── Notifications ── */}
        <Text style={styles.sectionLabel}>Notifications</Text>
        <View style={styles.card}>
          <SettingsToggle
            icon="notifications-outline"
            label="New episode alerts"
            value={notificationsEnabled}
            infoText="Get notified when new episodes of your watchlisted shows are airing. Notifications are scheduled for each upcoming episode."
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
        </View>

        {/* ── Haptics ── */}
        <Text style={styles.sectionLabel}>Feedback</Text>
        <View style={styles.card}>
          <SettingsToggle
            icon="pulse-outline"
            label="Haptic feedback"
            value={hapticsEnabled}
            infoText="Vibration feedback when you tap cards, chips and controls throughout the app."
            onValueChange={(value) => {
              setHapticsEnabled(value)
              if (value) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            }}
          />
        </View>

        {/* ── Account ── */}
        <Text style={styles.sectionLabel}>Account</Text>
        <View style={styles.card}>
          {/* Name (inline editor) */}
          {editingName ? (
            <View style={styles.nameInputWrap}>
              <TextInput
                value={nameDraft}
                onChangeText={setNameDraft}
                placeholder="Your name"
                placeholderTextColor={colors.outlineVariant}
                autoFocus
                maxLength={40}
                style={styles.nameInput}
                onSubmitEditing={saveName}
                returnKeyType="done"
              />
              <View style={styles.nameActions}>
                <Pressable
                  hitSlop={8}
                  onPress={() => setEditingName(false)}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel"
                >
                  <Text style={[styles.nameActionText, styles.nameActionCancel]}>Cancel</Text>
                </Pressable>
                <Pressable
                  hitSlop={8}
                  onPress={saveName}
                  accessibilityRole="button"
                  accessibilityLabel="Save name"
                >
                  <Text style={styles.nameActionText}>Save</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <SettingsRow
              icon="person-outline"
              label="Name"
              rightLabel={effectiveName}
              onPress={startEditName}
            />
          )}
          <SettingsRow
            icon="log-out-outline"
            label="Sign Out"
            rightLabel=""
            showChevron={false}
            onPress={handleSignOut}
          />
        </View>

        {/* App footer — moved from profile */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>BingeTime</Text>
          <Text style={styles.footerVersion}>v{Constants.expoConfig?.version ?? '1.0.0'}</Text>
        </View>
      </ScrollView>
    </View>
  )
}
