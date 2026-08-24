import { createClient } from '@supabase/supabase-js'
import Constants from 'expo-constants'
import { mmkvAsyncStorage } from './mmkv'

// Supabase credentials — set these in your .env or use expo-constants
// For local dev, you can hardcode them temporarily (never commit)
const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl ?? process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? ''

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // MMKV-backed (sync reads on cold start); mmkvAsyncStorage falls back to
    // AsyncStorage on web/Expo Go.
    storage: mmkvAsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
