import '../global.css'

import { useEffect } from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { StyleSheet, ActivityIndicator, View, Linking, Platform } from 'react-native'
import { useAuth, AuthProvider } from '@/contexts/AuthContext'
import { useSegments, useRouter } from 'expo-router'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 30,
      retry: 2,
    },
  },
})

// Inner layout that has access to auth context
function InnerLayout() {
  const { user, loading, session } = useAuth()
  const segments = useSegments()
  const router = useRouter()

  // Handle auth redirects after initial session loads
  useEffect(() => {
    if (!loading) {
      const inAuthGroup = segments[0] === '(auth)'
      const inTabsGroup = segments[0] === '(tabs)'

      console.log('🔀 [InnerLayout] Redirect check:', {
        user: user?.email ?? null,
        session: !!session,
        segments: segments[0],
        inAuthGroup,
        inTabsGroup,
      })

      if (user && inAuthGroup) {
        console.log('🔀 [InnerLayout] Redirecting to /(tabs)/shows')
        router.replace('/(tabs)/shows')
      } else if (!user && inTabsGroup) {
        console.log('🔀 [InnerLayout] Redirecting to /(auth)/login')
        router.replace('/(auth)/login')
      }
    }
  }, [user, loading, segments, router])

  // Handle Supabase email verification deep links
  useEffect(() => {
    const handleDeepLink = async (url: string | null) => {
      if (!url) return
      console.log('🔗 [InnerLayout] Deep link received:', url)
      // Supabase redirects to: bingetime://auth/callback?code=...&type=signup
      if (url.includes('auth/callback')) {
        console.log('🔗 [InnerLayout] Auth callback detected, waiting for session...')
        // Let Supabase handle the code exchange
        // The onAuthStateChange listener in AuthContext will pick up the new session
        return
      }
    }

    // Handle initial URL if app was opened via deep link
    Linking.getInitialURL().then(handleDeepLink)

    // Listen for subsequent deep links
    const subscription = Linking.addEventListener('url', ({ url }) => handleDeepLink(url))
    return () => subscription.remove()
  }, [])

  // Initialize NativeWind dark mode
  useEffect(() => {
    (StyleSheet as any).setFlag?.('darkMode', 'class')
  }, [])

  if (loading) {
    console.log('⏳ [InnerLayout] Loading...')
    return (
      <GestureHandlerRootView style={styles.root}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#d0bcff" />
        </View>
      </GestureHandlerRootView>
    )
  }

  console.log('✅ [InnerLayout] Rendering Stack:', { user: user?.email ?? null, segments: segments[0] })

  return (
    <GestureHandlerRootView style={styles.root}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="light" />
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
          <Stack.Screen name="import" />
          <Stack.Screen
            name="discover/trending"
            options={{ animation: 'slide_from_right' }}
          />
        </Stack>
      </QueryClientProvider>
    </GestureHandlerRootView>
  )
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <AuthProvider>
        <InnerLayout />
      </AuthProvider>
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