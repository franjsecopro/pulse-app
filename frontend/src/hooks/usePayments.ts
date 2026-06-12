import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useState } from 'react'
import { useToast } from '../context/ToastContext'
import { queryKeys } from '../lib/queryKeys'
import { accountingService } from '../services/accounting.service'
import { clientService } from '../services/client.service'
import { paymentService } from '../services/payment.service'
import type { Payment } from '../types'

const PAGE_LIMIT = 100

interface UsePaymentsFilters {
  filterMonth: number | ''
  filterYear: number
  filterClient: number | ''
  filterStatus: string
}

export function usePayments({
  filterMonth,
  filterYear,
  filterClient,
  filterStatus,
}: UsePaymentsFilters) {
  const { addToast } = useToast()
  const queryClient = useQueryClient()

  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null)
  const [page, setPage] = useState(1)

  const filters = {
    month: filterMonth || undefined,
    year: filterMonth ? filterYear : undefined,
    clientId: filterClient || undefined,
    status: filterStatus || undefined,
  }

  // Changing a filter must land the user back on page 1 (old loadPayments(1) behavior).
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally keyed on raw filters
  useEffect(() => {
    setPage(1)
  }, [filterMonth, filterYear, filterClient, filterStatus])

  const listQuery = useQuery({
    queryKey: queryKeys.payments.list({ ...filters, page }),
    queryFn: () =>
      paymentService.getAll({
        ...filters,
        limit: PAGE_LIMIT,
        offset: (page - 1) * PAGE_LIMIT,
      }),
  })

  const clientsQuery = useQuery({
    queryKey: queryKeys.clients.dropdown,
    queryFn: () => clientService.getAll(),
  })

  // Lazy query: only fetched when the user opens the history tab (loadStatementHistory).
  const historyQuery = useQuery({
    queryKey: queryKeys.payments.statementHistory,
    queryFn: () => accountingService.getStatementHistory(),
    enabled: false,
  })

  const invalidatePayments = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.payments.all })

  // Referentially stable — Payments.tsx puts this in a useEffect dependency array.
  const refetchHistory = historyQuery.refetch
  const loadStatementHistory = useCallback(() => {
    refetchHistory()
  }, [refetchHistory])

  const createMutation = useMutation({
    mutationFn: paymentService.create,
    onSuccess: () => {
      addToast('toasts.paymentCreated', 'success')
      invalidatePayments()
    },
    onError: (error) => addToast('toasts.paymentCreateError', 'error', undefined, error.message),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Payment> }) =>
      paymentService.update(id, data),
    onSuccess: () => {
      addToast('toasts.paymentUpdated', 'success')
      invalidatePayments()
    },
    onError: (error) => addToast('toasts.paymentUpdateError', 'error', undefined, error.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => paymentService.delete(id),
    onSuccess: () => addToast('toasts.paymentDeleted', 'success'),
    onError: (error) => addToast('toasts.paymentDeleteError', 'error', undefined, error.message),
    // Old behavior reloaded in `finally` — even a failed delete refreshes the list.
    onSettled: () => {
      setPendingDeleteId(null)
      invalidatePayments()
    },
  })

  const deleteStatementMutation = useMutation({
    mutationFn: (id: number) => accountingService.deleteStatementImport(id),
    onSuccess: ({ paymentsDeleted }) => {
      addToast('toasts.statementDeleted', 'success', paymentsDeleted)
      refetchHistory()
      invalidatePayments()
    },
    onError: (error) => addToast('toasts.statementDeleteError', 'error', undefined, error.message),
  })

  const swallow = () => undefined

  const createPayment = (data: Parameters<typeof paymentService.create>[0]) =>
    createMutation.mutateAsync(data).then(swallow, swallow)

  const updatePayment = (id: number, data: Partial<Payment>) =>
    updateMutation.mutateAsync({ id, data }).then(swallow, swallow)

  const requestDelete = (id: number) => setPendingDeleteId(id)
  const cancelDelete = () => setPendingDeleteId(null)

  const confirmDelete = async () => {
    if (!pendingDeleteId) return
    await deleteMutation.mutateAsync(pendingDeleteId).then(swallow, swallow)
  }

  const deleteStatementImport = (id: number) =>
    deleteStatementMutation.mutateAsync(id).then(swallow, swallow)

  const handleImported = () => {
    addToast('toasts.statementImported', 'success')
    setPage(1)
    invalidatePayments()
    // Drop cached history so the tab refetches fresh data next time it opens.
    queryClient.removeQueries({ queryKey: queryKeys.payments.statementHistory })
  }

  const payments = listQuery.data?.data ?? []
  const totalCount = listQuery.data?.total ?? 0
  const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0)
  const pageCount = Math.ceil(totalCount / PAGE_LIMIT)

  return {
    payments,
    clients: clientsQuery.data ?? [],
    statementHistory: historyQuery.data ?? [],
    isLoading: listQuery.isLoading,
    isStatementHistoryLoading: historyQuery.isFetching,
    totalAmount,
    pendingDeleteId,
    page,
    pageCount,
    totalCount,
    loadPayments: invalidatePayments,
    goToPage: setPage,
    loadStatementHistory,
    createPayment,
    updatePayment,
    requestDelete,
    confirmDelete,
    cancelDelete,
    handleImported,
    deleteStatementImport,
  }
}
