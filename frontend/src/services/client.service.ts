import type { Client, Contract, PaymentIdentifier } from '../types'
import { api } from './api'
import { ENDPOINTS } from './endpoints'
import { buildQuery } from './query'

export const clientService = {
  getAll: (params?: {
    search?: string
    isActive?: boolean
    deletedFilter?: 'exclude' | 'include' | 'only'
  }) =>
    api.get<Client[]>(
      `${ENDPOINTS.clients.base}${buildQuery({
        search: params?.search,
        isActive: params?.isActive === undefined ? undefined : String(params.isActive),
        deletedFilter: params?.deletedFilter,
      })}`,
    ),

  getById: (id: number, allowDeleted: boolean = false) =>
    api.get<Client>(
      `${ENDPOINTS.clients.byId(id)}${buildQuery({ allow_deleted: allowDeleted ? 'true' : undefined })}`,
    ),

  create: (data: Omit<Client, 'id' | 'createdAt' | 'updatedAt' | 'archivedAt' | 'contracts'>) =>
    api.post<Client>(ENDPOINTS.clients.base, data),

  update: (id: number, data: Partial<Client>) =>
    api.put<Client>(ENDPOINTS.clients.byId(id), data),

  archive: (id: number) => api.post(ENDPOINTS.clients.archive(id), {}),

  activate: (id: number) => api.post(ENDPOINTS.clients.activate(id), {}),

  getContracts: (clientId: number) =>
    api.get<Contract[]>(ENDPOINTS.clients.contracts(clientId)),

  createContract: (clientId: number, data: Omit<Contract, 'id' | 'clientId' | 'createdAt'>) =>
    api.post<Contract>(ENDPOINTS.clients.contracts(clientId), data),

  updateContract: (clientId: number, contractId: number, data: Partial<Contract>) =>
    api.put<Contract>(ENDPOINTS.clients.contractById(clientId, contractId), data),

  deleteContract: (clientId: number, contractId: number) =>
    api.delete(ENDPOINTS.clients.contractById(clientId, contractId)),

  generateContractClasses: (clientId: number, contractId: number) =>
    api.post<{ created: number }>(ENDPOINTS.clients.generateClasses(clientId, contractId), {}),

  deleteFutureContractClasses: (clientId: number, contractId: number) =>
    api.delete<{ deleted: number }>(ENDPOINTS.clients.futureClasses(clientId, contractId)),

  getPayers: (clientId: number) =>
    api.get<PaymentIdentifier[]>(ENDPOINTS.clients.payers(clientId)),

  createPayer: (clientId: number, data: { name: string; info?: string | null }) =>
    api.post<PaymentIdentifier>(ENDPOINTS.clients.payers(clientId), data),

  updatePayer: (
    clientId: number,
    payerId: number,
    data: { name?: string; info?: string | null },
  ) => api.put<PaymentIdentifier>(ENDPOINTS.clients.payerById(clientId, payerId), data),

  deletePayer: (clientId: number, payerId: number) =>
    api.delete(ENDPOINTS.clients.payerById(clientId, payerId)),
}
