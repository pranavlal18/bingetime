import { View, Text, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNetInfo } from '@react-native-community/netinfo'
import { useTheme } from '@/contexts/ThemeContext'

export function OfflineBanner() {
  const netInfo = useNetInfo()
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()

  // Only show when specifically offline
  if (netInfo.isConnected === null || netInfo.isConnected === true) {
    return null
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.errorContainer, paddingTop: insets.top + 8 }]}>
      <Text style={[styles.text, { color: colors.onError }]}>You are currently offline.</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: 8,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  text: {
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 12,
  },
})
