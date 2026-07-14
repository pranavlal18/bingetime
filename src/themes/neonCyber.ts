// ─── Neon Cyber — cyan/pink cyberpunk palette ───

export const colors = {
  surface: '#0d111a',
  surfaceDim: '#090c14',
  surfaceBright: '#1e2430',
  surfaceContainerLowest: '#060910',
  surfaceContainerLow: '#11151f',
  surfaceContainer: '#161a25',
  surfaceContainerHigh: '#202530',
  surfaceContainerHighest: '#2b303c',
  surfaceVariant: '#2b303c',

  onSurface: '#e0e2ea',
  onSurfaceVariant: '#c2c5d0',
  onBackground: '#e0e2ea',
  inverseSurface: '#e0e2ea',
  inverseOnSurface: '#1e2430',

  primary: '#00e5ff',
  onPrimary: '#003640',
  primaryContainer: '#0097a7',
  onPrimaryContainer: '#00222a',
  primaryFixed: '#b2ebf2',
  primaryFixedDim: '#00e5ff',
  onPrimaryFixed: '#001f26',
  onPrimaryFixedVariant: '#006978',
  inversePrimary: '#00838f',

  accent: '#ff4081',
  accentPressed: '#e91e63',

  secondary: '#c4c6d0',
  onSecondary: '#2d3038',
  secondaryContainer: '#44474f',
  onSecondaryContainer: '#b3b5be',
  secondaryFixed: '#e0e2ec',
  secondaryFixedDim: '#c4c6d0',
  onSecondaryFixed: '#191c22',
  onSecondaryFixedVariant: '#44474f',

  tertiary: '#ea80fc',
  tertiaryContainer: '#ce44e0',
  onTertiary: '#3b0051',
  onTertiaryContainer: '#280039',
  tertiaryFixed: '#e9b6f5',
  tertiaryFixedDim: '#ea80fc',
  onTertiaryFixed: '#210031',
  onTertiaryFixedVariant: '#71008b',

  error: '#ffb4ab',
  onError: '#690005',
  errorContainer: '#93000a',
  onErrorContainer: '#ffdad6',

  outline: '#8e92a0',
  outlineVariant: '#3f4452',
  surfaceTint: '#00e5ff',

  background: '#0d111a',

  statusWatching: '#00e5ff',
  statusUpToDate: '#448aff',
  statusFinished: '#00e676',
  statusStopped: '#ff5252',
  success: '#00e676',
} as const

export const tabBar = {
  activeIconGlow: 'rgba(0,229,255,0.4)',
  backgroundColor: 'rgba(13,17,26,0.9)',
} as const

export const glass = {
  pillBackground: 'rgba(6,9,16,0.75)',
  pillBorder: 'rgba(0,229,255,0.15)',
  searchBackground: 'rgba(17,21,31,0.8)',
  searchBlur: 20,
  navBlur: 24,
  cardBorder: 'rgba(0,229,255,0.08)',
} as const

export const swatches = ['#00e5ff', '#ff4081', '#0d111a'] as const
