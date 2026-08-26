// ─── withAndroidAbi — restrict packaged Android ABIs ───
//
// React Native reads `reactNativeArchitectures` from gradle.properties when
// packaging native libs. Restricting to arm64-v8a drops Skia's x86/x86_64/
// armeabi-v7a .so files (~160 MB of the old universal APK) — x86* are
// emulator-only and armeabi-v7a is 32-bit legacy (phones pre-~2019).
//
// Usage in app.config.ts plugins:
//   ['./plugins/withAndroidAbi', { abi: 'arm64-v8a' }]

const { withGradleProperties } = require('expo/config-plugins')

const withAndroidAbi = (config, props) => {
  const abi = props?.abi ?? 'arm64-v8a'

  return withGradleProperties(config, (cfg) => {
    // Drop any existing reactNativeArchitectures entries, then set ours
    cfg.modResults = cfg.modResults.filter(
      (entry) => !(entry.type === 'property' && entry.key === 'reactNativeArchitectures')
    )
    cfg.modResults.push({ type: 'property', key: 'reactNativeArchitectures', value: abi })
    return cfg
  })
}

module.exports = withAndroidAbi
