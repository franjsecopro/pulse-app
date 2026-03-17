import { api } from './api'
import type { Client, Contract, PaymentIdentifier } from '../types'

export const clientService = {
  getAll: (params?: { search?: string; is_active?: boolean; deleted_filter?: 'exclude' | 'include' | 'only' }) => {
    const query = new URLSearchParams()
    if (params?.search) query.set('search', params.search)
    if (params?.is_active !== undefined) query.set('is_active', String(params.is_active))
    if (params?.deleted_filter) query.set('deleted_filter', params.deleted_filter)
    const qs = query.toString()
    return api.get<Client[]>(`/clients${qs ? `?${qs}` : ''}`)
  },

  getById: (id: number, allowDeleted: boolean = false) => {
    const query = allowDeleted ? '?allow_deleted=true' : ''
    return api.get<Client>(`/clients/${id}${query}`)
  },

  create: (data: Omit<Client, 'id' | 'created_at' | 'updated_at' | 'deleted_at' | 'contracts'>) =>
    api.post<Client>('/clients', data),

  update: (id: number, data: Partial<Client>) =>
    api.put<Client>(`/clients/${id}`, data),

  delete: (id: number) => api.delete(`/clients/${id}`),

  getContracts: (clientId: number) =>
    api.get<Contract[]>(`/clients/${clientId}/contracts`),

  createContract: (clientId: number, data: Omit<Contract, 'id' | 'client_id' | 'created_at'>) =>
    api.post<Contract>(`/clients/${clientId}/contracts`, data),

  updateContract: (clientId: number, contractId: number, data: Partial<Contract>) =>
    api.put<Contract>(`/clients/${clientId}/contracts/${contractId}`, data),

  deleteContract: (clientId: number, contractId: number) =>
    api.delete(`/clients/${clientId}/contracts/${contractId}`),

  getPayers: (clientId: number) =>
    api.get<PaymentIdentifier[]>(`/clients/${clientId}/payers`),

  createPayer: (clientId: number, data: { name: string; info?: string | null }) =>
    api.post<PaymentIdentifier>(`/clients/${clientId}/payers`, data),

  updatePayer: (clientId: number, payerId: number, data: { name?: string; info?: string | null }) =>
    api.put<PaymentIdentifier>(`/clients/${clientId}/payers/${payerId}`, data),

  deletePayer: (clientId: number, payerId: number) =>
    api.delete(`/clients/${clientId}/payers/${payerId}`),
}
