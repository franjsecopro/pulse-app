import { useCallback, useEffect, useState } from 'react'
import { useToast } from '../context/ToastContext'
import { clientService } from '../services/client.service'
import type { Client, Contract, PaymentIdentifier } from '../types'

type FilterActive = 'all' | 'active' | 'archived'

export function useClients(search: string, filterActive: FilterActive) {
  const { addToast } = useToast()

  const [clients, setClients] = useState<Client[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const loadClients = useCallback(async () => {
    setIsLoading(true)
    try {
      let is_active: boolean | undefined
      let deleted_filter: 'exclude' | 'include' | 'only'

      if (filterActive === 'active') {
        is_active = true
        deleted_filter = 'exclude'
      } else if (filterActive === 'archived') {
        is_active = undefined
        deleted_filter = 'only'
      } else {
        is_active = undefined
        deleted_filter = 'include'
      }

      const data = await clientService.getAll({
        search: search || undefined,
        is_active,
        deleted_filter,
      })
      setClients(data.sort((a, b) => Number(b.is_active) - Number(a.is_active)))
    } finally {
      setIsLoading(false)
    }
  }, [search, filterActive])

  useEffect(() => {
    loadClients()
  }, [loadClients])

  const createClient = async (
    data: Omit<Client, 'id' | 'created_at' | 'updated_at' | 'archived_at' | 'contracts'>,
  ) => {
    try {
      await clientService.create(data)
      addToast('toasts.clientCreated', 'success')
      loadClients()
    } catch {
      addToast('toasts.clientCreateError', 'error')
    }
  }

  const updateClient = async (id: number, data: Partial<Client>) => {
    try {
      await clientService.update(id, data)
      addToast('toasts.clientUpdated', 'success')
      loadClients()
    } catch {
      addToast('toasts.clientUpdateError', 'error')
    }
  }

  const archiveClient = async (id: number) => {
    try {
      await clientService.archive(id)
      addToast('toasts.clientArchived', 'success')
      loadClients()
    } catch {
      addToast('toasts.clientArchiveError', 'error')
    }
  }

  const activateClient = async (id: number) => {
    try {
      await clientService.activate(id)
      addToast('toasts.clientActivated', 'success')
      loadClients()
    } catch {
      addToast('toasts.clientActivateError', 'error')
    }
  }

  const hardDeleteClient = async (id: number) => {
    try {
      await clientService.hardDelete(id)
      addToast('toasts.clientHardDeleted', 'success')
      loadClients()
    } catch {
      addToast('toasts.clientHardDeleteError', 'error')
    }
  }

  const updateClientContracts = (clientId: number, contracts: Contract[]) => {
    setClients((prev) => prev.map((c) => (c.id === clientId ? { ...c, contracts } : c)))
  }

  const updateClientPayers = (clientId: number, payers: PaymentIdentifier[]) => {
    setClients((prev) => prev.map((c) => (c.id === clientId ? { ...c, payers } : c)))
  }

  return {
    clients,
    isLoading,
    loadClients,
    createClient,
    updateClient,
    archiveClient,
    activateClient,
    hardDeleteClient,
    updateClientContracts,
    updateClientPayers,
  }
}
