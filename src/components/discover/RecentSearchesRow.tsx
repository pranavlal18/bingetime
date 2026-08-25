// ─── RecentSearchesRow — horizontal chips above trending when not searching ───

import { memo } from 'react'
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/contexts/ThemeContext'
import { spacing, borderRadius, typography } from '@/theme'

interface RecentSearchesRowProps {
  recents: string[]
  onSelect: (query: string) => void
  onRemove: (query: string) => void
  onClearAll: () => void
}

const RecentSearchesRow = memo(function RecentSearchesRow({
  recents,
  onSelect,
  onRemove,
  onClearAll,
}: RecentSearchesRowProps) {
  const { colors } = useTheme()

  if (recents.length === 0) return null

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.onSurface }]}>Recent searches</Text>
        <Pressable
          onPress={onClearAll}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Clear all recent searches"
        >
          <Text style={[styles.clearAll, { color: colors.primary }]}>Clear all</Text>
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsContent}
      >
        {recents.map((q) => (
          <View
            key={q}
            style={[
              styles.chip,
              { backgroundColor: colors.surfaceContainerHigh, borderColor: colors.outlineVariant },
            ]}
          >
            <Pressable
              onPress={() => onSelect(q)}
              style={styles.labelPress}
              accessibilityRole="button"
              accessibilityLabel={`Search for ${q}`}
            >
              <Text style={[styles.chipLabel, { color: colors.onSurface }]} numberOfLines={1}>
                {q}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => onRemove(q)}
              hitSlop={8}
              style={styles.removeBtn}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${q} from recent searches`}
            >
              <Ionicons name="close" size={12} color={colors.onSurfaceVariant} />
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </View>
  )
})

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.marginMobile,
    marginBottom: 10,
  },
  title: {
    fontFamily: 'Inter',
    fontSize: 13,
    fontWeight: '700',
  },
  clearAll: {
    fontFamily: 'Inter',
    fontSize: 13,
    fontWeight: '600',
  },
  chipsContent: {
    paddingHorizontal: spacing.marginMobile,
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: borderRadius.full,
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 7,
    gap: 8,
    maxWidth: 160,
  },
  labelPress: {
    flexShrink: 1,
  },
  chipLabel: {
    fontSize: typography.bodySm.fontSize,
    fontWeight: '500',
  },
  removeBtn: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
})

export default RecentSearchesRow
