// ─── Import Screen — first-launch onboarding for importing TV Time data ───

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { View, Text, ScrollView, Pressable, Animated, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { runImport, IMPORT_STEPS } from '@/lib/import/pipeline'
import type { ImportStep } from '@/lib/import/types'
import { useAppStore } from '@/stores/appStore'
import { typography, spacing, borderRadius } from '@/theme'
import type { ThemeColors } from '@/themes'
import { useTheme } from '@/contexts/ThemeContext'

type Phase = 'welcome' | 'importing' | 'complete' | 'error'

export default function ImportScreen() {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const setImportComplete = useAppStore((s) => s.setImportComplete)

  const [phase, setPhase] = useState<Phase>('welcome')
  const [steps, setSteps] = useState<ImportStep[]>(IMPORT_STEPS.map((s) => ({ ...s })))
  const [warnings, setWarnings] = useState<string[]>([])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [currentStepIndex, setCurrentStepIndex] = useState(0)

  const progressAnim = useRef(new Animated.Value(0)).current
  const scrollRef = useRef<ScrollView>(null)

  const updateProgress = useCallback(
    (stepIndex: number, current: number, total: number, _message?: string) => {
      setSteps((prev) => {
        const updated = [...prev]
        if (updated[stepIndex]) {
          updated[stepIndex] = {
            ...updated[stepIndex],
            current,
            total: total || updated[stepIndex].total,
          }
        }
        return updated
      })
    },
    []
  )

  const updateStepStatus = useCallback(
    (stepIndex: number, status: ImportStep['status'], error?: string) => {
      setSteps((prev) => {
        const updated = [...prev]
        if (updated[stepIndex]) {
          updated[stepIndex] = { ...updated[stepIndex], status, error }
        }
        return updated
      })

      if (status === 'processing') {
        setCurrentStepIndex(stepIndex)
      }

      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true })
      }, 100)
    },
    []
  )

  const handleStartImport = useCallback(async () => {
    setPhase('importing')
    setWarnings([])
    setErrorMessage(null)

    const result = await runImport(updateProgress, updateStepStatus)

    if (result.success) {
      setPhase('complete')
      setWarnings(result.warnings)
      setImportComplete(true)
    } else {
      setPhase('error')
      setWarnings(result.warnings)
      setErrorMessage(result.error || 'Import failed with an unknown error')
    }
  }, [updateProgress, updateStepStatus, setImportComplete])

  const handleContinue = useCallback(() => {
    setImportComplete(true)
    router.replace('/(tabs)/shows')
  }, [setImportComplete])

  const overallProgress = steps.length > 0
    ? steps.filter((s) => s.status === 'done' || s.status === 'skipped').length / steps.length
    : 0

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: overallProgress,
      duration: 300,
      useNativeDriver: false,
    }).start()
  }, [overallProgress, progressAnim])

  const styles = useMemo(() => createStyles(colors), [colors])

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>BingeTime</Text>
        {phase === 'importing' && (
          <Text style={styles.headerSubtitle}>Importing your data...</Text>
        )}
      </View>

      {phase === 'welcome' && <WelcomeContent onStart={handleStartImport} />}
      {phase === 'importing' && (
        <ImportingContent
          steps={steps}
          currentStepIndex={currentStepIndex}
          overallProgress={overallProgress}
          progressAnim={progressAnim}
          scrollRef={scrollRef}
        />
      )}
      {phase === 'complete' && <CompleteContent warnings={warnings} onContinue={handleContinue} />}
      {phase === 'error' && (
        <ErrorContent
          error={errorMessage}
          warnings={warnings}
          onRetry={handleStartImport}
          onSkip={handleContinue}
        />
      )}
    </View>
  )
}

// ── Sub-components ──

function WelcomeContent({ onStart }: { onStart: () => void }) {
  const { colors } = useTheme()
  const styles = useMemo(() => createStyles(colors), [colors])
  const insets = useSafeAreaInsets()

  return (
    <View style={[styles.content, { paddingBottom: insets.bottom + 16 }]}>
      <View style={styles.welcomeIcon}>
        <Ionicons name="cloud-upload-outline" size={64} color={colors.primary} />
      </View>
      <Text style={styles.welcomeTitle}>Welcome to BingeTime</Text>
      <Text style={styles.welcomeText}>
        Let's import your TV Time data. We'll read your export files, match shows and
        movies to TMDb, and set everything up. This one-time process may take a few
        minutes depending on your library size.
      </Text>

      <View style={styles.statsBox}>
        <Text style={styles.statsTitle}>What we'll import:</Text>
        <StatRow icon="tv-outline" label="TV Shows" value="334 tracked" />
        <StatRow icon="film-outline" label="Movies" value="~1,000+ watched" />
        <StatRow icon="play-circle-outline" label="Episode Watches" value="6,430 logged" />
        <StatRow icon="list-outline" label="Custom Lists" value="10 lists" />
      </View>

      <Pressable style={styles.startButton} onPress={onStart}>
        <Text style={styles.startButtonText}>Start Import</Text>
        <Ionicons name="arrow-forward" size={20} color="#FFF" />
      </Pressable>

      <Text style={styles.disclaimer}>
        Your data stays private. All matching is done via the free TMDb API.
      </Text>
    </View>
  )
}

