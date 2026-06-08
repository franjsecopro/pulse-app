import type { Client, Contract, PaymentIdentifier } from '../types'
import { api } from './api'

export const clientService = {
  getAll: (params?: {
    search?: string
    isActive?: boolean
    deletedFilter?: 'exclude' | 'include' | 'only'
  }) => {
    const query = new URLSearchParams()
    if (params?.search) query.set('search', params.search)
    if (params?.isActive !== undefined) query.set('isActive', String(params.isActive))
    if (params?.deletedFilter) query.set('deletedFilter', params.deletedFilter)
    const qs = query.toString()
    return api.get<Client[]>(`/clients${qs ? `?${qs}` : ''}`)
  },

  getById: (id: number, allowDeleted: boolean = false) => {
    const query = allowDeleted ? '?allow_deleted=true' : ''
    return api.get<Client>(`/clients/${id}${query}`)
  },

  create: (data: Omit<Client, 'id' | 'createdAt' | 'updatedAt' | 'archivedAt' | 'contracts'>) =>
    api.post<Client>('/clients', data),

  update: (id: number, data: Partial<Client>) => api.put<Client>(`/clients/${id}`, data),

  archive: (id: number) => api.post(`/clients/${id}/archive`, {}),

  activate: (id: number) => api.post(`/clients/${id}/activate`, {}),

  getContracts: (clientId: number) => api.get<Contract[]>(`/clients/${clientId}/contracts`),

  createContract: (clientId: number, data: Omit<Contract, 'id' | 'clientId' | 'createdAt'>) =>
    api.post<Contract>(`/clients/${clientId}/contracts`, data),

  updateContract: (clientId: number, contractId: number, data: Partial<Contract>) =>
    api.put<Contract>(`/clients/${clientId}/contracts/${contractId}`, data),

  deleteContract: (clientId: number, contractId: number) =>
    api.delete(`/clients/${clientId}/contracts/${contractId}`),

  generateContractClasses: (clientId: number, contractId: number) =>
    api.post<{ created: number }>(
      `/clients/${clientId}/contracts/${contractId}/generate-classes`,
      {},
    ),

  deleteFutureContractClasses: (clientId: number, contractId: number) =>
    api.delete<{ deleted: number }>(`/clients/${clientId}/contracts/${contractId}/future-classes`),

  getPayers: (clientId: number) => api.get<PaymentIdentifier[]>(`/clients/${clientId}/payers`),

  createPayer: (clientId: number, data: { name: string; info?: string | null }) =>
    api.post<PaymentIdentifier>(`/clients/${clientId}/payers`, data),

  updatePayer: (clientId: number, payerId: number, data: { name?: string; info?: string | null }) =>
    api.put<PaymentIdentifier>(`/clients/${clientId}/payers/${payerId}`, data),

  deletePayer: (clientId: number, payerId: number) =>
    api.delete(`/clients/${clientId}/payers/${payerId}`),

  hardDelete: (id: number) => api.delete(`/admin/clients/${id}`),
}
