import type { Locale } from '../i18n'
import type { User } from '../types'
import { api } from './api'
import { ENDPOINTS } from './endpoints'

export const authService = {
  register: (email: string, password: string) =>
    api.post<User>(ENDPOINTS.auth.register, { email, password }),

  login: (email: string, password: string) =>
    api.post<User>(ENDPOINTS.auth.login, { email, password }),

  getMe: () => api.get<User>(ENDPOINTS.auth.me),

  updateLocale: (locale: Locale) => api.patch<User>(ENDPOINTS.auth.me, { locale }),

  logout: () => api.post<void>(ENDPOINTS.auth.logout, {}),
}
