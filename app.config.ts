import { ExpoConfig, ConfigContext } from 'expo/config';

// arm64-v8a covers every real device since ~2019. Dev builds keep x86_64 so
// Android emulators can still run the dev client.
const EAS_BUILD_PROFILE = process.env.EAS_BUILD_PROFILE;
const androidAbi =
  EAS_BUILD_PROFILE === 'development' ? 'arm64-v8a,x86_64' : 'arm64-v8a';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'BingeTime',
  slug: 'bingetime',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  scheme: 'bingetime',
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.bingetime.app',
  },
  android: {
    adaptiveIcon: {
      backgroundColor: '#0F0F0F',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    package: 'com.bingetime.app',
  },
  web: {
    favicon: './assets/favicon.png',
    bundler: 'metro',
  },
  plugins: [
    'expo-router',
    'expo-image',
    'expo-font',
    [
      'expo-notifications',
      {
        iosDisplayInForeground: true,
        androidMode: 'default',
      },
    ],
    ['./plugins/withAndroidAbi', { abi: androidAbi }],
  ],
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    tmdbApiKey: process.env.EXPO_PUBLIC_TMDB_API_KEY,
    router: {},
  },
  runtimeVersion: {
    policy: 'appVersion',
  },
});