function ImportingContent({
  steps,
  currentStepIndex,
  overallProgress,
  progressAnim,
  scrollRef,
}: {
  steps: ImportStep[]
  currentStepIndex: number
  overallProgress: number
  progressAnim: Animated.Value
  scrollRef: React.RefObject<ScrollView | null>
}) {
  const { colors } = useTheme()
  const styles = useMemo(() => createStyles(colors), [colors])
  const insets = useSafeAreaInsets()

  return (
    <View style={[styles.content, { paddingBottom: insets.bottom + 16 }]}>
      <View style={styles.progressBarContainer}>
        <Animated.View
          style={[
            styles.progressBarFill,
            {
              width: progressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>
      <Text style={styles.progressPercent}>{Math.round(overallProgress * 100)}%</Text>

      <ScrollView ref={scrollRef} style={styles.stepList}>
        {steps.map((step, index) => {
          const isActive = index === currentStepIndex && step.status === 'processing'
          const isDone = step.status === 'done'
          const isError = step.status === 'error'
          const isSkipped = step.status === 'skipped'

          let icon: keyof typeof Ionicons.glyphMap = 'ellipse-outline'
          let iconColor: string = colors.onSurfaceVariant

          if (isDone) { icon = 'checkmark-circle'; iconColor = colors.success }
          if (isError) { icon = 'alert-circle'; iconColor = colors.error }
          if (isActive) { icon = 'sync-circle'; iconColor = colors.primary }
          if (isSkipped) { icon = 'remove-circle-outline'; iconColor = colors.onSurfaceVariant }

          return (
            <View key={step.id} style={[styles.stepItem, isActive && styles.stepItemActive]}>
              <Ionicons name={icon} size={22} color={iconColor} />
              <View style={styles.stepInfo}>
                <Text style={[styles.stepLabel, isActive && styles.stepLabelActive]}>
                  {step.label}
                </Text>
                {(isActive || isDone) && step.total > 0 && (
                  <Text style={styles.stepProgress}>
                    {step.current} / {step.total}
                  </Text>
                )}
                {isError && step.error && (
                  <Text style={styles.stepError}>{step.error}</Text>
                )}
              </View>
            </View>
          )
        })}
      </ScrollView>
    </View>
  )
}

function CompleteContent({ warnings, onContinue }: { warnings: string[]; onContinue: () => void }) {
  const { colors } = useTheme()
  const styles = useMemo(() => createStyles(colors), [colors])
  const insets = useSafeAreaInsets()

  return (
    <View style={[styles.content, styles.centerContent, { paddingBottom: insets.bottom + 16 }]}>
      <Ionicons name="checkmark-circle" size={80} color={colors.success} />
      <Text style={styles.completeTitle}>Import Complete!</Text>
      <Text style={styles.completeText}>
        Your TV Time data has been imported successfully. You can now start tracking
        your shows and movies.
      </Text>

      {warnings.length > 0 && (
        <View style={styles.warningsBox}>
          <Text style={styles.warningsTitle}>
            {warnings.length} warning{warnings.length !== 1 ? 's' : ''}:
          </Text>
          <ScrollView style={styles.warningsList}>
            {warnings.slice(0, 20).map((w, i) => (
              <Text key={i} style={styles.warningText}>{w}</Text>
            ))}
            {warnings.length > 20 && (
              <Text style={styles.warningText}>
                ...and {warnings.length - 20} more
              </Text>
            )}
          </ScrollView>
        </View>
      )}

      <Pressable style={styles.continueButton} onPress={onContinue}>
        <Text style={styles.continueButtonText}>Get Started</Text>
        <Ionicons name="arrow-forward" size={20} color="#FFF" />
      </Pressable>
    </View>
  )
}

function ErrorContent({
  error,
  warnings,
  onRetry,
  onSkip,
}: {
  error: string | null
  warnings: string[]
  onRetry: () => void
  onSkip: () => void
}) {
  const { colors } = useTheme()
  const styles = useMemo(() => createStyles(colors), [colors])
  const insets = useSafeAreaInsets()

  return (
    <View style={[styles.content, styles.centerContent, { paddingBottom: insets.bottom + 16 }]}>
      <Ionicons name="alert-circle" size={80} color={colors.error} />
      <Text style={styles.errorTitle}>Import Failed</Text>
      {error && <Text style={styles.errorText}>{error}</Text>}

      {warnings.length > 0 && (
        <View style={styles.warningsBox}>
          <Text style={styles.warningsTitle}>Warnings:</Text>
          <ScrollView style={styles.warningsList}>
            {warnings.slice(0, 20).map((w, i) => (
              <Text key={i} style={styles.warningText}>{w}</Text>
            ))}
          </ScrollView>
        </View>
      )}

      <View style={styles.errorActions}>
        <Pressable style={styles.retryButton} onPress={onRetry}>
          <Ionicons name="refresh" size={20} color="#FFF" />
          <Text style={styles.retryButtonText}>Retry</Text>
        </Pressable>
        <Pressable style={styles.skipButton} onPress={onSkip}>
          <Text style={styles.skipButtonText}>Skip Import</Text>
        </Pressable>
      </View>
    </View>
  )
}

function StatRow({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  const { colors } = useTheme()
  const styles = useMemo(() => createStyles(colors), [colors])

  return (
    <View style={styles.statRow}>
      <Ionicons name={icon} size={18} color={colors.onSurfaceVariant} />
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  )
}

// ── Styles ──

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  logo: {
    fontSize: typography.headlineLg.fontSize,
    fontWeight: '800',
    color: colors.onSurface,
    letterSpacing: 1,
  },
  headerSubtitle: {
    fontSize: typography.bodySm.fontSize,
    color: colors.onSurfaceVariant,
    marginTop: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.marginMobile,
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Welcome
  welcomeIcon: {
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 16,
  },
  welcomeTitle: {
    fontSize: typography.headlineMd.fontSize,
    fontWeight: '700',
    color: colors.onSurface,
    textAlign: 'center',
    marginBottom: 12,
  },
  welcomeText: {
    fontSize: typography.bodyMd.fontSize,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: typography.bodyMd.lineHeight,
    marginBottom: 24,
  },
  statsBox: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: borderRadius.lg,
    padding: 16,
    marginBottom: 24,
    width: '100%',
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  statsTitle: {
    fontSize: typography.labelMd.fontSize,
    fontWeight: '600',
    color: colors.onSurface,
    marginBottom: 12,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  statLabel: {
    fontSize: typography.bodySm.fontSize,
    color: colors.onSurfaceVariant,
    marginLeft: 10,
    flex: 1,
  },
  statValue: {
    fontSize: typography.bodySm.fontSize,
    color: colors.onSurface,
    fontWeight: '600',
  },
  startButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: borderRadius.lg,
    gap: 8,
    width: '100%',
  },
  startButtonText: {
    fontSize: typography.bodyLg.fontSize,
    fontWeight: '700',
    color: colors.onPrimary,
  },
  disclaimer: {
    fontSize: typography.bodyXs.fontSize,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    marginTop: 16,
  },

  // Importing
  progressBarContainer: {
    height: 6,
    backgroundColor: colors.surfaceContainerHighest,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
  },
  progressPercent: {
    fontSize: typography.bodyXs.fontSize,
    color: colors.onSurfaceVariant,
    textAlign: 'right',
    marginBottom: 16,
  },
  stepList: {
    flex: 1,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: borderRadius.md,
    marginBottom: 4,
  },
  stepItemActive: {
    backgroundColor: colors.surfaceContainer,
  },
  stepInfo: {
    marginLeft: 12,
    flex: 1,
  },
  stepLabel: {
    fontSize: typography.bodySm.fontSize,
    color: colors.onSurfaceVariant,
  },
  stepLabelActive: {
    color: colors.onSurface,
    fontWeight: '600',
  },
  stepProgress: {
    fontSize: typography.bodyXs.fontSize,
    color: colors.onSurfaceVariant,
    marginTop: spacing.unit,
  },
  stepError: {
    fontSize: typography.bodyXs.fontSize,
    color: colors.error,
    marginTop: spacing.unit,
  },

  // Complete
  completeTitle: {
    fontSize: typography.headlineMd.fontSize,
    fontWeight: '700',
    color: colors.onSurface,
    marginTop: 16,
    marginBottom: 8,
  },
  completeText: {
    fontSize: typography.bodyMd.fontSize,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: typography.bodyMd.lineHeight,
    marginBottom: 24,
  },
  warningsBox: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: borderRadius.lg,
    padding: 16,
    marginBottom: 24,
    width: '100%',
    maxHeight: 200,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  warningsTitle: {
    fontSize: typography.labelMd.fontSize,
    fontWeight: '600',
    color: colors.tertiary,
    marginBottom: 8,
  },
  warningsList: {
    maxHeight: 140,
  },
  warningText: {
    fontSize: typography.bodyXs.fontSize,
    color: colors.onSurfaceVariant,
    lineHeight: 18,
  },
  continueButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: borderRadius.lg,
    gap: 8,
    width: '100%',
  },
  continueButtonText: {
    fontSize: typography.bodyLg.fontSize,
    fontWeight: '700',
    color: colors.onPrimary,
  },

  // Error
  errorTitle: {
    fontSize: typography.headlineMd.fontSize,
    fontWeight: '700',
    color: colors.onSurface,
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: typography.bodyMd.fontSize,
    color: colors.error,
    textAlign: 'center',
    lineHeight: typography.bodyMd.lineHeight,
    marginBottom: 24,
  },
  errorActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  retryButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: borderRadius.lg,
    gap: 6,
    flex: 1,
  },
  retryButtonText: {
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '700',
    color: colors.onPrimary,
  },
  skipButton: {
    backgroundColor: colors.surfaceContainerHighest,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: borderRadius.lg,
    flex: 1,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  skipButtonText: {
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
  },
  })
}
