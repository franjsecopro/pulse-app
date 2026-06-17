import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useToast } from '../context/ToastContext'
import { queryKeys } from '../lib/queryKeys'
import { clientService } from '../services/client.service'
import { invoiceService } from '../services/invoice.service'

const PAGE_LIMIT = 100

interface UseInvoicesFilters {
  filterClient: number | ''
  filterStatus: string
  filterMonth: number | ''
  filterYear: number
}

const DEFAULT_FILTERS: UseInvoicesFilters = {
  filterClient: '',
  filterStatus: '',
  filterMonth: '',
  filterYear: new Date().getFullYear(),
}

export function useInvoices(filters: UseInvoicesFilters = DEFAULT_FILTERS) {
  const { addToast } = useToast()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)

  const { filterClient, filterStatus, filterMonth, filterYear } = filters
  const serviceFilters = {
    clientId: filterClient || undefined,
    status: filterStatus || undefined,
    month: filterMonth || undefined,
    // Year is an independent filter here (the page always shows the year selector).
    year: filterYear || undefined,
  }

  // A filter change lands the user back on page 1.
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on raw filters
  useEffect(() => {
    setPage(1)
  }, [filterClient, filterStatus, filterMonth, filterYear])

  const listQuery = useQuery({
    queryKey: queryKeys.invoices.list({ ...serviceFilters, page }),
    queryFn: () =>
      invoiceService.getAll({
        ...serviceFilters,
        limit: PAGE_LIMIT,
        offset: (page - 1) * PAGE_LIMIT,
      }),
  })

  const clientsQuery = useQuery({
    queryKey: queryKeys.clients.dropdown,
    queryFn: () => clientService.getAll(),
  })

  const invalidateInvoices = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all })

  const createFromPeriodMutation = useMutation({
    mutationFn: invoiceService.createFromPeriod,
    onSuccess: (invoice) => {
      // The period may have had no billable classes (e.g. all cancelled) — be explicit.
      if (invoice.lines.length === 0) addToast('toasts.invoiceEmpty', 'info')
      else addToast('toasts.invoiceCreated', 'success')
      invalidateInvoices()
    },
    onError: (error) => addToast('toasts.invoiceCreateError', 'error', undefined, error.message),
  })

  const issueMutation = useMutation({
    mutationFn: (id: number) => invoiceService.issue(id),
    onSuccess: () => {
      addToast('toasts.invoiceIssued', 'success')
      invalidateInvoices()
    },
    onError: (error) => addToast('toasts.invoiceIssueError', 'error', undefined, error.message),
  })

  const sendMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { email?: string; phone?: string } }) =>
      invoiceService.send(id, data),
    onSuccess: () => addToast('toasts.invoiceSent', 'success'),
    onError: (error) => addToast('toasts.invoiceSendError', 'error', undefined, error.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => invoiceService.delete(id),
    onSuccess: () => {
      addToast('toasts.invoiceDeleted', 'success')
      invalidateInvoices()
    },
    onError: (error) => addToast('toasts.invoiceDeleteError', 'error', undefined, error.message),
  })

  const swallow = () => undefined

  const createFromPeriod = (data: {
    clientId: number
    month?: number
    year?: number
    endMonth?: number
    endYear?: number
    periodStart?: string
    periodEnd?: string
  }) => createFromPeriodMutation.mutateAsync(data).then(swallow, swallow)

  const issueInvoice = (id: number) => issueMutation.mutateAsync(id).then(swallow, swallow)

  const deleteInvoice = (id: number) => deleteMutation.mutateAsync(id).then(swallow, swallow)

  // Returns the result (shareUrl / whatsappUrl) so the page can surface the links.
  const sendInvoice = (id: number, data: { email?: string; phone?: string }) =>
    sendMutation.mutateAsync({ id, data })

  const invoices = listQuery.data?.data ?? []
  const totalCount = listQuery.data?.total ?? 0
  const pageCount = Math.ceil(totalCount / PAGE_LIMIT)

  return {
    invoices,
    clients: clientsQuery.data ?? [],
    isLoading: listQuery.isLoading,
    totalCount,
    page,
    pageCount,
    goToPage: setPage,
    createFromPeriod,
    issueInvoice,
    sendInvoice,
    deleteInvoice,
    isCreating: createFromPeriodMutation.isPending,
    isIssuing: issueMutation.isPending,
    isSending: sendMutation.isPending,
    isDeleting: deleteMutation.isPending,
  }
}
