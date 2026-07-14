// ─── Splash / Redirect ───

import { useEffect } from 'react'
import { View, ActivityIndicator, Text } from 'react-native'
import { router } from 'expo-router'
import { typography } from '@/theme'
import { useTheme } from '@/contexts/ThemeContext'

export default function Index() {
  const { colors } = useTheme()
  useEffect(() => {
    router.replace('/(tabs)/shows')
  }, [])

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surface }}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={{ marginTop: 16, fontSize: typography.bodyLg.fontSize, color: colors.onSurfaceVariant }}>
        Loading BingeTime…
      </Text>
    </View>
  )
}
