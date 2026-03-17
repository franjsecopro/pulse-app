import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { api } from '../services/api'
import { authService } from '../services/auth.service'
import type { User } from '../types'

interface AuthContextValue {
  user: User | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const loadCurrentUser = useCallback(async () => {
    const { accessToken } = api.getStoredTokens()
    if (!accessToken) {
      setIsLoading(false)
      return
    }
    try {
      const currentUser = await authService.getMe()
      setUser(currentUser)
    } catch {
      api.clearTokens()
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadCurrentUser()
  }, [loadCurrentUser])

  const login = async (email: string, password: string) => {
    const tokens = await authService.login(email, password)
    api.storeTokens(tokens.access_token, tokens.refresh_token)
    const currentUser = await authService.getMe()
    setUser(currentUser)
  }

  const register = async (email: string, password: string) => {
    const tokens = await authService.register(email, password)
    api.storeTokens(tokens.access_token, tokens.refresh_token)
    const currentUser = await authService.getMe()
    setUser(currentUser)
  }

  const logout = () => {
    authService.logout()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
