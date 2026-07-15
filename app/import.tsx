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
  Alert,
} from 'react-native'
import { router } from 'expo-router'
import * as DocumentPicker from 'expo-document-picker'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '@/contexts/ThemeContext'
import { runImport, IMPORT_STEPS } from '@/lib/import/pipeline'
import {
  parsePickedFile,
  assembleAllCsvData,
  type CsvFileType,
  type AllCsvData,
} from '@/lib/import/csvParser'
import type { ImportStep } from '@/lib/import/types'
import { typography, spacing, borderRadius } from '@/theme'
import type { ThemeColors } from '@/themes'
import { useAuth } from '@/contexts/AuthContext'
import { useAppStore } from '@/stores/appStore'

const SCREEN_WIDTH = Dimensions.get('window').width
const CARD_WIDTH = (SCREEN_WIDTH - 40 - 12) / 2

type Phase = 'landing' | 'picking' | 'importing' | 'complete' | 'error'
type ImportMode = 'shows' | 'movies' | 'everything' | null

interface PickedFile {
  uri: string
  name: string
  type: CsvFileType
  rowCount: number
}

const FILE_LABELS: Record<CsvFileType, string> = {
  followed_tv_show: 'Followed Shows',
  user_tv_show_data: 'Show Data',
  tracking_prod_records_v2: 'Episode Watches',
  tracking_prod_records: 'Movie Records',
  unknown: 'Unknown File',
}

const FILE_ICONS: Record<CsvFileType, keyof typeof Ionicons.glyphMap> = {
  followed_tv_show: 'tv-outline',
  user_tv_show_data: 'analytics-outline',
  tracking_prod_records_v2: 'play-circle-outline',
  tracking_prod_records: 'film-outline',
  unknown: 'document-outline',
}

