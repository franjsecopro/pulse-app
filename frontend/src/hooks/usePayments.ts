import { useCallback, useEffect, useState } from 'react'
import { useToast } from '../context/ToastContext'
import { accountingService } from '../services/accounting.service'
import { clientService } from '../services/client.service'
import { paymentService } from '../services/payment.service'
import type { Client, Payment, StatementImportRecord } from '../types'

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

  const [payments, setPayments] = useState<Payment[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [statementHistory, setStatementHistory] = useState<StatementImportRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isStatementHistoryLoading, setIsStatementHistoryLoading] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null)
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  const loadPayments = useCallback(
    async (targetPage = 1) => {
      setIsLoading(true)
      const { data, total } = await paymentService.getAll({
        month: filterMonth || undefined,
        year: filterMonth ? filterYear : undefined,
        clientId: filterClient || undefined,
        status: filterStatus || undefined,
        limit: PAGE_LIMIT,
        offset: (targetPage - 1) * PAGE_LIMIT,
      })
      setPayments(data)
      setTotalCount(total)
      setPage(targetPage)
      setIsLoading(false)
    },
    [filterMonth, filterYear, filterClient, filterStatus],
  )

  useEffect(() => {
    clientService.getAll().then(setClients)
  }, [])

  useEffect(() => {
    loadPayments(1)
  }, [loadPayments])

  const goToPage = (n: number) => loadPayments(n)

  const loadStatementHistory = useCallback(() => {
    setIsStatementHistoryLoading(true)
    accountingService
      .getStatementHistory()
      .then(setStatementHistory)
      .finally(() => setIsStatementHistoryLoading(false))
  }, [])

  const createPayment = async (data: Parameters<typeof paymentService.create>[0]) => {
    try {
      await paymentService.create(data)
      addToast('toasts.paymentCreated', 'success')
      loadPayments(page)
    } catch {
      addToast('toasts.paymentCreateError', 'error')
    }
  }

  const updatePayment = async (id: number, data: Partial<Payment>) => {
    try {
      await paymentService.update(id, data)
      addToast('toasts.paymentUpdated', 'success')
      loadPayments(page)
    } catch {
      addToast('toasts.paymentUpdateError', 'error')
    }
  }

  const requestDelete = (id: number) => setPendingDeleteId(id)
  const cancelDelete = () => setPendingDeleteId(null)

  const confirmDelete = async () => {
    if (!pendingDeleteId) return
    try {
      await paymentService.delete(pendingDeleteId)
      addToast('toasts.paymentDeleted', 'success')
    } catch {
      addToast('toasts.paymentDeleteError', 'error')
    } finally {
      setPendingDeleteId(null)
      loadPayments(page)
    }
  }

  const handleImported = () => {
    addToast('toasts.statementImported', 'success')
    loadPayments(1)
    setStatementHistory([])
  }

  const deleteStatementImport = async (id: number) => {
    try {
      const { payments_deleted } = await accountingService.deleteStatementImport(id)
      addToast('toasts.statementDeleted', 'success', payments_deleted)
      loadStatementHistory()
      loadPayments(page)
    } catch {
      addToast('toasts.statementDeleteError', 'error')
    }
  }

  const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0)
  const pageCount = Math.ceil(totalCount / PAGE_LIMIT)

  return {
    payments,
    clients,
    statementHistory,
    isLoading,
    isStatementHistoryLoading,
    totalAmount,
    pendingDeleteId,
    page,
    pageCount,
    totalCount,
    loadPayments,
    goToPage,
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
