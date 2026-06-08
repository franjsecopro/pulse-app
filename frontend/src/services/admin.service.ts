import type { AdminClient, User } from '../types'
import { api } from './api'

interface AdminUser {
  id: number
  email: string
  role: 'admin' | 'user'
  createdAt: string
}

interface DemoResetResult {
  clientsCount: number
  classes_count: number
  reseedAt: string
}

interface DemoStatus {
  demoUserId: number
}

export const adminService = {
  listUsers: () => api.get<AdminUser[]>('/admin/users'),

  setUserRole: (userId: number, role: 'admin' | 'user') =>
    api.put<AdminUser>(`/admin/users/${userId}/role?role=${role}`, {}),

  deleteUser: (userId: number) => api.delete(`/admin/users/${userId}`),

  syncGCal: (userId: number) =>
    api.post<{ scheduled: number }>(`/admin/users/${userId}/sync-gcal`, {}),

  listClients: (opts?: { archivedOnly?: boolean; demoOnly?: boolean }) => {
    const params = new URLSearchParams()
    if (opts?.archivedOnly) params.set('archived_only', 'true')
    if (opts?.demoOnly) params.set('demo_only', 'true')
    const qs = params.toString() ? `?${params}` : ''
    return api.get<AdminClient[]>(`/admin/clients${qs}`)
  },

  moveClientFromDemo: (clientId: number) =>
    api.post<{ moved: number; name: string }>(`/admin/clients/${clientId}/move-from-demo`, {}),

  hardDeleteClient: (clientId: number) =>
    api.delete<{ deleted: number; name: string }>(`/admin/clients/${clientId}`),

  moveClientToDemo: (clientId: number) =>
    api.post<{ moved: number; name: string }>(`/admin/clients/${clientId}/move-to-demo`, {}),

  demoStatus: () => api.get<DemoStatus>('/admin/demo/status'),

  demoEnter: () => api.post<User>('/admin/demo/enter', {}),

  demoExit: () => api.post<User>('/admin/demo/exit', {}),

  demoReset: () => api.post<DemoResetResult>('/admin/demo/reset', {}),
}
