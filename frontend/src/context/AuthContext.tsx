import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { authService } from '../services/auth.service'
import i18n, { type Locale, STORAGE_KEY } from '../i18n'
import type { User } from '../types'

interface AuthContextValue {
  user: User | null
  isLoading: boolean
  isDemoActive: boolean
  realEmail: string | null
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  reloadUser: () => Promise<void>
  setLocale: (locale: Locale) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const loadCurrentUser = useCallback(async () => {
    try {
      const currentUser = await authService.getMe()
      setUser(currentUser)
    } catch {
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadCurrentUser()
  }, [loadCurrentUser])

  // Keep i18n + localStorage in sync with the user's stored preference.
  useEffect(() => {
    if (user?.locale && i18n.language !== user.locale) {
      void i18n.changeLanguage(user.locale)
      localStorage.setItem(STORAGE_KEY, user.locale)
    }
  }, [user?.locale])

  useEffect(() => {
    const handleSessionExpired = () => setUser(null)
    window.addEventListener('session-expired', handleSessionExpired)
    return () => window.removeEventListener('session-expired', handleSessionExpired)
  }, [])

  const login = async (email: string, password: string) => {
    const currentUser = await authService.login(email, password)
    setUser(currentUser)
  }

  const register = async (email: string, password: string) => {
    const currentUser = await authService.register(email, password)
    setUser(currentUser)
  }

  const logout = async () => {
    await authService.logout()
    setUser(null)
  }

  const setLocale = async (locale: Locale) => {
    const updated = await authService.updateLocale(locale)
    setUser(updated)
  }

  const isDemoActive = user?.is_demo_active ?? false
  const realEmail = user?.real_email ?? null

  return (
    <AuthContext.Provider value={{ user, isLoading, isDemoActive, realEmail, login, register, logout, reloadUser: loadCurrentUser, setLocale }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
