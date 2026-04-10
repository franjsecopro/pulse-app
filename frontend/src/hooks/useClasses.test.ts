/**
 * Tests for useClasses hook.
 *
 * Key behaviors:
 *  - requestDelete / cancelDelete manage pendingDeleteId
 *  - totalRevenue sums class total_amounts (null treated as 0)
 *  - filters (month, year, client) are forwarded to classService.getAll
 */
import { renderHook, waitFor, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { useClasses } from './useClasses'
import { classService } from '../services/class.service'
import { clientService } from '../services/client.service'

vi.mock('../services/class.service', () => ({
  classService: {
    getAll:    vi.fn(),
    create:    vi.fn(),
    update:    vi.fn(),
    delete:    vi.fn(),
    syncGCal:  vi.fn(),
  },
}))

vi.mock('../services/client.service', () => ({
  clientService: {
    getAll: vi.fn(),
  },
}))

const mockGetAllClasses  = vi.mocked(classService.getAll)
const mockGetAllClients  = vi.mocked(clientService.getAll)

const defaultFilters = { filterMonth: 4, filterYear: 2026, filterClient: '' as const }

beforeEach(() => {
  vi.clearAllMocks()
  mockGetAllClasses.mockResolvedValue([])
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


// ─── totalRevenue ─────────────────────────────────────────────────────────────

describe('totalRevenue', () => {
  it('sums total_amount across all loaded classes', async () => {
    mockGetAllClasses.mockResolvedValue([
      { id: 1, total_amount: 40.0 } as any,
      { id: 2, total_amount: 20.0 } as any,
    ])

    const { result } = renderHook(() => useClasses(defaultFilters))

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.totalRevenue).toBe(60.0)
  })

  it('treats null total_amount as 0', async () => {
    mockGetAllClasses.mockResolvedValue([
      { id: 1, total_amount: null  } as any,
      { id: 2, total_amount: 30.0 } as any,
    ])

    const { result } = renderHook(() => useClasses(defaultFilters))

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.totalRevenue).toBe(30.0)
  })

  it('returns 0 when class list is empty', async () => {
    const { result } = renderHook(() => useClasses(defaultFilters))

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.totalRevenue).toBe(0)
  })
})


// ─── filter forwarding ───────────────────────────────────────────────────────

describe('filter forwarding to classService.getAll', () => {
  it('passes month, year, and client_id to the service', async () => {
    renderHook(() => useClasses({ filterMonth: 5, filterYear: 2026, filterClient: 10 }))

    await waitFor(() =>
      expect(mockGetAllClasses).toHaveBeenCalledWith({
        month: 5,
        year: 2026,
        client_id: 10,
      })
    )
  })

  it('passes client_id as undefined when filterClient is empty string', async () => {
    renderHook(() => useClasses({ filterMonth: 4, filterYear: 2026, filterClient: '' }))

    await waitFor(() =>
      expect(mockGetAllClasses).toHaveBeenCalledWith(
        expect.objectContaining({ client_id: undefined })
      )
    )
  })
})
