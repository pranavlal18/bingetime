// ─── LibraryToggle — Add (+ inLibrary=false) / Remove (✓ inLibrary=true) ───

import { memo, useCallback, useMemo } from 'react'
import { Pressable, ActivityIndicator, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAddToLibrary, useRemoveFromLibrary } from '@/lib/queries/discover'
import { useTheme } from '@/contexts/ThemeContext'
import type { DiscoverResult } from '@/lib/queries/discover'

interface LibraryToggleProps {
  tmdbId: number
  mediaType: 'tv' | 'movie'
  title: string
  posterPath: string | null
  year: string | null
  inLibrary: boolean
  libraryId?: string
  size?: number
}

const LibraryToggle = memo(function LibraryToggle({
  tmdbId,
  mediaType,
  title,
  posterPath,
  year,
  inLibrary,
  libraryId,
  size = 28,
}: LibraryToggleProps) {
  const addMutation = useAddToLibrary()
  const removeMutation = useRemoveFromLibrary()
  const { colors } = useTheme()

  const isLoading = addMutation.isPending || removeMutation.isPending

  const handlePress = useCallback(() => {
    const discoverItem: DiscoverResult = {
      tmdbId,
      mediaType,
      title,
      poster_path: posterPath,
      year,
      overview: null,
      inLibrary,
      libraryId,
    }
    if (inLibrary) {
      removeMutation.mutate(discoverItem)
    } else {
      addMutation.mutate(discoverItem)
    }
  }, [tmdbId, mediaType, title, posterPath, year, inLibrary, libraryId, addMutation, removeMutation])

  const iconSize = Math.round(size * 0.57)

  const styles = useMemo(() => StyleSheet.create({
    button: {
      backgroundColor: 'rgba(0,0,0,0.55)',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1.5,
      borderColor: 'rgba(255,255,255,0.25)',
    },
    buttonActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
  }), [colors])

  return (
    <Pressable
      style={[
        styles.button,
        { width: size, height: size, borderRadius: size / 2 },
        inLibrary && styles.buttonActive,
      ]}
      onPress={handlePress}
      disabled={isLoading}
    >
      {isLoading ? (
        <ActivityIndicator size="small" color="#fff" />
      ) : (
        <Ionicons
          name={inLibrary ? 'checkmark' : 'add'}
          size={iconSize}
          color="#fff"
        />
      )}
    </Pressable>
  )
})

export default LibraryToggle
