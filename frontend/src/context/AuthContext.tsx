import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { authService } from '../services/auth.service'
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
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const loadCurrentUser = useCallback(async () => {
    try {
      // Cookie is sent automatically — if valid, returns the user
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
    await authService.logout()  // server clears httpOnly cookies
    setUser(null)
  }

  const isDemoActive = user?.is_demo_active ?? false
  const realEmail = user?.real_email ?? null

  return (
    <AuthContext.Provider value={{ user, isLoading, isDemoActive, realEmail, login, register, logout, reloadUser: loadCurrentUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
