import { useEffect, useState } from 'react'
import {
  getClassesAllQueryKeys,
  getClassesListQueryKeys,
  getClassesStatsQueryKeys,
} from '../API/queryKeys/classes/classesQueryKeys'
import { getClientsDropdownQueryKeys } from '../API/queryKeys/clients/clientsQueryKeys'
import { useToast } from '../context/ToastContext'
import { classService } from '../services/class.service'
import { clientService } from '../services/client.service'
import type { ClassSession, ClassStats } from '../types'
import { useMutationRequest, useQueryClient, useQueryRequest } from './reactQuery'

const PAGE_LIMIT = 100

interface UseClassesFilters {
  filterMonth: number
  filterYear: number
  filterClient: number | ''
}

export function useClasses({ filterMonth, filterYear, filterClient }: UseClassesFilters) {
  const { addToast } = useToast()
  const queryClient = useQueryClient()

  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null)
  const [page, setPage] = useState(1)

  const filters = {
    month: filterMonth,
    year: filterYear,
    clientId: filterClient || undefined,
  }

  // Changing a filter must land the user back on page 1 (old loadClasses(1) behavior).
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally keyed on raw filters
  useEffect(() => {
    setPage(1)
  }, [filterMonth, filterYear, filterClient])

  const listQuery = useQueryRequest({
    queryKey: getClassesListQueryKeys({ ...filters, page }),
    queryFn: () =>
      classService.getAll({
        ...filters,
        limit: PAGE_LIMIT,
        offset: (page - 1) * PAGE_LIMIT,
      }),
  })

  const statsQuery = useQueryRequest({
    queryKey: getClassesStatsQueryKeys(filters),
    queryFn: () => classService.getStats(filters),
  })

  const clientsQuery = useQueryRequest({
    queryKey: getClientsDropdownQueryKeys(),
    queryFn: () => clientService.getAll(),
  })

  const invalidateClasses = () =>
    queryClient.invalidateQueries({ queryKey: getClassesAllQueryKeys() })

  const createMutation = useMutationRequest({
    mutationFn: (data: Partial<ClassSession>) =>
      classService.create(data as Parameters<typeof classService.create>[0]),
    onSuccess: () => {
      addToast('toasts.classCreated', 'success')
      invalidateClasses()
    },
    onError: (error) => addToast('toasts.classCreateError', 'error', undefined, error.message),
  })

  const updateMutation = useMutationRequest({
    mutationFn: ({ id, data }: { id: number; data: Partial<ClassSession> }) =>
      classService.update(id, data),
    onSuccess: () => {
      addToast('toasts.classUpdated', 'success')
      invalidateClasses()
    },
    onError: (error) => addToast('toasts.classUpdateError', 'error', undefined, error.message),
  })

  const deleteMutation = useMutationRequest({
    mutationFn: (id: number) => classService.delete(id),
    onSuccess: () => addToast('toasts.classDeleted', 'success'),
    onError: (error) => addToast('toasts.classDeleteError', 'error', undefined, error.message),
    // Old behavior reloaded in `finally` — even a failed delete refreshes the list.
    onSettled: () => {
      setPendingDeleteId(null)
      invalidateClasses()
    },
  })

  const syncMutation = useMutationRequest({
    mutationFn: () => classService.syncGCal(),
    onSuccess: (result) => addToast('toasts.gcalSynced', 'success', result.scheduled),
    onError: (error) => addToast('toasts.gcalSyncError', 'error', undefined, error.message),
  })

  const retrySyncMutation = useMutationRequest({
    mutationFn: (id: number) => classService.syncCalendar(id),
    // The sync runs as a background task (202) — the badge updates on the next refetch.
    onSuccess: () => {
      addToast('toasts.gcalRetryScheduled', 'info')
      invalidateClasses()
    },
    onError: (error) => addToast('toasts.gcalSyncError', 'error', undefined, error.message),
  })

  const swallow = () => undefined

  const createClass = (data: Partial<ClassSession>) =>
    createMutation.mutateAsync(data).then(swallow, swallow)

  const updateClass = (id: number, data: Partial<ClassSession>) =>
    updateMutation.mutateAsync({ id, data }).then(swallow, swallow)

  const requestDelete = (id: number) => setPendingDeleteId(id)
  const cancelDelete = () => setPendingDeleteId(null)

  const confirmDelete = async () => {
    if (!pendingDeleteId) return
    await deleteMutation.mutateAsync(pendingDeleteId).then(swallow, swallow)
  }

  const syncGCal = () => syncMutation.mutateAsync().then(swallow, swallow)

  const retrySync = (id: number) => retrySyncMutation.mutateAsync(id).then(swallow, swallow)

  const totalCount = listQuery.data?.total ?? 0
  const pageCount = Math.ceil(totalCount / PAGE_LIMIT)

  return {
    classes: listQuery.data?.data ?? [],
    clients: clientsQuery.data ?? [],
    isLoading: listQuery.isLoading,
    isSyncing: syncMutation.isPending,
    pendingDeleteId,
    classStats: statsQuery.data ?? ({ count: 0, totalRevenue: 0 } satisfies ClassStats),
    page,
    pageCount,
    totalCount,
    loadClasses: invalidateClasses,
    goToPage: setPage,
    createClass,
    updateClass,
    requestDelete,
    confirmDelete,
    cancelDelete,
    syncGCal,
    retrySync,
  }
}
