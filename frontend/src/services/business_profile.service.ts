import type { BusinessProfile } from '../types'
import { api } from './api'
import { ENDPOINTS } from './endpoints'

export const businessProfileService = {
  get: () => api.get<BusinessProfile>(ENDPOINTS.businessProfile.base),
  update: (data: BusinessProfile) =>
    api.put<BusinessProfile>(ENDPOINTS.businessProfile.base, data),
}
