import '../global.css'

import { useEffect, useState } from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { StyleSheet, ActivityIndicator, View, Linking, Alert, Text } from 'react-native'
import { useAuth, AuthProvider } from '@/contexts/AuthContext'
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext'
import { useSegments, useRouter } from 'expo-router'
import { useNotificationScheduler } from '@/hooks/useNotificationScheduler'
import * as Notifications from 'expo-notifications'
import { OfflineBanner } from '@/components/ui/OfflineBanner'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import Toast from 'react-native-toast-message'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 60 * 24,
      retry: 2,
      networkMode: 'offlineFirst',
    },
  },
})

const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  throttleTime: 3000,
})

// Inner layout that has access to auth context
function InnerLayout() {
  const { user, loading, session } = useAuth()
  const segments = useSegments()
  const router = useRouter()
  const { themeKey } = useTheme()
  const isLightTheme = themeKey === 'luminescent'

  // Handle auth redirects after initial session loads
  useEffect(() => {
    if (!loading) {
      const inAuthGroup = segments[0] === '(auth)'
      const inTabsGroup = segments[0] === '(tabs)'

      if (__DEV__) console.log('🔀 [InnerLayout] Redirect check:', {
        user: user?.email ?? null,
        session: !!session,
        segments: segments[0],
        inAuthGroup,
        inTabsGroup,
      })

      if (user && inAuthGroup) {
        if (__DEV__) console.log('🔀 [InnerLayout] Redirecting to /(tabs)/shows')
        router.replace('/(tabs)/shows')
      } else if (!user && inTabsGroup) {
        if (__DEV__) console.log('🔀 [InnerLayout] Redirecting to /(auth)/login')
        router.replace('/(auth)/login')
      }
    }
  }, [user, loading, segments, router])

  // Handle Supabase email verification deep links
  useEffect(() => {
    const handleDeepLink = async (url: string | null) => {
      if (!url) return
      if (__DEV__) console.log('🔗 [InnerLayout] Deep link received:', url)
      // Supabase redirects to: bingetime://auth/callback?code=...&type=signup
      if (url.includes('auth/callback')) {
        if (__DEV__) console.log('🔗 [InnerLayout] Auth callback detected, waiting for session...')
        // Let Supabase handle the code exchange
        // The onAuthStateChange listener in AuthContext will pick up the new session
        return
      }
    }

    // Handle initial URL if app was opened via deep link
    Linking.getInitialURL().then(handleDeepLink).catch(err => console.error('🔗 [InnerLayout] Initial deep link failed:', err))

    // Listen for subsequent deep links
    const subscription = Linking.addEventListener('url', ({ url }) => handleDeepLink(url))
    return () => subscription.remove()
  }, [])

  // Navigate to show when user taps a notification
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const { showId, showName } =
          response.notification.request.content.data ?? {}
        if (showId) {
          router.push(`/show/${showId}`)
        }
      }
    )
    return () => sub.remove()
  }, [router])

  // Notification scheduler component (must be inside QueryClientProvider)
  function NotificationScheduler() {
    useNotificationScheduler()
    return null
  }

  if (loading) {
    if (__DEV__) console.log('⏳ [InnerLayout] Loading...')
    return (
      <GestureHandlerRootView style={styles.root}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={themeKey !== 'luminescent' ? '#d0bcff' : '#6750a4'} />
        </View>
      </GestureHandlerRootView>
    )
  }

  if (__DEV__) console.log('✅ [InnerLayout] Rendering Stack:', { user: user?.email ?? null, segments: segments[0] })

  return (
    <GestureHandlerRootView style={styles.root}>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister: asyncStoragePersister,
          maxAge: 1000 * 60 * 60 * 24,
        }}
      >
        <StatusBar style={isLightTheme ? 'dark' : 'light'} />
        <NotificationScheduler />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="show/[id]"
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="movie/[id]"
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="discover/trending"
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="all-shows"
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="all-movies"
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="favorite-shows"
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="favorite-movies"
            options={{ animation: 'slide_from_right' }}
          />
        </Stack>
        <Toast />
      </PersistQueryClientProvider>
    </GestureHandlerRootView>
  )
}

function EnvGuard({ children }: { children: React.ReactNode }) {
  const [missing, setMissing] = useState<string[] | null>(null)

  useEffect(() => {
    const required = [
      { key: 'EXPO_PUBLIC_SUPABASE_URL', label: 'Supabase URL' },
      { key: 'EXPO_PUBLIC_SUPABASE_ANON_KEY', label: 'Supabase Anon Key' },
      { key: 'EXPO_PUBLIC_TMDB_API_KEY', label: 'TMDb API Key' },
    ]
    const missingVars = required.filter(
      ({ key }) => !process.env[key]
    )
    if (missingVars.length > 0) {
      setMissing(missingVars.map((v) => v.label))
      if (__DEV__) {
        Alert.alert(
          'Missing Environment Variables',
          `Required env vars not set:\n${missingVars.map((v) => `• ${v.label}`).join('\n')}\n\nCheck your .env file.`
        )
      }
    }
  }, [])

  // Block rendering if env vars are missing
  if (missing && missing.length > 0) {
    return (
      <View style={[styles.root, styles.loadingContainer]}>
        <Text style={{ color: 'red', fontWeight: 'bold' }}>Configuration Error</Text>
        <Text style={{ color: 'red' }}>Missing: {missing.join(', ')}</Text>
      </View>
    )
  }

  return <>{children}</>
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <OfflineBanner />
      <EnvGuard>
        <AuthProvider>
          <ThemeProvider>
            <ErrorBoundary>
              <InnerLayout />
            </ErrorBoundary>
          </ThemeProvider>
        </AuthProvider>
      </EnvGuard>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
})