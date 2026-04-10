import { useState, useEffect, useCallback } from 'react'
import { classService } from '../services/class.service'
import { clientService } from '../services/client.service'
import type { ClassSession, Client } from '../types'

interface UseClassesFilters {
  filterMonth: number
  filterYear: number
  filterClient: number | ''
}

export function useClasses({ filterMonth, filterYear, filterClient }: UseClassesFilters) {
  const [classes, setClasses] = useState<ClassSession[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null)

  const loadClasses = useCallback(async () => {
    setIsLoading(true)
    const data = await classService.getAll({
      month: filterMonth,
      year: filterYear,
      client_id: filterClient || undefined,
    })
    setClasses(data)
    setIsLoading(false)
  }, [filterMonth, filterYear, filterClient])

  useEffect(() => {
    clientService.getAll().then(setClients)
  }, [])

  useEffect(() => {
    loadClasses()
  }, [loadClasses])

  const createClass = async (data: Partial<ClassSession>) => {
    await classService.create(data as Parameters<typeof classService.create>[0])
    loadClasses()
  }

  const updateClass = async (id: number, data: Partial<ClassSession>) => {
    await classService.update(id, data)
    loadClasses()
  }

  const requestDelete = (id: number) => setPendingDeleteId(id)

  const confirmDelete = async () => {
    if (!pendingDeleteId) return
    await classService.delete(pendingDeleteId)
    setPendingDeleteId(null)
    loadClasses()
  }

  const cancelDelete = () => setPendingDeleteId(null)

  const syncGCal = async (userId: number) => {
    setIsSyncing(true)
    setSyncMsg(null)
    try {
      const result = await classService.syncGCal(userId)
      setSyncMsg(`${result.scheduled} clases encoladas`)
      setTimeout(() => setSyncMsg(null), 4000)
    } catch {
      setSyncMsg('Error al sincronizar')
    } finally {
      setIsSyncing(false)
    }
  }

  const totalRevenue = classes.reduce((sum, c) => sum + (c.total_amount ?? 0), 0)

  return {
    classes,
    clients,
    isLoading,
    isSyncing,
    syncMsg,
    pendingDeleteId,
    totalRevenue,
    loadClasses,
    createClass,
    updateClass,
    requestDelete,
    confirmDelete,
    cancelDelete,
    syncGCal,
  }
}
