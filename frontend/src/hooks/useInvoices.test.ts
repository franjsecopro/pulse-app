/**
 * Tests for useInvoices hook.
 *
 * Key behaviors:
 *  - first page fetched with limit/offset
 *  - invoices + totalCount derived from the pageable response
 *  - goToPage shifts the offset
 *  - issueInvoice delegates to the service
 */
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createWrapper } from '../lib/test-utils'
import { clientService } from '../services/client.service'
import { invoiceService } from '../services/invoice.service'
import { useInvoices } from './useInvoices'

vi.mock('../context/ToastContext', () => ({
  useToast: () => ({ addToast: vi.fn() }),
}))

vi.mock('../services/invoice.service', () => ({
  invoiceService: {
    getAll: vi.fn(),
    createFromPeriod: vi.fn(),
    issue: vi.fn(),
    send: vi.fn(),
  },
}))

vi.mock('../services/client.service', () => ({
  clientService: { getAll: vi.fn() },
}))

const mockGetAll = vi.mocked(invoiceService.getAll)
const mockIssue = vi.mocked(invoiceService.issue)
const mockGetClients = vi.mocked(clientService.getAll)

const renderHookWithQuery: typeof renderHook = (cb) => renderHook(cb, { wrapper: createWrapper() })

beforeEach(() => {
  vi.clearAllMocks()
  mockGetAll.mockResolvedValue({ data: [], total: 0 })
  mockGetClients.mockResolvedValue([])
})

describe('useInvoices', () => {
  it('fetches the first page with limit/offset', async () => {
    renderHookWithQuery(() => useInvoices())

    await waitFor(() =>
      expect(mockGetAll).toHaveBeenCalledWith(expect.objectContaining({ limit: 100, offset: 0 })),
    )
  })

  it('exposes invoices and totalCount from the response', async () => {
    mockGetAll.mockResolvedValue({ data: [{ id: 1 }, { id: 2 }] as never, total: 5 })

    const { result } = renderHookWithQuery(() => useInvoices())

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.invoices).toHaveLength(2)
    expect(result.current.totalCount).toBe(5)
  })

  it('goToPage shifts the offset', async () => {
    const { result } = renderHookWithQuery(() => useInvoices())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => result.current.goToPage(2))

    await waitFor(() =>
      expect(mockGetAll).toHaveBeenCalledWith(expect.objectContaining({ offset: 100 })),
    )
  })

  it('issueInvoice delegates to the service', async () => {
    mockIssue.mockResolvedValue({ id: 1 } as never)
    const { result } = renderHookWithQuery(() => useInvoices())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.issueInvoice(1)
    })

    expect(mockIssue).toHaveBeenCalledWith(1)
  })
})
