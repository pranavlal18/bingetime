// ─── FavoriteToggle — Heart icon (♡ unfilled / ♥ filled) for shows & movies ───

import { memo, useCallback } from 'react'
import { Pressable, ActivityIndicator, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

interface FavoriteToggleProps {
  isFavorited: boolean
  onToggle: () => void
  isPending?: boolean
  size?: number
}

const FavoriteToggle = memo(function FavoriteToggle({
  isFavorited,
  onToggle,
  isPending = false,
  size = 28,
}: FavoriteToggleProps) {
  const handlePress = useCallback(() => {
    onToggle()
  }, [onToggle])

  const iconSize = Math.round(size * 0.57)

  return (
    <Pressable
      style={[
        styles.button,
        { width: size, height: size, borderRadius: size / 2 },
        isFavorited && styles.buttonActive,
      ]}
      onPress={handlePress}
      disabled={isPending}
    >
      {isPending ? (
        <ActivityIndicator size="small" color="#fff" />
      ) : (
        <Ionicons
          name={isFavorited ? 'heart' : 'heart-outline'}
          size={iconSize}
          color={isFavorited ? '#ff3b30' : '#fff'}
        />
      )}
    </Pressable>
  )
})

const styles = StyleSheet.create({
  button: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  buttonActive: {
    backgroundColor: 'rgba(255,59,48,0.25)',
    borderColor: '#ff3b30',
  },
})

export default FavoriteToggle
