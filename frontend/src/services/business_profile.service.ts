import { api } from './api'
import type { BusinessProfile } from '../types'

export const businessProfileService = {
  get: () => api.get<BusinessProfile>('/business-profile'),
  update: (data: BusinessProfile) => api.put<BusinessProfile>('/business-profile', data),
}
