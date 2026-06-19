import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createWrapper } from '../lib/test-utils'
import { classService } from '../services/class.service'
import { clientService } from '../services/client.service'
import { useClasses } from './useClasses'

vi.mock('../context/ToastContext', () => ({
  useToast: () => ({ addToast: vi.fn() }),
}))

vi.mock('../services/class.service', () => ({
  classService: {
    getAll: vi.fn(),
    getStats: vi.fn(),
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
const mockGetStats = vi.mocked(classService.getStats)
const mockGetAllClients = vi.mocked(clientService.getAll)

const defaultFilters = {
  filterMonth: 4,
  filterYear: 2026,
  filterClient: '' as const,
}

const renderHookWithQuery: typeof renderHook = (cb) => renderHook(cb, { wrapper: createWrapper() })

beforeEach(() => {
  vi.clearAllMocks()
  mockGetAllClasses.mockResolvedValue({ data: [], total: 0 })
  mockGetStats.mockResolvedValue({ count: 0, totalRevenue: 0, totalHours: 0, workedHours: 0 })
  mockGetAllClients.mockResolvedValue([])
})

// ─── pendingDeleteId ─────────────────────────────────────────────────────────

describe('requestDelete / cancelDelete', () => {
  it('pendingDeleteId starts as null', async () => {
    const { result } = renderHookWithQuery(() => useClasses(defaultFilters))

    expect(result.current.pendingDeleteId).toBeNull()
  })

  it('requestDelete sets pendingDeleteId to the given id', async () => {
    const { result } = renderHookWithQuery(() => useClasses(defaultFilters))

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => result.current.requestDelete(42))

    expect(result.current.pendingDeleteId).toBe(42)
  })

  it('cancelDelete clears pendingDeleteId back to null', async () => {
    const { result } = renderHookWithQuery(() => useClasses(defaultFilters))

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => result.current.requestDelete(42))
    act(() => result.current.cancelDelete())

    expect(result.current.pendingDeleteId).toBeNull()
  })
})

// ─── classStats ──────────────────────────────────────────────────────────────

describe('classStats', () => {
  it('starts as zero defaults', async () => {
    const { result } = renderHookWithQuery(() => useClasses(defaultFilters))

    expect(result.current.classStats).toEqual({
      count: 0,
      totalRevenue: 0,
      totalHours: 0,
      workedHours: 0,
    })
  })

  it('exposes the value returned by the backend', async () => {
    mockGetStats.mockResolvedValue({
      count: 12,
      totalRevenue: 540.5,
      totalHours: 24,
      workedHours: 18,
    })

    const { result } = renderHookWithQuery(() => useClasses(defaultFilters))

    await waitFor(() => expect(result.current.classStats.count).toBe(12))

    expect(result.current.classStats.totalRevenue).toBe(540.5)
  })

  it('is reloaded when filters change', async () => {
    mockGetStats.mockResolvedValueOnce({
      count: 1,
      totalRevenue: 10,
      totalHours: 2,
      workedHours: 2,
    })
    mockGetStats.mockResolvedValueOnce({
      count: 2,
      totalRevenue: 20,
      totalHours: 4,
      workedHours: 3,
    })

    const { rerender } = renderHook(({ filters }) => useClasses(filters), {
      wrapper: createWrapper(),
      initialProps: { filters: { filterMonth: 4, filterYear: 2026, filterClient: '' as const } },
    })

    await waitFor(() => expect(mockGetStats).toHaveBeenCalledTimes(1))

    rerender({ filters: { filterMonth: 5, filterYear: 2026, filterClient: '' as const } })

    await waitFor(() => expect(mockGetStats).toHaveBeenCalledTimes(2))
  })
})

// ─── filter forwarding ───────────────────────────────────────────────────────

describe('filter forwarding to classService', () => {
  it('passes month, year, and clientId to getAll', async () => {
    renderHookWithQuery(() => useClasses({ filterMonth: 5, filterYear: 2026, filterClient: 10 }))

    await waitFor(() =>
      expect(mockGetAllClasses).toHaveBeenCalledWith(
        expect.objectContaining({ month: 5, year: 2026, clientId: 10 }),
      ),
    )
  })

  it('passes clientId as undefined when filterClient is empty string', async () => {
    renderHookWithQuery(() => useClasses({ filterMonth: 4, filterYear: 2026, filterClient: '' }))

    await waitFor(() =>
      expect(mockGetAllClasses).toHaveBeenCalledWith(
        expect.objectContaining({ clientId: undefined }),
      ),
    )
  })

  it('passes the same filters to getStats', async () => {
    renderHookWithQuery(() => useClasses({ filterMonth: 5, filterYear: 2026, filterClient: 10 }))

    await waitFor(() =>
      expect(mockGetStats).toHaveBeenCalledWith(
        expect.objectContaining({ month: 5, year: 2026, clientId: 10 }),
      ),
    )
  })
})
