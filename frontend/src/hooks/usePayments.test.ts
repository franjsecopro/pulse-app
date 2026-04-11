/**
 * Tests for usePayments hook.
 *
 * Key behaviors:
 *  - month/year coupling: year is only sent when filterMonth is set
 *  - status and client_id filters forwarded (or undefined when empty)
 *  - totalAmount sums all loaded payment amounts
 *  - requestDelete / cancelDelete / confirmDelete manage pendingDeleteId
 *    (same pattern as useClasses — no window.confirm)
 */
import { renderHook, waitFor, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { usePayments } from './usePayments'
import { paymentService } from '../services/payment.service'
import { clientService } from '../services/client.service'
import { accountingService } from '../services/accounting.service'

vi.mock('../context/ToastContext', () => ({
  useToast: () => ({ addToast: vi.fn() }),
}))

vi.mock('../services/payment.service', () => ({
  paymentService: {
    getAll:  vi.fn(),
    create:  vi.fn(),
    update:  vi.fn(),
    delete:  vi.fn(),
  },
}))

vi.mock('../services/client.service', () => ({
  clientService: {
    getAll: vi.fn(),
  },
}))

vi.mock('../services/accounting.service', () => ({
  accountingService: {
    getPdfHistory: vi.fn(),
  },
}))

const mockGetAllPayments = vi.mocked(paymentService.getAll)
const mockGetAllClients  = vi.mocked(clientService.getAll)

const defaults = {
  filterMonth:  '' as const,
  filterYear:   2026,
  filterClient: '' as const,
  filterStatus: '',
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetAllPayments.mockResolvedValue({ data: [], total: 0 })
  mockGetAllClients.mockResolvedValue([])
})


// ─── month / year coupling ───────────────────────────────────────────────────

describe('month/year filter coupling', () => {
  it('does not pass month or year when filterMonth is empty', async () => {
    renderHook(() => usePayments({ ...defaults, filterMonth: '' }))

    await waitFor(() =>
      expect(mockGetAllPayments).toHaveBeenCalledWith(
        expect.objectContaining({ month: undefined, year: undefined })
      )
    )
  })

  it('passes both month and year when filterMonth is set', async () => {
    renderHook(() => usePayments({ ...defaults, filterMonth: 4, filterYear: 2026 }))

    await waitFor(() =>
      expect(mockGetAllPayments).toHaveBeenCalledWith(
        expect.objectContaining({ month: 4, year: 2026 })
      )
    )
  })
})


// ─── optional filter forwarding ──────────────────────────────────────────────

describe('optional filter forwarding', () => {
  it('passes client_id when filterClient is set', async () => {
    renderHook(() => usePayments({ ...defaults, filterClient: 10 }))

    await waitFor(() =>
      expect(mockGetAllPayments).toHaveBeenCalledWith(
        expect.objectContaining({ client_id: 10 })
      )
    )
  })

  it('passes client_id as undefined when filterClient is empty', async () => {
    renderHook(() => usePayments({ ...defaults, filterClient: '' }))

    await waitFor(() =>
      expect(mockGetAllPayments).toHaveBeenCalledWith(
        expect.objectContaining({ client_id: undefined })
      )
    )
  })

  it('passes status when filterStatus is set', async () => {
    renderHook(() => usePayments({ ...defaults, filterStatus: 'confirmed' }))

    await waitFor(() =>
      expect(mockGetAllPayments).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'confirmed' })
      )
    )
  })

  it('passes status as undefined when filterStatus is empty', async () => {
    renderHook(() => usePayments({ ...defaults, filterStatus: '' }))

    await waitFor(() =>
      expect(mockGetAllPayments).toHaveBeenCalledWith(
        expect.objectContaining({ status: undefined })
      )
    )
  })
})


// ─── pendingDeleteId ─────────────────────────────────────────────────────────

describe('requestDelete / cancelDelete', () => {
  it('pendingDeleteId starts as null', async () => {
    const { result } = renderHook(() => usePayments(defaults))

    expect(result.current.pendingDeleteId).toBeNull()
  })

  it('requestDelete sets pendingDeleteId', async () => {
    const { result } = renderHook(() => usePayments(defaults))

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => result.current.requestDelete(7))

    expect(result.current.pendingDeleteId).toBe(7)
  })

  it('cancelDelete clears pendingDeleteId back to null', async () => {
    const { result } = renderHook(() => usePayments(defaults))

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => result.current.requestDelete(7))
    act(() => result.current.cancelDelete())

    expect(result.current.pendingDeleteId).toBeNull()
  })
})


// ─── totalAmount ─────────────────────────────────────────────────────────────

describe('totalAmount', () => {
  it('sums all payment amounts', async () => {
    mockGetAllPayments.mockResolvedValue({
      data: [
        { id: 1, amount: 100.0 } as any,
        { id: 2, amount:  50.0 } as any,
      ],
      total: 2,
    })

    const { result } = renderHook(() => usePayments(defaults))

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.totalAmount).toBe(150.0)
  })

  it('returns 0 for an empty payment list', async () => {
    const { result } = renderHook(() => usePayments(defaults))

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.totalAmount).toBe(0)
  })
})
