import type { AdminClient, User } from '../types'
import { api } from './api'
import { ENDPOINTS } from './endpoints'
import { buildQuery } from './query'

interface AdminUser {
  id: number
  email: string
  role: 'admin' | 'user'
  createdAt: string
}

interface DemoResetResult {
  clientsCount: number
  classesCount: number
  reseedAt: string
}

interface DemoStatus {
  demoUserId: number
}

export const adminService = {
  listUsers: () => api.get<AdminUser[]>(ENDPOINTS.admin.users),

  setUserRole: (userId: number, role: 'admin' | 'user') =>
    api.put<AdminUser>(
      `${ENDPOINTS.admin.userRole(userId)}${buildQuery({ role })}`,
      {},
    ),

  deleteUser: (userId: number) => api.delete(ENDPOINTS.admin.userById(userId)),

  syncGCal: (userId: number) =>
    api.post<{ scheduled: number }>(ENDPOINTS.admin.userSyncGCal(userId), {}),

  listClients: (opts?: { archivedOnly?: boolean; demoOnly?: boolean }) => {
    const params: Record<string, string | undefined> = {}
    if (opts?.archivedOnly) params.archived_only = 'true'
    if (opts?.demoOnly) params.demo_only = 'true'
    return api.get<AdminClient[]>(
      `${ENDPOINTS.admin.clients}${buildQuery(params)}`,
    )
  },

  moveClientFromDemo: (clientId: number) =>
    api.post<{ moved: number; name: string }>(
      ENDPOINTS.admin.clientMoveFromDemo(clientId),
      {},
    ),

  hardDeleteClient: (clientId: number) =>
    api.delete<{ deleted: number; name: string }>(ENDPOINTS.admin.clientById(clientId)),

  moveClientToDemo: (clientId: number) =>
    api.post<{ moved: number; name: string }>(
      ENDPOINTS.admin.clientMoveToDemo(clientId),
      {},
    ),

  /** Admin-only hard delete for invoices (dev/cleanup tool). */
  deleteInvoice: (invoiceId: number) =>
    api.delete(ENDPOINTS.invoices.byId(invoiceId)),

  demoStatus: () => api.get<DemoStatus>(ENDPOINTS.admin.demoStatus),

  demoEnter: () => api.post<User>(ENDPOINTS.admin.demoEnter, {}),

  demoExit: () => api.post<User>(ENDPOINTS.admin.demoExit, {}),

  demoReset: () => api.post<DemoResetResult>(ENDPOINTS.admin.demoReset, {}),
}
