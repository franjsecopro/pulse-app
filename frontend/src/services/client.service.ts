import { api } from './api'
import type { Client, Contract } from '../types'

export const clientService = {
  getAll: (params?: { search?: string; is_active?: boolean }) => {
    const query = new URLSearchParams()
    if (params?.search) query.set('search', params.search)
    if (params?.is_active !== undefined) query.set('is_active', String(params.is_active))
    const qs = query.toString()
    return api.get<Client[]>(`/clients${qs ? `?${qs}` : ''}`)
  },

  getById: (id: number) => api.get<Client>(`/clients/${id}`),

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
}
