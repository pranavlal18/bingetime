// ─── Cinematic Precision Design System Tokens ───
// Extracted from Stitch "BingeTime Media Tracker" project
// Last sync: 2026-07-11T06:07:55.439988Z

export const colors = {
  // Surface
  surface: '#15121b',
  surfaceDim: '#15121b',
  surfaceBright: '#3b3742',
  surfaceContainerLowest: '#0f0d15',
  surfaceContainerLow: '#1d1a23',
  surfaceContainer: '#211e27',
  surfaceContainerHigh: '#2c2832',
  surfaceContainerHighest: '#37333d',
  surfaceVariant: '#37333d',

  // On-surface
  onSurface: '#e7e0ed',
  onSurfaceVariant: '#cbc3d7',
  onBackground: '#e7e0ed',
  inverseSurface: '#e7e0ed',
  inverseOnSurface: '#322f39',

  // Primary (Purple)
  primary: '#d0bcff',
  onPrimary: '#3c0091',
  primaryContainer: '#a078ff',
  onPrimaryContainer: '#340080',
  primaryFixed: '#e9ddff',
  primaryFixedDim: '#d0bcff',
  onPrimaryFixed: '#23005c',
  onPrimaryFixedVariant: '#5516be',
  inversePrimary: '#6d3bd7',

  // Accent (vibrant purple for buttons/actions)
  accent: '#8b5cf6',
  accentPressed: '#7c3aed',

  // Secondary (grey-blue)
  secondary: '#c4c6d0',
  onSecondary: '#2d3038',
  secondaryContainer: '#44474f',
  onSecondaryContainer: '#b3b5be',
  secondaryFixed: '#e0e2ec',
  secondaryFixedDim: '#c4c6d0',
  onSecondaryFixed: '#191c22',
  onSecondaryFixedVariant: '#44474f',

  // Tertiary (amber)
  tertiary: '#ffb869',
  tertiaryContainer: '#ca801e',
  onTertiary: '#482900',
  onTertiaryContainer: '#3f2300',
  tertiaryFixed: '#ffdcbb',
  tertiaryFixedDim: '#ffb869',
  onTertiaryFixed: '#2c1700',
  onTertiaryFixedVariant: '#673d00',

  // Error
  error: '#ffb4ab',
  onError: '#690005',
  errorContainer: '#93000a',
  onErrorContainer: '#ffdad6',

  // Outline
  outline: '#958ea0',
  outlineVariant: '#494454',
  surfaceTint: '#d0bcff',

  // Background
  background: '#15121b',

  // Status functional colors
  statusWatching: '#d0bcff',
  statusUpToDate: '#64B5F6',
  statusFinished: '#4CAF50',
  statusStopped: '#ffb4ab',
  success: '#4CAF50',
} as const

export const typography = {
  headlineXl: {
    fontFamily: 'Inter',
    fontSize: 40,
    fontWeight: '800' as const,
    lineHeight: 48,
    letterSpacing: -0.02,
  },
  headlineLg: {
    fontFamily: 'Inter',
    fontSize: 32,
    fontWeight: '700' as const,
    lineHeight: 40,
    letterSpacing: -0.01,
  },
  headlineLgMobile: {
    fontFamily: 'Inter',
    fontSize: 28,
    fontWeight: '700' as const,
    lineHeight: 34,
  },
  headlineSm: {
    fontFamily: 'Inter',
    fontSize: 20,
    fontWeight: '600' as const,
    lineHeight: 28,
  },
  headlineMd: {
    fontFamily: 'Inter',
    fontSize: 24,
    fontWeight: '600' as const,
    lineHeight: 32,
  },
  bodyLg: {
    fontFamily: 'Inter',
    fontSize: 18,
    fontWeight: '400' as const,
    lineHeight: 28,
  },
  bodyMd: {
    fontFamily: 'Inter',
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 24,
  },
  bodySm: {
    fontFamily: 'Inter',
    fontSize: 14,
    fontWeight: '400' as const,
    lineHeight: 20,
  },
  bodyXs: {
    fontFamily: 'Inter',
    fontSize: 12,
    fontWeight: '400' as const,
    lineHeight: 16,
  },
  labelMd: {
    fontFamily: 'Inter',
    fontSize: 14,
    fontWeight: '600' as const,
    lineHeight: 20,
    letterSpacing: 0.01,
  },
  labelSm: {
    fontFamily: 'Inter',
    fontSize: 12,
    fontWeight: '500' as const,
    lineHeight: 16,
    letterSpacing: 0.03,
  },
} as const

export const spacing = {
  unit: 4,
  gutter: 16,
  marginMobile: 20,
  marginDesktop: 48,
  stackSm: 8,
  stackMd: 16,
  stackLg: 32,
} as const

export const borderRadius = {
  sm: 4,
  DEFAULT: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const

export const tabBar = {
  height: 64,
  activeIconGlow: 'rgba(208,188,255,0.4)',
  backgroundColor: 'rgba(21,18,27,0.9)',
} as const

export const glass = {
  pillBackground: 'rgba(15,17,21,0.7)',
  pillBorder: 'rgba(255,255,255,0.1)',
  searchBackground: 'rgba(26,29,36,0.8)',
  searchBlur: 20,
  navBlur: 24,
  cardBorder: 'rgba(255,255,255,0.06)',
} as const
