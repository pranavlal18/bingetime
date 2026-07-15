import { useMemo } from 'react'
import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/contexts/ThemeContext'

export default function TabLayout() {
  const { colors } = useTheme()

  const screenOptions = useMemo(() => ({
    headerShown: false,
    animation: 'none' as const,
    tabBarActiveTintColor: colors.primary,
    tabBarInactiveTintColor: colors.outlineVariant,
    tabBarStyle: {
      backgroundColor: colors.surfaceContainer,
      borderTopColor: colors.outlineVariant,
      borderTopWidth: 1,
      paddingBottom: 4,
      paddingTop: 4,
      height: 64,
    },
  }), [colors])

  return (
    <Tabs screenOptions={screenOptions}>
      <Tabs.Screen
        name="shows/index"
        options={{
          title: 'Shows',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="tv-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="movies/index"
        options={{
          title: 'Movies',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="film-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="discover/index"
        options={{
          title: 'Discover',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="search-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile/index"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  )
}
