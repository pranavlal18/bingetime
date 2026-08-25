// ─── ErrorState — centered error with optional retry / go-back actions ───

import { memo } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/contexts/ThemeContext'
import { spacing, borderRadius, typography } from '@/theme'

interface ErrorStateProps {
  title: string
  subtitle?: string
  /** Primary action — typically the query's refetch() */
  onRetry?: () => void
  /** Secondary link — typically router.back() */
  onGoBack?: () => void
}

const ErrorState = memo(function ErrorState({
  title,
  subtitle,
  onRetry,
  onGoBack,
}: ErrorStateProps) {
  const { colors } = useTheme()

  return (
    <View style={styles.container}>
      <Ionicons name="cloud-offline-outline" size={48} color={colors.onSurfaceVariant} />
      <Text style={[styles.title, { color: colors.onSurface }]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.subtitle, { color: colors.onSurfaceVariant }]}>{subtitle}</Text>
      ) : null}
      {onRetry ? (
        <Pressable
          onPress={onRetry}
          style={({ pressed }) => [
            styles.retryButton,
            { backgroundColor: colors.primary },
            pressed && { opacity: 0.85 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Try again"
        >
          <Ionicons name="refresh" size={16} color={colors.onPrimary} />
          <Text style={[styles.retryText, { color: colors.onPrimary }]}>Try again</Text>
        </Pressable>
      ) : null}
      {onGoBack ? (
        <Pressable onPress={onGoBack} hitSlop={8} accessibilityRole="button" accessibilityLabel="Go back">
          <Text style={[styles.goBackText, { color: colors.primary }]}>Go back</Text>
        </Pressable>
      ) : null}
    </View>
  )
})

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: spacing.marginMobile,
  },
  title: {
    fontFamily: 'Inter',
    fontSize: typography.bodyLg.fontSize,
    fontWeight: '600',
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: 'Inter',
    fontSize: typography.bodySm.fontSize,
    textAlign: 'center',
    marginTop: -8,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: borderRadius.full,
    marginTop: 4,
  },
  retryText: {
    fontFamily: 'Inter',
    fontSize: typography.bodySm.fontSize,
    fontWeight: '600',
  },
  goBackText: {
    fontFamily: 'Inter',
    fontSize: typography.bodySm.fontSize,
    fontWeight: '600',
  },
})

export default ErrorState
