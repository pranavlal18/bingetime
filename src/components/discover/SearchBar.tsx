// ─── SearchBar — always-visible pill input for Discover ───

import { memo, forwardRef } from 'react'
import { View, TextInput, Pressable, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/contexts/ThemeContext'
import { typography, spacing, borderRadius } from '@/theme'

interface SearchBarProps {
  value: string
  onChangeText: (text: string) => void
  onClear: () => void
}

const SearchBar = memo(
  forwardRef<TextInput, SearchBarProps>(function SearchBar({ value, onChangeText, onClear }, ref) {
    const { colors } = useTheme()

    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: colors.surfaceContainerLow,
            borderColor: value.length > 0 ? colors.primary + '40' : 'transparent',
          },
        ]}
      >
        <Ionicons name="search" size={18} color={value.length > 0 ? colors.primary : colors.onSurfaceVariant} />
        <TextInput
          ref={ref}
          style={[styles.input, { color: colors.onSurface }]}
          placeholder="Movies, shows and more..."
          placeholderTextColor={colors.outline}
          value={value}
          onChangeText={onChangeText}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {value.length > 0 && (
          <Pressable onPress={onClear} hitSlop={8} style={styles.clearBtn}>
            <Ionicons name="close-circle" size={18} color={colors.onSurfaceVariant} />
          </Pressable>
        )}
      </View>
    )
  })
)

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.marginMobile,
    marginBottom: spacing.stackSm,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.gutter,
    height: 44,
    gap: spacing.stackSm,
    borderWidth: 1,
  },
  input: {
    flex: 1,
    fontSize: typography.bodyMd.fontSize,
    height: '100%',
  },
  clearBtn: {
    padding: 2,
  },
})

export default SearchBar
