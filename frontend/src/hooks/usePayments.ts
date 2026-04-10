import { useState, useEffect, useCallback } from 'react'
import { paymentService } from '../services/payment.service'
import { clientService } from '../services/client.service'
import { accountingService } from '../services/accounting.service'
import type { Payment, Client, PDFImportRecord } from '../types'

interface UsePaymentsFilters {
  filterMonth: number | ''
  filterYear: number
  filterClient: number | ''
  filterStatus: string
}

export function usePayments({ filterMonth, filterYear, filterClient, filterStatus }: UsePaymentsFilters) {
  const [payments, setPayments] = useState<Payment[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [pdfHistory, setPdfHistory] = useState<PDFImportRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isPdfHistoryLoading, setIsPdfHistoryLoading] = useState(false)

  const loadPayments = useCallback(async () => {
    setIsLoading(true)
    const data = await paymentService.getAll({
      month: filterMonth || undefined,
      year: filterMonth ? filterYear : undefined,
      client_id: filterClient || undefined,
      status: filterStatus || undefined,
    })
    setPayments(data)
    setIsLoading(false)
  }, [filterMonth, filterYear, filterClient, filterStatus])

  useEffect(() => {
    clientService.getAll().then(setClients)
  }, [])

  useEffect(() => {
    loadPayments()
  }, [loadPayments])

  const loadPdfHistory = useCallback(() => {
    setIsPdfHistoryLoading(true)
    accountingService.getPdfHistory()
      .then(setPdfHistory)
      .finally(() => setIsPdfHistoryLoading(false))
  }, [])

  const createPayment = async (data: Parameters<typeof paymentService.create>[0]) => {
    await paymentService.create(data)
    loadPayments()
  }

  const updatePayment = async (id: number, data: Partial<Payment>) => {
    await paymentService.update(id, data)
    loadPayments()
  }

  const deletePayment = async (id: number) => {
    if (!confirm('¿Eliminar este pago?')) return
    await paymentService.delete(id)
    loadPayments()
  }

  const handleImported = () => {
    loadPayments()
    setPdfHistory([])
  }

  const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0)

  return {
    payments,
    clients,
    pdfHistory,
    isLoading,
    isPdfHistoryLoading,
    totalAmount,
    loadPayments,
    loadPdfHistory,
    createPayment,
    updatePayment,
    deletePayment,
    handleImported,
  }
}
