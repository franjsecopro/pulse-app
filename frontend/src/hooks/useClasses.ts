import { useCallback, useEffect, useState } from 'react'
import { useToast } from '../context/ToastContext'
import { classService } from '../services/class.service'
import { clientService } from '../services/client.service'
import type { ClassSession, ClassStats, Client } from '../types'

const PAGE_LIMIT = 100

interface UseClassesFilters {
  filterMonth: number
  filterYear: number
  filterClient: number | ''
}

export function useClasses({ filterMonth, filterYear, filterClient }: UseClassesFilters) {
  const { addToast } = useToast()

  const [classes, setClasses] = useState<ClassSession[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null)
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [classStats, setClassStats] = useState<ClassStats>({ count: 0, totalRevenue: 0 })

  const loadClasses = useCallback(
    async (targetPage = 1) => {
      setIsLoading(true)
      const { data, total } = await classService.getAll({
        month: filterMonth,
        year: filterYear,
        clientId: filterClient || undefined,
        limit: PAGE_LIMIT,
        offset: (targetPage - 1) * PAGE_LIMIT,
      })
      setClasses(data)
      setTotalCount(total)
      setPage(targetPage)
      setIsLoading(false)
    },
    [filterMonth, filterYear, filterClient],
  )

  const loadClassStats = useCallback(async () => {
    const stats = await classService.getStats({
      month: filterMonth,
      year: filterYear,
      clientId: filterClient || undefined,
    })
    setClassStats(stats)
  }, [filterMonth, filterYear, filterClient])

  useEffect(() => {
    clientService.getAll().then(setClients)
  }, [])

  useEffect(() => {
    loadClasses(1)
    loadClassStats()
  }, [loadClasses, loadClassStats])

  const reloadAll = useCallback(
    async (targetPage: number = page) => {
      await loadClasses(targetPage)
      await loadClassStats()
    },
    [loadClasses, loadClassStats, page],
  )

  const goToPage = (n: number) => loadClasses(n)

  const createClass = async (data: Partial<ClassSession>) => {
    try {
      await classService.create(data as Parameters<typeof classService.create>[0])
      addToast('toasts.classCreated', 'success')
      reloadAll()
    } catch {
      addToast('toasts.classCreateError', 'error')
    }
  }

  const updateClass = async (id: number, data: Partial<ClassSession>) => {
    try {
      await classService.update(id, data)
      addToast('toasts.classUpdated', 'success')
      reloadAll()
    } catch {
      addToast('toasts.classUpdateError', 'error')
    }
  }

  const requestDelete = (id: number) => setPendingDeleteId(id)
  const cancelDelete = () => setPendingDeleteId(null)

  const confirmDelete = async () => {
    if (!pendingDeleteId) return
    try {
      await classService.delete(pendingDeleteId)
      addToast('toasts.classDeleted', 'success')
    } catch {
      addToast('toasts.classDeleteError', 'error')
    } finally {
      setPendingDeleteId(null)
      reloadAll()
    }
  }

  const syncGCal = async () => {
    setIsSyncing(true)
    try {
      const result = await classService.syncGCal()
      addToast('toasts.gcalSynced', 'success', result.scheduled)
    } catch {
      addToast('toasts.gcalSyncError', 'error')
    } finally {
      setIsSyncing(false)
    }
  }

  const pageCount = Math.ceil(totalCount / PAGE_LIMIT)

  return {
    classes,
    clients,
    isLoading,
    isSyncing,
    pendingDeleteId,
    classStats,
    page,
    pageCount,
    totalCount,
    loadClasses,
    goToPage,
    createClass,
    updateClass,
    requestDelete,
    confirmDelete,
    cancelDelete,
    syncGCal,
  }
}
