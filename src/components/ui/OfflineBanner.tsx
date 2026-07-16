import { View, Text, StyleSheet } from 'react-native'
import { useNetInfo } from '@react-native-community/netinfo'

export function OfflineBanner() {
  const netInfo = useNetInfo()

  // Only show when specifically offline
  if (netInfo.isConnected === null || netInfo.isConnected === true) {
    return null
  }

  return (
    <View style={styles.container}>
      <Text style={styles.text}>You are currently offline.</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#e94560',
    padding: 8,
    paddingTop: 12, // Account for status bar
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  text: {
    color: 'white',
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 12,
  },
})
