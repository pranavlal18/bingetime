// ─── ShowsTabSwitcher — "WATCH LIST" / "UPCOMING" top tabs ───

import { useCallback } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { colors, typography, spacing } from '@/theme'
import type { ShowsTabKind } from '@/types'

interface ShowsTabSwitcherProps {
  activeTab: ShowsTabKind
  onTabChange: (tab: ShowsTabKind) => void
}

const TABS: { key: ShowsTabKind; label: string }[] = [
  { key: 'watchlist', label: 'WATCH LIST' },
  { key: 'upcoming', label: 'UPCOMING' },
]

export default function ShowsTabSwitcher({ activeTab, onTabChange }: ShowsTabSwitcherProps) {
  return (
    <View style={styles.container}>
      <View style={styles.tabsRow}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key
          return (
            <Pressable
              key={tab.key}
              style={styles.tab}
              onPress={() => onTabChange(tab.key)}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                {tab.label}
              </Text>
              {isActive && <View style={styles.activeIndicator} />}
            </Pressable>
          )
        })}
      </View>
      <View style={styles.divider} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingTop: spacing.unit,
  },
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.marginMobile,
    gap: spacing.stackLg,
  },
  tab: {
    position: 'relative',
    paddingVertical: spacing.stackSm + 2,
  },
  tabText: {
    fontSize: typography.labelMd.fontSize,
    fontWeight: '600',
    letterSpacing: typography.labelMd.letterSpacing,
    color: colors.onSurfaceVariant,
  },
  tabTextActive: {
    color: colors.onSurface,
    fontWeight: '700',
  },
  activeIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: colors.primary,
    borderRadius: 1,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.outlineVariant,
    marginTop: spacing.unit,
  },
})
