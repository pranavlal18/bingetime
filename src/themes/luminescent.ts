// ─── Luminescent — light mode palette ───

export const colors = {
  surface: '#fffbff',
  surfaceDim: '#e0dbe3',
  surfaceBright: '#fffbff',
  surfaceContainerLowest: '#ffffff',
  surfaceContainerLow: '#f7f2fa',
  surfaceContainer: '#f3edf7',
  surfaceContainerHigh: '#ede7f1',
  surfaceContainerHighest: '#e7e1eb',
  surfaceVariant: '#e7e1eb',

  onSurface: '#1c1b1f',
  onSurfaceVariant: '#49454f',
  onBackground: '#1c1b1f',
  inverseSurface: '#313033',
  inverseOnSurface: '#f4eff4',

  primary: '#6750a4',
  onPrimary: '#ffffff',
  primaryContainer: '#e9ddff',
  onPrimaryContainer: '#4f378b',
  primaryFixed: '#e9ddff',
  primaryFixedDim: '#d0bcff',
  onPrimaryFixed: '#23005c',
  onPrimaryFixedVariant: '#4f378b',
  inversePrimary: '#d0bcff',

  accent: '#7c3aed',
  accentPressed: '#6d28d9',

  secondary: '#625b71',
  onSecondary: '#ffffff',
  secondaryContainer: '#e8def8',
  onSecondaryContainer: '#4a4458',
  secondaryFixed: '#e8def8',
  secondaryFixedDim: '#ccc2dc',
  onSecondaryFixed: '#1d192b',
  onSecondaryFixedVariant: '#4a4458',

  tertiary: '#7d5260',
  tertiaryContainer: '#ffd8e4',
  onTertiary: '#ffffff',
  onTertiaryContainer: '#633b48',
  tertiaryFixed: '#ffd8e4',
  tertiaryFixedDim: '#efb8c8',
  onTertiaryFixed: '#31101d',
  onTertiaryFixedVariant: '#633b48',

  error: '#ba1a1a',
  onError: '#ffffff',
  errorContainer: '#ffdad6',
  onErrorContainer: '#410002',

  outline: '#79747e',
  outlineVariant: '#cac4d0',
  surfaceTint: '#6750a4',

  background: '#fffbff',

  statusWatching: '#6750a4',
  statusUpToDate: '#1565c0',
  statusFinished: '#2e7d32',
  statusStopped: '#c62828',
  success: '#2e7d32',
} as const

export const tabBar = {
  activeIconGlow: 'rgba(103,80,164,0.25)',
  backgroundColor: 'rgba(255,251,255,0.85)',
} as const

export const glass = {
  pillBackground: 'rgba(255,255,255,0.7)',
  pillBorder: 'rgba(0,0,0,0.08)',
  searchBackground: 'rgba(255,255,255,0.8)',
  searchBlur: 20,
  navBlur: 24,
  cardBorder: 'rgba(0,0,0,0.06)',
} as const

export const swatches = ['#6750a4', '#7c3aed', '#fffbff'] as const
