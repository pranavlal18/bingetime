// ─── AnimatedPoster — expo-image with FadeIn + shimmer skeleton ───

import { useState, useCallback, useMemo } from 'react'
import { View, StyleSheet } from 'react-native'
import { Image } from 'expo-image'
import Animated, { FadeIn } from 'react-native-reanimated'
import { Ionicons } from '@expo/vector-icons'
import { borderRadius } from '@/theme'
import { useTheme } from '@/contexts/ThemeContext'
import { PosterSkeleton } from '@/components/ui/ShimmerSkeleton'

interface AnimatedPosterProps {
  uri: string | null
  style?: object
}

export default function AnimatedPoster({ uri, style }: AnimatedPosterProps) {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)
  const { colors } = useTheme()

  const styles = useMemo(() => StyleSheet.create({
    container: {
      backgroundColor: colors.surfaceContainer,
      overflow: 'hidden',
    },
    placeholder: {
      ...StyleSheet.absoluteFill,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.surfaceContainer,
    },
    image: {
      width: '100%',
      height: '100%',
    },
  }), [colors])

  if (!uri || error) {
    return (
      <View style={[styles.container, style]}>
        <View style={styles.placeholder}>
          <Ionicons name="film-outline" size={32} color={colors.outlineVariant} />
        </View>
      </View>
    )
  }

  return (
    <View style={[styles.container, style]}>
      {!loaded && (
        <PosterSkeleton style={StyleSheet.absoluteFill} />
      )}
      <Animated.View entering={FadeIn.duration(400)} style={StyleSheet.absoluteFill}>
        <Image
          source={{ uri }}
          style={styles.image}
          contentFit="cover"
          cachePolicy="memory-disk"
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          transition={300}
        />
      </Animated.View>
    </View>
  )
}
