import { Stack } from 'expo-router'
import { StyleSheet } from 'react-native'

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: styles.screen }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="forgot-password" />
    </Stack>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0f0f1a', // dark background matching theme
  },
})