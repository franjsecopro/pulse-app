import { api } from './api'
import type { User } from '../types'
import type { Locale } from '../i18n'

export const authService = {
  register: (email: string, password: string) =>
    api.post<User>('/auth/register', { email, password }),

  login: (email: string, password: string) =>
    api.post<User>('/auth/login', { email, password }),

  getMe: () => api.get<User>('/auth/me'),

  updateLocale: (locale: Locale) => api.patch<User>('/auth/me', { locale }),

  logout: () => api.post<void>('/auth/logout', {}),
}
