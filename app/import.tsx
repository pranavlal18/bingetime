// ─── Import Screen — entry point for data onboarding ───

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Animated,
  StyleSheet,
  Dimensions,
} from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '@/contexts/ThemeContext'
import { runImport, IMPORT_STEPS } from '@/lib/import/pipeline'
import type { ImportStep } from '@/lib/import/types'
import { typography, spacing, borderRadius } from '@/theme'
import type { ThemeColors } from '@/themes'
import { useAuth } from '@/contexts/AuthContext'
import { useAppStore } from '@/stores/appStore'

const SCREEN_WIDTH = Dimensions.get('window').width
const CARD_WIDTH = (SCREEN_WIDTH - 40 - 12) / 2

type Phase = 'landing' | 'importing' | 'complete' | 'error'

export default function ImportScreen() {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const { user } = useAuth()
  const setImportComplete = useAppStore((s) => s.setImportComplete)
  const importStarted = useAppStore((s) => s.importStarted)

  const [phase, setPhase] = useState<Phase>('landing')
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

    const result = await runImport(user?.id ?? '', updateProgress, updateStepStatus)

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

  const handleManualEntry = useCallback(() => {
    router.push('/add-content')
  }, [])

  const handleContinue = useCallback(() => {
    setImportComplete(true)
    router.replace('/(tabs)/shows')
  }, [setImportComplete])

  const handleRetry = useCallback(() => {
    handleStartImport()
  }, [handleStartImport])

  const handleSkip = useCallback(() => {
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
        {phase === 'importing' && <Text style={styles.headerSubtitle}>Importing your data...</Text>}
        {phase === 'landing' && <Text style={styles.headerSubtitle}>Choose how to get started</Text>}
      </View>

      {phase === 'landing' && <LandingContent onStartImport={handleStartImport} onManualEntry={handleManualEntry} />}
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
          onRetry={handleRetry}
          onSkip={handleSkip}
        />
      )}
    </View>
  )
}

// ── Sub-components ──

function LandingContent({
  onStartImport,
  onManualEntry,
}: { onStartImport: () => void; onManualEntry: () => void }) {
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
        How would you like to add your watch history?
      </Text>

      {/* Two option cards */}
      <View style={styles.optionCards}>
        <Pressable style={styles.optionCard} onPress={onStartImport}>
          <Ionicons name="cloud-download-outline" size={32} color={colors.primary} />
          <Text style={styles.optionTitle}>Import from TV Time</Text>
          <Text style={styles.optionDesc}>
            Upload your GDPR export CSVs. We'll match shows & movies to TMDb
            and calculate all your stats automatically.
          </Text>
          <Text style={styles.optionBadge}>Recommended for existing TV Time users</Text>
        </Pressable>

        <Pressable style={styles.optionCard} onPress={onManualEntry}>
          <Ionicons name="add-circle-outline" size={32} color={colors.tertiary} />
          <Text style={styles.optionTitle}>Add Manually</Text>
          <Text style={styles.optionDesc}>
            Search TMDb and add shows/movies one by one. Perfect for
            starting fresh or adding missing titles.
          </Text>
          <Text style={[styles.optionBadge, { color: colors.tertiary }]}>Great for new users</Text>
        </Pressable>
      </View>

      <Text style={styles.disclaimer}>
        Your data stays private. All matching uses the free TMDb API.
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

          if (isDone) {
            icon = 'checkmark-circle'
            iconColor = colors.success
          }
          if (isError) {
            icon = 'alert-circle'
            iconColor = colors.error
          }
          if (isActive) {
            icon = 'sync-circle'
            iconColor = colors.primary
          }
          if (isSkipped) {
            icon = 'remove-circle-outline'
            iconColor = colors.onSurfaceVariant
          }

          return (
            <View key={step.id} style={[styles.stepItem, isActive && styles.stepItemActive]}>
              <Ionicons name={icon} size={22} color={iconColor} />
              <View style={styles.stepInfo}>
                <Text style={[styles.stepLabel, isActive && styles.stepLabelActive]}>{step.label}</Text>
                {(isActive || isDone) && step.total > 0 && (
                  <Text style={styles.stepProgress}>{step.current} / {step.total}</Text>
                )}
                {isError && step.error && <Text style={styles.stepError}>{step.error}</Text>}
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
              <Text key={i} style={styles.warningText}>
                {w}
              </Text>
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

    // Landing
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
    optionCards: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 24,
    },
    optionCard: {
      width: CARD_WIDTH,
      backgroundColor: colors.surfaceContainer,
      borderRadius: borderRadius.lg,
      padding: 20,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.outlineVariant,
    },
    optionTitle: {
      fontSize: typography.bodyMd.fontSize,
      fontWeight: '600',
      color: colors.onSurface,
      textAlign: 'center',
      marginTop: 12,
      marginBottom: 8,
    },
    optionDesc: {
      fontSize: typography.bodySm.fontSize,
      color: colors.onSurfaceVariant,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: 12,
    },
    optionBadge: {
      fontSize: typography.bodyXs.fontSize,
      fontWeight: '600',
      color: colors.primary,
      backgroundColor: colors.primaryContainer,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: borderRadius.full,
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