export default function ImportScreen() {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const { user } = useAuth()
  const setImportComplete = useAppStore((s) => s.setImportComplete)

  const [phase, setPhase] = useState<Phase>('landing')
  const [mode, setMode] = useState<ImportMode>(null)
  const [steps, setSteps] = useState<ImportStep[]>(IMPORT_STEPS.map((s) => ({ ...s })))
  const [warnings, setWarnings] = useState<string[]>([])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [pickedFiles, setPickedFiles] = useState<PickedFile[]>([])
  const [isParsing, setIsParsing] = useState(false)

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

  const handlePickFiles = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'application/vnd.ms-excel'],
        multiple: true,
        copyToCacheDirectory: false, // Changed from true to false
      })

      if (result.canceled) return

      setIsParsing(true)
      const parsed: PickedFile[] = []

      for (const asset of result.assets) {
        const { type, data, headers } = await parsePickedFile(
          asset.uri,
          asset.name
        )
        parsed.push({
          uri: asset.uri,
          name: asset.name,
          type,
          rowCount: data.length,
        })

        // If detection failed, try matching by filename
        if (type === 'unknown') {
          const name = asset.name.toLowerCase()
          if (name.includes('followed_tv_show')) {
            parsed[parsed.length - 1].type = 'followed_tv_show'
          } else if (name.includes('user_tv_show_data')) {
            parsed[parsed.length - 1].type = 'user_tv_show_data'
          } else if (name.includes('tracking-prod-records-v2')) {
            parsed[parsed.length - 1].type = 'tracking_prod_records_v2'
          } else if (name.includes('tracking-prod-records') && !name.includes('v2')) {
            parsed[parsed.length - 1].type = 'tracking_prod_records'
          }
        }
      }

      setPickedFiles((prev) => {
        // Merge: replace existing files of same type (keep latest), add new types
        const merged = new Map<CsvFileType, PickedFile>()
        for (const f of prev) merged.set(f.type, f)
        for (const f of parsed) merged.set(f.type, f)
        return [...merged.values()]
      })
      setIsParsing(false)
    } catch (error) {
      setIsParsing(false)
      console.error('File parsing error:', error)
      Alert.alert('Error', `Failed to read selected files: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }, [])

  const handleRemoveFile = useCallback((type: CsvFileType) => {
    setPickedFiles((prev) => prev.filter((f) => f.type !== type))
  }, [])

  const handleStartImport = useCallback(async () => {
    if (!user?.id) return

    // Assemble parsed data from picked files
    const csvData: AllCsvData = assembleAllCsvData(
      pickedFiles.map((f) => ({ type: f.type, data: [] }))
    )

    // Re-parse all picked files into the assembled data
    for (const file of pickedFiles) {
      const { data } = await parsePickedFile(file.uri, file.name)
      const assembled = assembleAllCsvData([{ type: file.type, data }])
      // Merge into csvData
      if (assembled.followedShows.length > 0) csvData.followedShows = assembled.followedShows
      if (assembled.userShowData.length > 0) csvData.userShowData = assembled.userShowData
      if (assembled.trackingV2.length > 0) csvData.trackingV2 = assembled.trackingV2
      if (assembled.movieRecords.length > 0) csvData.movieRecords = assembled.movieRecords
    }

    setPhase('importing')
    setWarnings([])
    setErrorMessage(null)

    const result = await runImport(user.id, updateProgress, updateStepStatus, csvData)

    if (result.success) {
      setPhase('complete')
      setWarnings(result.warnings)
      setImportComplete(true)
    } else {
      setPhase('error')
      setWarnings(result.warnings)
      setErrorMessage(result.error || 'Import failed with an unknown error')
    }
  }, [user, pickedFiles, updateProgress, updateStepStatus, setImportComplete])

  const handleBundledImport = useCallback(async () => {
    if (!user?.id) return
    setPhase('importing')
    setWarnings([])
    setErrorMessage(null)

    const result = await runImport(user.id, updateProgress, updateStepStatus)

    if (result.success) {
      setPhase('complete')
      setWarnings(result.warnings)
      setImportComplete(true)
    } else {
      setPhase('error')
      setWarnings(result.warnings)
      setErrorMessage(result.error || 'Import failed with an unknown error')
    }
  }, [user, updateProgress, updateStepStatus, setImportComplete])

  const handleManualEntry = useCallback(() => {
    router.push('/add-content')
  }, [])

  const handleContinue = useCallback(() => {
    setImportComplete(true)
    router.replace('/(tabs)/discover')
  }, [setImportComplete])

  const handleRetry = useCallback(() => {
    setPickedFiles([])
    setPhase('picking')
  }, [])

  const handleSkip = useCallback(() => {
    setImportComplete(true)
    router.replace('/(tabs)/discover')
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

  const recognizedCount = pickedFiles.filter((f) => f.type !== 'unknown').length
  const canImport = recognizedCount >= 1 && !isParsing

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>BingeTime</Text>
        {phase === 'importing' && <Text style={styles.headerSubtitle}>Importing your data...</Text>}
        {phase === 'picking' && <Text style={styles.headerSubtitle}>Select your CSV files</Text>}
        {phase === 'landing' && <Text style={styles.headerSubtitle}>Choose how to get started</Text>}
      </View>

      {phase === 'landing' && (
        <LandingContent
          onSelectMode={(mode) => {
            setMode(mode)
            setPhase('picking')
          }}
          onManualEntry={handleManualEntry}
        />
      )}
      {phase === 'picking' && (
        <PickingContent
          mode={mode}
          pickedFiles={pickedFiles}
          isParsing={isParsing}
          canImport={canImport}
          recognizedCount={recognizedCount}
          onPickFiles={handlePickFiles}
          onRemoveFile={handleRemoveFile}
          onStartImport={handleStartImport}
          onBack={() => {
            setPickedFiles([])
            setPhase('landing')
          }}
        />
      )}
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
  onSelectMode,
  onManualEntry,
}: {
  onSelectMode: (mode: ImportMode) => void
  onManualEntry: () => void
}) {
  const { colors } = useTheme()
  const styles = useMemo(() => createStyles(colors), [colors])
  const insets = useSafeAreaInsets()

  return (
    <View style={[styles.content, { paddingBottom: insets.bottom + 16 }]}>
      <View style={styles.welcomeIcon}>
        <Ionicons name="cloud-upload-outline" size={64} color={colors.primary} />
      </View>
      <Text style={styles.welcomeTitle}>Import Your Data</Text>
      <Text style={styles.welcomeText}>
        Choose what you'd like to import from your TV Time export:
      </Text>

      {/* Four mode cards */}
      <View style={styles.optionGrid}>
        <Pressable style={styles.optionCard} onPress={() => onSelectMode('shows')}>
          <Ionicons name="tv-outline" size={28} color={colors.primary} />
          <Text style={styles.optionTitle}>📺 Shows</Text>
          <Text style={styles.optionDesc}>
            Import your episode watch history, show library, favorites & watchlist.
          </Text>
        </Pressable>

        <Pressable style={styles.optionCard} onPress={() => onSelectMode('movies')}>
          <Ionicons name="film-outline" size={28} color={colors.secondary} />
          <Text style={styles.optionTitle}>🎬 Movies</Text>
          <Text style={styles.optionDesc}>
            Import your movie watch history, ratings, and watchlist.
          </Text>
        </Pressable>

        <Pressable style={styles.optionCard} onPress={() => onSelectMode('everything')}>
          <Ionicons name="archive-outline" size={28} color={colors.tertiary} />
          <Text style={styles.optionTitle}>📦 Everything</Text>
          <Text style={styles.optionDesc}>
            Full import: Shows, Movies, and all tracking data combined.
          </Text>
        </Pressable>

        <Pressable style={[styles.optionCard, styles.optionCardFull]} onPress={onManualEntry}>
          <Ionicons name="add-circle-outline" size={28} color={colors.onSurfaceVariant} />
          <Text style={styles.optionTitle}>✏️ Add Manually</Text>
          <Text style={styles.optionDesc}>
            Search TMDb and add content one by one. Great for starting fresh.
          </Text>
        </Pressable>
      </View>

      <Text style={styles.disclaimer}>
        Your data stays private. All matching uses the free TMDb API.
      </Text>
    </View>
  )
}

function PickingContent({
  mode,
  pickedFiles,
  isParsing,
  canImport,
  recognizedCount,
  onPickFiles,
  onRemoveFile,
  onStartImport,
  onBack,
}: {
  mode: ImportMode
  pickedFiles: PickedFile[]
  isParsing: boolean
  canImport: boolean
  recognizedCount: number
  onPickFiles: () => void
  onRemoveFile: (type: CsvFileType) => void
  onStartImport: () => void
  onBack: () => void
}) {
  const { colors } = useTheme()
  const styles = useMemo(() => createStyles(colors), [colors])
  const insets = useSafeAreaInsets()

  const guidance = useMemo(() => {
    switch (mode) {
      case 'shows':
        return 'For shows, please select your episode history file (required) and show list (optional for cleaner library).'
      case 'movies':
        return 'For movies, please select your movie history file (required).'
      default:
        return 'Select your TV Time CSV files. We will auto-detect which file is which.'
    }
  }, [mode])

  return (
    <View style={[styles.content, { paddingBottom: insets.bottom + 16 }]}>
      {/* Guidance */}
      <Text style={styles.pickingInstruction}>{guidance}</Text>


      {/* Pick button */}
      <Pressable
        style={[styles.pickButton, isParsing && styles.pickButtonDisabled]}
        onPress={onPickFiles}
        disabled={isParsing}
      >
        <Ionicons
          name={isParsing ? 'hourglass-outline' : 'folder-open-outline'}
          size={22}
          color="#FFF"
        />
        <Text style={styles.pickButtonText}>
          {isParsing ? 'Parsing files...' : 'Choose CSV Files'}
        </Text>
      </Pressable>

      {/* Picked files list */}
      <ScrollView style={styles.pickedList}>
        {pickedFiles.length === 0 && !isParsing && (
          <View style={styles.emptyState}>
            <Ionicons name="document-outline" size={48} color={colors.onSurfaceVariant} />
            <Text style={styles.emptyText}>No files selected yet</Text>
          </View>
        )}

        {pickedFiles.map((file) => {
          const isUnknown = file.type === 'unknown'
          return (
            <View
              key={file.type}
              style={[styles.pickedItem, isUnknown && styles.pickedItemUnknown]}
            >
              <Ionicons
                name={FILE_ICONS[file.type]}
                size={24}
                color={isUnknown ? colors.error : colors.primary}
              />
              <View style={styles.pickedInfo}>
                <Text style={styles.pickedName} numberOfLines={1}>
                  {file.name}
                </Text>
                <View style={styles.pickedMeta}>
                  <View
                    style={[
                      styles.pickedBadge,
                      isUnknown && styles.pickedBadgeUnknown,
                    ]}
                  >
                    <Text
                      style={[
                        styles.pickedBadgeText,
                        isUnknown && styles.pickedBadgeTextUnknown,
                      ]}
                    >
                      {FILE_LABELS[file.type]}
                    </Text>
                  </View>
                  <Text style={styles.pickedRows}>{file.rowCount} rows</Text>
                </View>
              </View>
              <Pressable
                style={styles.removeButton}
                onPress={() => onRemoveFile(file.type)}
                hitSlop={8}
              >
                <Ionicons name="close-circle" size={20} color={colors.onSurfaceVariant} />
              </Pressable>
            </View>
          )
        })}
      </ScrollView>

      {/* Action buttons */}
      <View style={styles.pickingActions}>
        <Pressable style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
        <Pressable
          style={[styles.startImportButton, !canImport && styles.startImportButtonDisabled]}
          onPress={onStartImport}
          disabled={!canImport}
        >
          <Ionicons name="rocket-outline" size={20} color="#FFF" />
          <Text style={styles.startImportButtonText}>
            Start Import ({recognizedCount} file{recognizedCount !== 1 ? 's' : ''})
          </Text>
        </Pressable>
      </View>
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
    optionGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
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
    optionCardFull: {
      width: '100%',
      flexDirection: 'row',
      gap: 16,
      padding: 18,
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

    // Picking
    pickingInstruction: {
      fontSize: typography.bodySm.fontSize,
      color: colors.onSurfaceVariant,
      lineHeight: 20,
      marginBottom: 16,
    },
    pickButton: {
      backgroundColor: colors.primary,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      borderRadius: borderRadius.lg,
      gap: 8,
      marginBottom: 20,
    },
    pickButtonDisabled: {
      opacity: 0.6,
    },
    pickButtonText: {
      fontSize: typography.bodyMd.fontSize,
      fontWeight: '600',
      color: colors.onPrimary,
    },
    pickedList: {
      flex: 1,
      marginBottom: 16,
    },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 40,
    },
    emptyText: {
      fontSize: typography.bodySm.fontSize,
      color: colors.onSurfaceVariant,
      marginTop: 12,
    },
    pickedItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 14,
      backgroundColor: colors.surfaceContainer,
      borderRadius: borderRadius.md,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
    },
    pickedItemUnknown: {
      borderColor: colors.error + '40',
    },
    pickedInfo: {
      flex: 1,
      marginLeft: 12,
    },
    pickedName: {
      fontSize: typography.bodySm.fontSize,
      fontWeight: '600',
      color: colors.onSurface,
      marginBottom: 4,
    },
    pickedMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    pickedBadge: {
      backgroundColor: colors.primaryContainer,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: borderRadius.full,
    },
    pickedBadgeUnknown: {
      backgroundColor: colors.errorContainer,
    },
    pickedBadgeText: {
      fontSize: typography.bodyXs.fontSize,
      color: colors.primary,
      fontWeight: '500',
    },
    pickedBadgeTextUnknown: {
      color: colors.error,
    },
    pickedRows: {
      fontSize: typography.bodyXs.fontSize,
      color: colors.onSurfaceVariant,
    },
    removeButton: {
      marginLeft: 8,
      padding: 4,
    },
    pickingActions: {
      flexDirection: 'row',
      gap: 12,
    },
    backButton: {
      backgroundColor: colors.surfaceContainerHighest,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      paddingHorizontal: 20,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
    },
    backButtonText: {
      fontSize: typography.bodyMd.fontSize,
      fontWeight: '600',
      color: colors.onSurfaceVariant,
    },
    startImportButton: {
      flex: 1,
      backgroundColor: colors.primary,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      borderRadius: borderRadius.lg,
      gap: 8,
    },
    startImportButtonDisabled: {
      opacity: 0.4,
    },
    startImportButtonText: {
      fontSize: typography.bodyMd.fontSize,
      fontWeight: '700',
      color: colors.onPrimary,
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
