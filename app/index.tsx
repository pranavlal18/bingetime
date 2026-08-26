// ─── Splash / Redirect ───

import { View, ActivityIndicator, Text } from 'react-native'
import { Redirect } from 'expo-router'
import { typography } from '@/theme'
import { useTheme } from '@/contexts/ThemeContext'
import { useAuth } from '@/contexts/AuthContext'
import { useAppStore } from '@/stores/appStore'

export default function Index() {
  const { colors } = useTheme()
  const { user, loading } = useAuth()
  const onboardingPending = useAppStore((s) => s.onboardingPending)

  // Declarative redirect — the old imperative router.replace raced
  // InnerLayout's auth guard, bouncing logged-out users index → tabs → login.
  if (!loading) {
    if (!user) return <Redirect href="/(auth)/login" />
    // Wizard is armed ONLY at signup (register.tsx) — returning accounts never see it
    if (onboardingPending) return <Redirect href="/onboarding" />
    return <Redirect href="/(tabs)/shows" />
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
