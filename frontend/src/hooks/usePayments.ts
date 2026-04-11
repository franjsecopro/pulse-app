import { useState, useEffect, useCallback } from 'react'
import { paymentService } from '../services/payment.service'
import { clientService } from '../services/client.service'
import { accountingService } from '../services/accounting.service'
import { useToast } from '../context/ToastContext'
import type { Payment, Client, PDFImportRecord } from '../types'

const PAGE_LIMIT = 100

interface UsePaymentsFilters {
  filterMonth: number | ''
  filterYear: number
  filterClient: number | ''
  filterStatus: string
}

export function usePayments({ filterMonth, filterYear, filterClient, filterStatus }: UsePaymentsFilters) {
  const { addToast } = useToast()

  const [payments, setPayments] = useState<Payment[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [pdfHistory, setPdfHistory] = useState<PDFImportRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isPdfHistoryLoading, setIsPdfHistoryLoading] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null)
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  const loadPayments = useCallback(async (targetPage = 1) => {
    setIsLoading(true)
    const { data, total } = await paymentService.getAll({
      month: filterMonth || undefined,
      year: filterMonth ? filterYear : undefined,
      client_id: filterClient || undefined,
      status: filterStatus || undefined,
      limit: PAGE_LIMIT,
      offset: (targetPage - 1) * PAGE_LIMIT,
    })
    setPayments(data)
    setTotalCount(total)
    setPage(targetPage)
    setIsLoading(false)
  }, [filterMonth, filterYear, filterClient, filterStatus])

  useEffect(() => {
    clientService.getAll().then(setClients)
  }, [])

  useEffect(() => {
    loadPayments(1)
  }, [loadPayments])

  const goToPage = (n: number) => loadPayments(n)

  const loadPdfHistory = useCallback(() => {
    setIsPdfHistoryLoading(true)
    accountingService.getPdfHistory()
      .then(setPdfHistory)
      .finally(() => setIsPdfHistoryLoading(false))
  }, [])

  const createPayment = async (data: Parameters<typeof paymentService.create>[0]) => {
    try {
      await paymentService.create(data)
      addToast('Pago registrado correctamente', 'success')
      loadPayments(page)
    } catch {
      addToast('Error al registrar el pago', 'error')
    }
  }

  const updatePayment = async (id: number, data: Partial<Payment>) => {
    try {
      await paymentService.update(id, data)
      addToast('Pago actualizado', 'success')
      loadPayments(page)
    } catch {
      addToast('Error al actualizar el pago', 'error')
    }
  }

  const requestDelete = (id: number) => setPendingDeleteId(id)
  const cancelDelete = () => setPendingDeleteId(null)

  const confirmDelete = async () => {
    if (!pendingDeleteId) return
    try {
      await paymentService.delete(pendingDeleteId)
      addToast('Pago eliminado', 'success')
    } catch {
      addToast('Error al eliminar el pago', 'error')
    } finally {
      setPendingDeleteId(null)
      loadPayments(page)
    }
  }

  const handleImported = () => {
    addToast('Extracto importado correctamente', 'success')
    loadPayments(1)
    setPdfHistory([])
  }

  const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0)
  const pageCount = Math.ceil(totalCount / PAGE_LIMIT)

  return {
    payments,
    clients,
    pdfHistory,
    isLoading,
    isPdfHistoryLoading,
    totalAmount,
    pendingDeleteId,
    page,
    pageCount,
    totalCount,
    loadPayments,
    goToPage,
    loadPdfHistory,
    createPayment,
    updatePayment,
    requestDelete,
    confirmDelete,
    cancelDelete,
    handleImported,
  }
}
