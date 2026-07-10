import { useEffect } from 'react'
import { View, ActivityIndicator, Text } from 'react-native'
import { router } from 'expo-router'

export default function Index() {
  useEffect(() => {
    router.replace('/(tabs)/shows')
  }, [])

  return (
    <View className="flex-1 items-center justify-center bg-[#1a1a2e]">
      <ActivityIndicator size="large" color="#e94560" />
      <Text className="mt-4 text-lg text-[#9ca3af]">Loading BingeTime…</Text>
    </View>
  )
}
