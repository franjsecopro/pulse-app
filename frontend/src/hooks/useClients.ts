import { useState, useEffect, useCallback } from 'react'
import { clientService } from '../services/client.service'
import type { Client, Contract, PaymentIdentifier } from '../types'

type FilterActive = 'all' | 'active' | 'archived'

export function useClients(search: string, filterActive: FilterActive) {
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

  const createClient = async (data: Omit<Client, 'id' | 'created_at' | 'updated_at' | 'archived_at' | 'contracts'>) => {
    await clientService.create(data)
    loadClients()
  }

  const updateClient = async (id: number, data: Partial<Client>) => {
    await clientService.update(id, data)
    loadClients()
  }

  const archiveClient = async (id: number) => {
    await clientService.archive(id)
    loadClients()
  }

  const activateClient = async (id: number) => {
    await clientService.activate(id)
    loadClients()
  }

  const hardDeleteClient = async (id: number) => {
    await clientService.hardDelete(id)
    loadClients()
  }

  const updateClientContracts = (clientId: number, contracts: Contract[]) => {
    setClients(prev => prev.map(c => c.id === clientId ? { ...c, contracts } : c))
  }

  const updateClientPayers = (clientId: number, payers: PaymentIdentifier[]) => {
    setClients(prev => prev.map(c => c.id === clientId ? { ...c, payers } : c))
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
