// ─── Theme Registry ───

import type { ThemeKey } from '@/types'

// Individual theme palettes
import { colors as cinematicDark, tabBar as cinematicDarkTab, glass as cinematicDarkGlass, swatches as cinematicDarkSwatches } from './cinematicDark'
import { colors as midnightBlue, tabBar as midnightBlueTab, glass as midnightBlueGlass, swatches as midnightBlueSwatches } from './midnightBlue'
import { colors as forest, tabBar as forestTab, glass as forestGlass, swatches as forestSwatches } from './forest'
import { colors as amberGlow, tabBar as amberGlowTab, glass as amberGlowGlass, swatches as amberGlowSwatches } from './amberGlow'
import { colors as neonCyber, tabBar as neonCyberTab, glass as neonCyberGlass, swatches as neonCyberSwatches } from './neonCyber'
import { colors as luminescent, tabBar as luminescentTab, glass as luminescentGlass, swatches as luminescentSwatches } from './luminescent'

// Theme metadata for the picker UI
export interface ThemeMeta {
  key: ThemeKey
  name: string
  icon: string // Ionicons icon name
  description: string
  swatches: readonly [string, string, string] // primary, accent, surface
}

// Shape of a theme's color palette (all values are strings)
export interface ThemeColors {
  surface: string
  surfaceDim: string
  surfaceBright: string
  surfaceContainerLowest: string
  surfaceContainerLow: string
  surfaceContainer: string
  surfaceContainerHigh: string
  surfaceContainerHighest: string
  surfaceVariant: string
  onSurface: string
  onSurfaceVariant: string
  onBackground: string
  inverseSurface: string
  inverseOnSurface: string
  primary: string
  onPrimary: string
  primaryContainer: string
  onPrimaryContainer: string
  primaryFixed: string
  primaryFixedDim: string
  onPrimaryFixed: string
  onPrimaryFixedVariant: string
  inversePrimary: string
  accent: string
  accentPressed: string
  secondary: string
  onSecondary: string
  secondaryContainer: string
  onSecondaryContainer: string
  secondaryFixed: string
  secondaryFixedDim: string
  onSecondaryFixed: string
  onSecondaryFixedVariant: string
  tertiary: string
  tertiaryContainer: string
  onTertiary: string
  onTertiaryContainer: string
  tertiaryFixed: string
  tertiaryFixedDim: string
  onTertiaryFixed: string
  onTertiaryFixedVariant: string
  error: string
  onError: string
  errorContainer: string
  onErrorContainer: string
  outline: string
  outlineVariant: string
  surfaceTint: string
  background: string
  statusWatching: string
  statusUpToDate: string
  statusFinished: string
  statusStopped: string
  success: string
}

export interface ThemeTabBar {
  activeIconGlow: string
  backgroundColor: string
}

export interface ThemeGlass {
  pillBackground: string
  pillBorder: string
  searchBackground: string
  searchBlur: number
  navBlur: number
  cardBorder: string
}

// Full theme payload provided by ThemeContext
export interface ThemePayload {
  colors: ThemeColors
  tabBar: ThemeTabBar
  glass: ThemeGlass
}

// Registry of all available themes
export const themes: ThemeMeta[] = [
  {
    key: 'cinematic-dark',
    name: 'Cinematic Dark',
    icon: 'film-outline',
    description: 'Deep purple cinematic vibes',
    swatches: cinematicDarkSwatches,
  },
  {
    key: 'midnight-blue',
    name: 'Midnight Blue',
    icon: 'moon-outline',
    description: 'Cool indigo depths',
    swatches: midnightBlueSwatches,
  },
  {
    key: 'forest',
    name: 'Forest',
    icon: 'leaf-outline',
    description: 'Earthy green tones',
    swatches: forestSwatches,
  },
  {
    key: 'amber-glow',
    name: 'Amber Glow',
    icon: 'sunny-outline',
    description: 'Warm amber radiance',
    swatches: amberGlowSwatches,
  },
  {
    key: 'neon-cyber',
    name: 'Neon Cyber',
    icon: 'flash-outline',
    description: 'Cyan & pink neon',
    swatches: neonCyberSwatches,
  },
  {
    key: 'luminescent',
    name: 'Luminescent',
    icon: 'sunny-outline',
    description: 'Clean light mode',
    swatches: luminescentSwatches,
  },
]

// Map from key → full palette
const paletteMap: Record<ThemeKey, ThemePayload> = {
  'cinematic-dark': { colors: cinematicDark, tabBar: cinematicDarkTab, glass: cinematicDarkGlass },
  'midnight-blue': { colors: midnightBlue, tabBar: midnightBlueTab, glass: midnightBlueGlass },
  'forest': { colors: forest, tabBar: forestTab, glass: forestGlass },
  'amber-glow': { colors: amberGlow, tabBar: amberGlowTab, glass: amberGlowGlass },
  'neon-cyber': { colors: neonCyber, tabBar: neonCyberTab, glass: neonCyberGlass },
  'luminescent': { colors: luminescent, tabBar: luminescentTab, glass: luminescentGlass },
}

/** Resolve a theme key to its full color/tabBar/glass payload. */
export function getThemePayload(key: ThemeKey): ThemePayload {
  return paletteMap[key] ?? paletteMap['cinematic-dark']
}
