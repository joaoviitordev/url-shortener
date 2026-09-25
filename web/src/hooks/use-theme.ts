import { useCallback, useEffect, useState } from 'react'
import { flushSync } from 'react-dom'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'theme'

const THEME_COLORS: Record<Theme, string> = {
  light: '#fbfbfd',
  dark: '#000000',
}

const darkSchemeQuery = window.matchMedia('(prefers-color-scheme: dark)')
const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')

const readStoredTheme = (): Theme | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored === 'light' || stored === 'dark' ? stored : null
  } catch {
    return null
  }
}

const storeTheme = (theme: Theme): boolean => {
  try {
    localStorage.setItem(STORAGE_KEY, theme)
    return true
  } catch {
    return false
  }
}

const systemTheme = (): Theme => (darkSchemeQuery.matches ? 'dark' : 'light')

const applyTheme = (theme: Theme) => {
  document.documentElement.dataset.theme = theme
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', THEME_COLORS[theme])
}

const currentTheme = (): Theme =>
  document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'

export const useTheme = () => {
  const [theme, setTheme] = useState<Theme>(currentTheme)

  useEffect(() => {
    const followSystem = () => {
      if (readStoredTheme()) return
      const next = systemTheme()
      applyTheme(next)
      setTheme(next)
    }

    darkSchemeQuery.addEventListener('change', followSystem)
    return () => darkSchemeQuery.removeEventListener('change', followSystem)
  }, [])

  const toggleTheme = useCallback(() => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    storeTheme(next)

    const commit = () => {
      applyTheme(next)
      setTheme(next)
    }

    if (
      typeof document.startViewTransition !== 'function' ||
      reducedMotionQuery.matches
    ) {
      commit()
      return
    }

    document.startViewTransition(() => flushSync(commit))
  }, [theme])

  return { theme, toggleTheme }
}
