// ─── Theme Context ───
// Provides the active theme's color tokens to the entire app

import { createContext, useContext, useMemo, ReactNode } from 'react'
import { useAppStore } from '@/stores/appStore'
import { getThemePayload, themes, type ThemeMeta, type ThemePayload } from '@/themes'
import type { ThemeKey } from '@/types'

interface ThemeContextType {
  /** Active theme key */
  themeKey: ThemeKey
  /** Full color palette for the active theme */
  colors: ThemePayload['colors']
  /** Tab bar config for the active theme */
  tabBar: ThemePayload['tabBar']
  /** Glass effects config for the active theme */
  glass: ThemePayload['glass']
  /** List of all available theme metadata (for the picker UI) */
  availableThemes: ThemeMeta[]
  /** Switch to a different theme */
  setTheme: (key: ThemeKey) => void
}

export const ThemeContext = createContext<ThemeContextType | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const themeKey = useAppStore((s) => s.theme)
  const setTheme = useAppStore((s) => s.setTheme)

  const value = useMemo<ThemeContextType>(() => {
    const payload = getThemePayload(themeKey)
    return {
      themeKey,
      colors: payload.colors,
      tabBar: payload.tabBar,
      glass: payload.glass,
      availableThemes: themes,
      setTheme,
    }
  }, [themeKey, setTheme])

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextType {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return ctx
}
