// ─── EpisodeSection — pill badge header ───

import { View, Text, StyleSheet } from 'react-native'
import { colors, typography, spacing, borderRadius } from '@/theme'

interface EpisodeSectionProps {
  title: string
}

export default function EpisodeSection({ title }: EpisodeSectionProps) {
  return (
    <View style={styles.container}>
      {/* Pill badge header */}
      <View style={styles.headerPill}>
        <Text style={styles.headerText}>{title}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.stackMd,
  },
  headerPill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceContainerHigh,
    paddingHorizontal: spacing.gutter,
    paddingVertical: spacing.stackSm - 2,
    borderRadius: borderRadius.full,
    marginBottom: spacing.stackSm,
    marginHorizontal: spacing.marginMobile,
  },
  headerText: {
    fontSize: typography.labelSm.fontSize,
    fontWeight: '700',
    color: colors.onSurface,
    letterSpacing: 1.2,
  },
})
