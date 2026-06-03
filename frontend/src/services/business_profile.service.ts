import type { BusinessProfile } from '../types'
import { api } from './api'

export const businessProfileService = {
  get: () => api.get<BusinessProfile>('/business-profile'),
  update: (data: BusinessProfile) => api.put<BusinessProfile>('/business-profile', data),
}
