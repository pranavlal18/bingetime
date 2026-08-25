// ─── FilterChips — All / TV / Movies for Discover search ───

import { memo } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useTheme } from '@/contexts/ThemeContext'
import { spacing, borderRadius } from '@/theme'
import type { MediaFilter } from '@/lib/queries/discover'

const FILTERS: { key: MediaFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'tv', label: 'TV' },
  { key: 'movie', label: 'Movies' },
]

interface FilterChipsProps {
  value: MediaFilter
  onChange: (filter: MediaFilter) => void
}

const FilterChips = memo(function FilterChips({ value, onChange }: FilterChipsProps) {
  const { colors } = useTheme()

  return (
    <View style={styles.row} accessibilityRole="tablist">
      {FILTERS.map((f) => {
        const active = value === f.key
        return (
          <Pressable
            key={f.key}
            onPress={() => onChange(f.key)}
            style={[
              styles.chip,
              {
                backgroundColor: active ? colors.primary : colors.surfaceContainer,
                borderColor: active ? colors.primary : colors.outlineVariant,
              },
            ]}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${f.label} filter`}
          >
            <Text
              style={[
                styles.label,
                { color: active ? colors.onPrimary : colors.onSurfaceVariant },
              ]}
            >
              {f.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
})

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingHorizontal: spacing.marginMobile,
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  label: {
    fontFamily: 'Inter',
    fontSize: 14,
    fontWeight: '600',
  },
})

export default FilterChips
