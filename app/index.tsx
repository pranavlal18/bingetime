// ─── Splash / Redirect ───

import { View, ActivityIndicator, Text } from 'react-native'
import { Redirect } from 'expo-router'
import { typography } from '@/theme'
import { useTheme } from '@/contexts/ThemeContext'
import { useAuth } from '@/contexts/AuthContext'

export default function Index() {
  const { colors } = useTheme()
  const { user, loading } = useAuth()

  // Declarative redirect — the old imperative router.replace raced
  // InnerLayout's auth guard, bouncing logged-out users index → tabs → login.
  if (!loading) {
    return <Redirect href={user ? '/(tabs)/shows' : '/(auth)/login'} />
  }

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surface }}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={{ marginTop: 16, fontSize: typography.bodyLg.fontSize, color: colors.onSurfaceVariant }}>
        Loading BingeTime…
      </Text>
    </View>
  )
}
