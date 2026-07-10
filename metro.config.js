const { getDefaultConfig } = require('expo/metro-config')
const { withNativeWind } = require('nativewind/metro')

const config = getDefaultConfig(__dirname)

// Add .csv to asset extensions so Metro bundles them
config.resolver.assetExts.push('csv')

module.exports = withNativeWind(config, { input: './global.css' })
