/**
 * Tests for useClasses hook.
 *
 * Key behaviors:
 *  - requestDelete / cancelDelete manage pendingDeleteId
 *  - effectiveRevenue sums class totalAmounts (null treated as 0,
 *    cancelledWithoutPayment excluded per business policy)
 *  - filters (month, year, client) are forwarded to classService.getAll
 */
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { classService } from '../services/class.service'
import { clientService } from '../services/client.service'
import { useClasses } from './useClasses'

vi.mock('../context/ToastContext', () => ({
  useToast: () => ({ addToast: vi.fn() }),
}))

vi.mock('../services/class.service', () => ({
  classService: {
    getAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    syncGCal: vi.fn(),
  },
}))

vi.mock('../services/client.service', () => ({
  clientService: {
    getAll: vi.fn(),
  },
}))

const mockGetAllClasses = vi.mocked(classService.getAll)
const mockGetAllClients = vi.mocked(clientService.getAll)

const defaultFilters = {
  filterMonth: 4,
  filterYear: 2026,
  filterClient: '' as const,
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetAllClasses.mockResolvedValue({ data: [], total: 0 })
  mockGetAllClients.mockResolvedValue([])
})

// ─── pendingDeleteId ─────────────────────────────────────────────────────────

describe('requestDelete / cancelDelete', () => {
  it('pendingDeleteId starts as null', async () => {
    const { result } = renderHook(() => useClasses(defaultFilters))

    expect(result.current.pendingDeleteId).toBeNull()
  })

  it('requestDelete sets pendingDeleteId to the given id', async () => {
    const { result } = renderHook(() => useClasses(defaultFilters))

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => result.current.requestDelete(42))

    expect(result.current.pendingDeleteId).toBe(42)
  })

  it('cancelDelete clears pendingDeleteId back to null', async () => {
    const { result } = renderHook(() => useClasses(defaultFilters))

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => result.current.requestDelete(42))
    act(() => result.current.cancelDelete())

    expect(result.current.pendingDeleteId).toBeNull()
  })
})

// ─── effectiveRevenue ────────────────────────────────────────────────────────

describe('effectiveRevenue', () => {
  it('sums totalAmount across normal and cancelledWithPayment classes', async () => {
    mockGetAllClasses.mockResolvedValue({
      data: [
        { id: 1, totalAmount: 40.0, status: 'normal' },
        { id: 2, totalAmount: 20.0, status: 'cancelledWithPayment' },
      ] as never,
      total: 2,
    })

    const { result } = renderHook(() => useClasses(defaultFilters))

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.effectiveRevenue).toBe(60.0)
  })

  it('treats null totalAmount as 0', async () => {
    mockGetAllClasses.mockResolvedValue({
      data: [
        { id: 1, totalAmount: null, status: 'normal' },
        { id: 2, totalAmount: 30.0, status: 'normal' },
      ] as never,
      total: 2,
    })

    const { result } = renderHook(() => useClasses(defaultFilters))

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.effectiveRevenue).toBe(30.0)
  })

  it('returns 0 when class list is empty', async () => {
    const { result } = renderHook(() => useClasses(defaultFilters))

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.effectiveRevenue).toBe(0)
  })

  it('excludes cancelledWithoutPayment classes from the total', async () => {
    mockGetAllClasses.mockResolvedValue({
      data: [
        { id: 1, totalAmount: 50.0, status: 'normal' },
        { id: 2, totalAmount: 30.0, status: 'cancelledWithoutPayment' },
        { id: 3, totalAmount: 20.0, status: 'cancelledWithPayment' },
      ] as never,
      total: 3,
    })

    const { result } = renderHook(() => useClasses(defaultFilters))

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.effectiveRevenue).toBe(70.0)
  })
})

// ─── filter forwarding ───────────────────────────────────────────────────────

describe('filter forwarding to classService.getAll', () => {
  it('passes month, year, and clientId to the service', async () => {
    renderHook(() => useClasses({ filterMonth: 5, filterYear: 2026, filterClient: 10 }))

    await waitFor(() =>
      expect(mockGetAllClasses).toHaveBeenCalledWith(
        expect.objectContaining({ month: 5, year: 2026, clientId: 10 }),
      ),
    )
  })

  it('passes clientId as undefined when filterClient is empty string', async () => {
    renderHook(() => useClasses({ filterMonth: 4, filterYear: 2026, filterClient: '' }))

    await waitFor(() =>
      expect(mockGetAllClasses).toHaveBeenCalledWith(
        expect.objectContaining({ clientId: undefined }),
      ),
    )
  })
})
