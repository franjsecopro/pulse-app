import { api } from './api'
import type { TokenResponse, User } from '../types'

export const authService = {
  register: (email: string, password: string) =>
    api.post<TokenResponse>('/auth/register', { email, password }),

  login: (email: string, password: string) =>
    api.post<TokenResponse>('/auth/login', { email, password }),

  getMe: () => api.get<User>('/auth/me'),

  logout: () => api.clearTokens(),
}
